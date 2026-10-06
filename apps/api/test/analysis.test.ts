import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AnalysisDto } from '@kaufcheck/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { BuiltApp } from '../src/app';
import type { ListingUrlRetriever } from '../src/infrastructure/listing-sources/types';
import {
  createTestApp,
  errorOf,
  eventually,
  listingUrl,
  ndjson,
  PASTED_LISTING,
  resetDatabase,
  TestClient,
  URLS,
} from './helpers';

const INSUFFICIENT =
  'Für eine belastbare Marktpreis-Einordnung liegen aktuell nicht genügend Vergleichsdaten vor.';
const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../fixtures/listings');

describe('analysis pipeline', () => {
  let built: BuiltApp;
  let client: TestClient;

  beforeAll(async () => {
    built = await createTestApp();
  });
  beforeEach(async () => {
    await resetDatabase(built.services.db);
    client = new TestClient(built.app);
  });
  afterAll(() => built.app.close());

  it('analyzes a listing URL end to end and stores the result', async () => {
    const response = await client.post('/api/listings/analyze', { url: URLS.audi });
    expect(response.statusCode, response.body).toBe(201);
    const dto = response.json<AnalysisDto>();

    expect(dto.listing.source).toMatchObject({
      type: 'kleinanzeigen_url',
      externalId: '2912345678',
      isExample: false,
    });
    expect(dto.vehicle).toMatchObject({ make: 'Audi', model: 'A7', mileageKm: 185_000 });
    expect(dto.analysis.priceContext.market).toEqual({
      status: 'insufficient_data',
      message: INSUFFICIENT,
      sampleSize: 0,
    });
    expect(dto.analysis.ai.status).toBe('not_configured');
    const conflict = dto.analysis.observations.find((item) => item.id === 'mileage_conflict');
    expect(conflict?.evidence).toBeDefined();
    expect(dto.analysis.sellerQuestions.length).toBeGreaterThan(3);
    expect(dto.analysis.inspectionChecklist.map((section) => section.id)).toEqual(
      expect.arrayContaining(['documents', 'exterior', 'interior', 'test_drive']),
    );
    // Photos can't be analysed on this server – said honestly, not faked.
    expect(dto.analysis.photoAnalysis.message).toContain('nicht aktiviert');

    const stored = await built.services.db.analysis.findUniqueOrThrow({
      where: { id: dto.id },
      include: { listing: { include: { vehicle: true } }, sellerQuestions: true },
    });
    expect(stored.userId).toBeNull();
    expect(stored.anonymousId).toMatch(/^[\w-]{22}$/);
    expect(stored.listing.vehicle?.make).toBe('Audi');
    expect(stored.sellerQuestions).toHaveLength(dto.analysis.sellerQuestions.length);
    expect(client.cookie('kc_anon')).toBeDefined();

    const reopened = await client.get(`/api/analyses/${dto.id}`);
    expect(reopened.statusCode).toBe(200);
    expect(reopened.headers['x-robots-tag']).toBe('noindex');
    expect(reopened.headers['cache-control']).toBe('private, no-store');
    const again = reopened.json<AnalysisDto>();
    expect(again.analysis.sellerQuestions.map((question) => question.id)).toEqual(
      dto.analysis.sellerQuestions.map((question) => question.id),
    );
    expect(again.analysis.completeness).toEqual(dto.analysis.completeness);
  });

  it('streams the real pipeline stages as NDJSON', async () => {
    const response = await client.post(
      '/api/listings/analyze',
      { url: URLS.bmw },
      { accept: 'application/x-ndjson' },
    );
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/x-ndjson');
    const events = ndjson(response);
    expect(
      events
        .filter((event) => event.type === 'stage')
        .map((event) => `${event.stage}:${event.status}`),
    ).toEqual([
      'validate:started',
      'validate:completed',
      'retrieve:started',
      'retrieve:completed',
      'extract:started',
      'extract:completed',
      'analyze:started',
      'analyze:completed',
      'questions:started',
      'questions:completed',
    ]);
    expect(events.at(-1)?.type).toBe('result');
  });

  it('redacts contact data before storing listings', async () => {
    const dto = await client.analyzeUrl(URLS.bmw);
    const listing = await built.services.db.listing.findUniqueOrThrow({
      where: { id: dto.listing.id },
    });
    expect(listing.description).not.toContain('0171 2345678');
    expect(listing.description).not.toContain('max.muster@example.com');
  });

  it.each([
    [URLS.blocked, 'FETCH_BLOCKED'],
    [URLS.removed, 'LISTING_NOT_FOUND'],
    [URLS.unknown, 'FETCH_FAILED'],
  ])('offers the text fallback when retrieval fails (%s → %s)', async (url, code) => {
    const response = await client.post(
      '/api/listings/analyze',
      { url },
      { accept: 'application/x-ndjson' },
    );
    const events = ndjson(response);
    const last = events.at(-1);
    expect(last?.type).toBe('error');
    if (last?.type !== 'error') return;
    expect(last.error.code).toBe(code);
    expect(last.error.details?.fallbackToText).toBe(true);
    expect(
      events.some(
        (event) =>
          event.type === 'stage' && event.stage === 'retrieve' && event.status === 'completed',
      ),
    ).toBe(false);
    // Nothing stored.
    expect(await built.services.db.analysis.count()).toBe(0);
  });

  it('rejects other sites and invalid links clearly', async () => {
    const other = await client.post('/api/listings/analyze', {
      url: 'https://www.example-autos.de/inserat/123',
    });
    expect(other.statusCode).toBe(422);
    expect(errorOf(other)).toMatchObject({
      code: 'UNSUPPORTED_SOURCE',
      details: { fallbackToText: true },
    });

    // Known marketplaces that do not permit retrieval: the visitor pastes the text instead.
    const mobile = await client.post('/api/listings/analyze', {
      url: 'https://suchen.mobile.de/fahrzeuge/details.html?id=412345678',
    });
    expect(mobile.statusCode).toBe(422);
    expect(errorOf(mobile)).toMatchObject({
      code: 'SOURCE_NOT_PERMITTED',
      message: 'Inserate von mobile.de ruft KaufCheck nicht automatisch ab.',
      details: { fallbackToText: true, platform: 'mobile_de' },
    });

    const internal = await client.post('/api/listings/analyze', {
      url: 'http://169.254.169.254/latest/meta-data',
    });
    expect([400, 422]).toContain(internal.statusCode);

    const garbage = await client.post('/api/listings/analyze', { url: 'kein link' });
    expect(garbage.statusCode).toBe(400);
    expect(errorOf(garbage).code).toMatch(/INVALID_URL|VALIDATION_ERROR/);
  });

  it('analyzes pasted text and rejects non-car listings', async () => {
    const response = await client.post('/api/listings/analyze-text', { text: PASTED_LISTING });
    expect(response.statusCode, response.body).toBe(201);
    const dto = response.json<AnalysisDto>();
    expect(dto.listing.source.type).toBe('text');

    // The link of any known marketplace is kept for reference, in its canonical form.
    const withLink = await client.post('/api/listings/analyze-text', {
      text: PASTED_LISTING,
      url: 'https://www.autoscout24.de/angebote/vw-golf-4f1d8f6e-5a7c-4b0e-9a3d-2c1b0e9f8a7d?source=list',
    });
    expect(withLink.statusCode, withLink.body).toBe(201);
    expect(withLink.json<AnalysisDto>().listing.source.url).toBe(
      'https://www.autoscout24.de/angebote/vw-golf-4f1d8f6e-5a7c-4b0e-9a3d-2c1b0e9f8a7d',
    );
    expect(dto.vehicle).toMatchObject({ make: 'Volkswagen', model: 'Golf', mileageKm: 142_000 });

    const sofa = await client.post('/api/listings/analyze-text', {
      text: 'Sofa, 3-Sitzer, grau\n150 € VB\nBeschreibung\nGut erhaltenes Sofa aus Nichtraucherhaushalt, Abholung in Berlin.',
    });
    expect(sofa.statusCode).toBe(422);
    expect(errorOf(sofa).code).toBe('UNSUPPORTED_CATEGORY');
  });

  it('runs the fictional example without using the quota', async () => {
    const response = await client.post('/api/listings/analyze-example', {});
    expect(response.statusCode, response.body).toBe(201);
    expect(response.json<AnalysisDto>().listing.source).toMatchObject({
      type: 'example',
      isExample: true,
    });
    const me = await client.get('/api/me');
    expect(me.json<{ usage: { used: number } }>().usage.used).toBe(0);
  });

  it('never exposes internal errors', async () => {
    const failing: ListingUrlRetriever = {
      mode: 'live',
      platforms: ['kleinanzeigen'],
      retrieve: () =>
        Promise.reject(new Error('connect ECONNREFUSED 10.0.0.1:5432 at /srv/app/secret.ts:12')),
    };
    const broken = await createTestApp({}, { retriever: failing });
    try {
      const response = await new TestClient(broken.app).post('/api/listings/analyze', {
        url: URLS.audi,
      });
      expect(response.statusCode).toBe(500);
      expect(errorOf(response)).toMatchObject({ code: 'INTERNAL_ERROR' });
      expect(response.body).not.toMatch(/ECONNREFUSED|secret\.ts|stack/);
    } finally {
      await broken.app.close();
    }
  });

  it('records privacy-conscious analytics events', async () => {
    await client.analyzeUrl(URLS.audi);
    const events = await eventually(
      () => built.services.db.analyticsEvent.findMany({ orderBy: { createdAt: 'asc' } }),
      (rows) => rows.length >= 2,
    );
    expect(events.map((event) => event.name).sort()).toEqual([
      'listing_analysis_completed',
      'listing_analysis_started',
    ]);
    expect(JSON.stringify(events)).not.toMatch(/2912345678|Audi|10\.\d+\.\d+\.\d+/);
  });
});

describe('price context from verified comparables', () => {
  let built: BuiltApp;
  let directory: string;

  beforeAll(async () => {
    // Synthetic Audi A7 offers with different ad ids, prices and mileage.
    directory = mkdtempSync(path.join(tmpdir(), 'kc-fixtures-'));
    const template = readFileSync(path.join(FIXTURES, '2912345678.html'), 'utf8');
    for (let index = 0; index < 10; index += 1) {
      const id = String(2930000000 + index);
      const price = 11_000 + index * 400;
      const km = 170_000 + index * 3_000;
      const html = template
        .replaceAll('2912345678', id)
        .replace('12.900 € VB', `${price.toLocaleString('de-DE')} € VB`)
        .replace('185.000 km', `${km.toLocaleString('de-DE')} km`);
      writeFileSync(path.join(directory, `${id}.html`), html);
    }
    built = await createTestApp({ LISTING_FIXTURES_DIR: directory, ANON_MONTHLY_ANALYSES: '100' });
    await resetDatabase(built.services.db);
  });
  afterAll(async () => {
    await built.app.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it('shows market context only with enough retrieved comparables, and never from pasted text', async () => {
    const client = new TestClient(built.app);
    // Pasted copies do not count as market data.
    for (let index = 0; index < 8; index += 1) {
      const response = await client.post('/api/listings/analyze-text', {
        text: `Audi A7 Sportback\n${(9000 + index * 100).toLocaleString('de-DE')} €\nDetails\nMarke\nAudi\nModell\nA7\nKilometerstand\n180.000 km\nErstzulassung\nMai 2012\nBeschreibung\nKopie ${index}`,
      });
      expect(response.statusCode, response.body).toBe(201);
    }

    const first = await client.analyzeUrl(listingUrl('2930000000'));
    expect(first.analysis.priceContext.market.status).toBe('insufficient_data');

    for (let index = 1; index < 9; index += 1)
      await client.analyzeUrl(listingUrl(String(2930000000 + index)));
    // Re-analysing the same offer does not add a second sample.
    await client.analyzeUrl(listingUrl('2930000001'));

    const target = await client.analyzeUrl(listingUrl('2930000009'));
    const market = target.analysis.priceContext.market;
    expect(market.status).toBe('available');
    if (market.status !== 'available') return;
    expect(market.sampleSize).toBe(9);
    expect(market.medianEur).toBe(12_600);
    expect(market.source).toContain('keine repräsentative Marktanalyse');
  });
});
