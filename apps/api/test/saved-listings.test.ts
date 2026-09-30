import type {
  AnalysisDto,
  ComparisonDto,
  SavedListingDto,
  SavedListingsResponse,
} from '@kaufcheck/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { BuiltApp } from '../src/app';
import {
  createTestApp,
  errorOf,
  eventually,
  ndjson,
  PASTED_LISTING,
  resetDatabase,
  TestClient,
  URLS,
} from './helpers';

describe('saved listings and comparison', () => {
  let built: BuiltApp;

  beforeAll(async () => {
    built = await createTestApp({ FREE_MONTHLY_ANALYSES: '50' });
  });
  beforeEach(() => resetDatabase(built.services.db));
  afterAll(() => built.app.close());

  async function saveAll(client: TestClient, urls: string[]): Promise<SavedListingDto[]> {
    const saved: SavedListingDto[] = [];
    for (const url of urls) {
      const analysis = await client.analyzeUrl(url);
      const response = await client.post('/api/saved-listings', { analysisId: analysis.id });
      expect(response.statusCode, response.body).toBe(201);
      saved.push(response.json<SavedListingDto>());
    }
    return saved;
  }

  it('requires an account to save', async () => {
    const client = new TestClient(built.app);
    const analysis = await client.analyzeUrl(URLS.audi);
    const response = await client.post('/api/saved-listings', { analysisId: analysis.id });
    expect(response.statusCode).toBe(401);
    expect(errorOf(response).code).toBe('UNAUTHENTICATED');
  });

  it('saves, lists, renames and deletes', async () => {
    const client = new TestClient(built.app);
    await client.register();
    const [saved] = await saveAll(client, [URLS.audi]);
    expect(saved?.title).toContain('Audi A7');
    expect(saved).toMatchObject({ customTitle: null, sourceType: 'kleinanzeigen_url' });

    // Saving the same offer again updates the entry instead of duplicating it.
    const again = await client.analyzeUrl(URLS.audi);
    const resaved = await client.post('/api/saved-listings', { analysisId: again.id });
    expect(resaved.json<SavedListingDto>().id).toBe(saved?.id);
    expect(resaved.json<SavedListingDto>().analysisId).toBe(again.id);

    const renamed = await client.patch(`/api/saved-listings/${saved?.id}`, {
      title: 'Der schwarze A7',
    });
    expect(renamed.statusCode).toBe(200);
    expect(renamed.json<SavedListingDto>()).toMatchObject({
      title: 'Der schwarze A7',
      customTitle: 'Der schwarze A7',
    });

    const list = (await client.get('/api/saved-listings')).json<SavedListingsResponse>();
    expect(list.items).toHaveLength(1);
    expect(list.limit).toBe(5);

    // The analysis page knows that it is saved.
    const dto = (await client.get(`/api/analyses/${again.id}`)).json<AnalysisDto>();
    expect(dto.savedListingId).toBe(saved?.id);

    expect((await client.delete(`/api/saved-listings/${saved?.id}`)).statusCode).toBe(204);
    expect((await client.delete(`/api/saved-listings/${saved?.id}`)).statusCode).toBe(404);
    expect(
      (await client.get('/api/saved-listings')).json<SavedListingsResponse>().items,
    ).toHaveLength(0);
  });

  it('keeps saved listings private to their owner', async () => {
    const owner = new TestClient(built.app);
    await owner.register();
    const [saved] = await saveAll(owner, [URLS.audi]);
    const intruder = new TestClient(built.app);
    await intruder.register();
    const [own] = await saveAll(intruder, [URLS.bmw]);
    expect(
      (await intruder.patch(`/api/saved-listings/${saved?.id}`, { title: 'Meins' })).statusCode,
    ).toBe(404);
    expect((await intruder.delete(`/api/saved-listings/${saved?.id}`)).statusCode).toBe(404);
    expect((await intruder.post(`/api/saved-listings/${saved?.id}/reanalyze`)).statusCode).toBe(
      404,
    );
    const comparison = await intruder.post('/api/comparisons', {
      savedListingIds: [own?.id, saved?.id],
    });
    expect(comparison.statusCode).toBe(404);
    expect(
      (await intruder.get('/api/saved-listings'))
        .json<SavedListingsResponse>()
        .items.map((item) => item.id),
    ).toEqual([own?.id]);
    // The owner's entry is untouched.
    expect(
      (await owner.get('/api/saved-listings')).json<SavedListingsResponse>().items[0]?.customTitle,
    ).toBeNull();
  });

  it('enforces the free plan limit of five saved listings', async () => {
    const client = new TestClient(built.app);
    await client.register();
    await saveAll(client, [URLS.audi, URLS.bmw, URLS.mercedes]);
    for (const text of ['A', 'B']) {
      const analysis = await client.post('/api/listings/analyze-text', {
        text: `${PASTED_LISTING}\nVariante ${text}`,
      });
      expect(
        (await client.post('/api/saved-listings', { analysisId: analysis.json<AnalysisDto>().id }))
          .statusCode,
      ).toBe(201);
    }
    const sixth = await client.post('/api/listings/analyze-text', {
      text: `${PASTED_LISTING}\nVariante C`,
    });
    const response = await client.post('/api/saved-listings', {
      analysisId: sixth.json<AnalysisDto>().id,
    });
    expect(response.statusCode).toBe(403);
    expect(errorOf(response)).toMatchObject({
      code: 'PLAN_LIMIT_REACHED',
      details: { limit: 5, used: 5 },
    });
  });

  it('compares saved offers side by side without declaring a winner', async () => {
    const client = new TestClient(built.app);
    await client.register();
    const saved = await saveAll(client, [URLS.audi, URLS.bmw, URLS.mercedes]);
    const response = await client.post('/api/comparisons', {
      savedListingIds: saved.map((item) => item.id),
    });
    expect(response.statusCode, response.body).toBe(200);
    const comparison = response.json<ComparisonDto>();
    expect(comparison.items.map((item) => item.savedListingId)).toEqual(
      saved.map((item) => item.id),
    );
    expect(comparison.rows.every((row) => row.cells.length === 3)).toBe(true);
    expect(comparison.rows.map((row) => row.key)).toEqual(
      expect.arrayContaining(['price', 'mileage']),
    );
    expect(JSON.stringify(comparison)).not.toMatch(/winner|empfehl|beste[sn]? Angebot|Testsieger/i);

    const tooFew = await client.post('/api/comparisons', { savedListingIds: [saved[0]?.id] });
    expect(tooFew.statusCode).toBe(400);

    const events = await eventually(
      () => built.services.db.analyticsEvent.findMany({ where: { name: 'comparison_created' } }),
      (rows) => rows.length > 0,
    );
    expect(events).toHaveLength(1);
    expect(events[0]?.props).toEqual({ count: 3, plan: 'free' });
  });

  it('limits comparisons by plan', async () => {
    const client = new TestClient(built.app);
    const account = await client.register();
    const saved = await saveAll(client, [URLS.audi, URLS.bmw, URLS.mercedes]);
    const text = await client.post('/api/listings/analyze-text', { text: PASTED_LISTING });
    const fourth = await client.post('/api/saved-listings', {
      analysisId: text.json<AnalysisDto>().id,
    });
    const ids = [...saved.map((item) => item.id), fourth.json<SavedListingDto>().id];

    const blocked = await client.post('/api/comparisons', { savedListingIds: ids });
    expect(blocked.statusCode).toBe(403);
    expect(errorOf(blocked)).toMatchObject({ code: 'PLAN_LIMIT_REACHED', details: { limit: 3 } });

    await built.services.db.user.update({ where: { id: account.id }, data: { plan: 'PRO' } });
    expect((await client.post('/api/comparisons', { savedListingIds: ids })).statusCode).toBe(200);
  });

  it('re-analyzes a saved listing and keeps the entry', async () => {
    const client = new TestClient(built.app);
    await client.register();
    const [saved] = await saveAll(client, [URLS.bmw]);
    const response = await client.post(
      `/api/saved-listings/${saved?.id}/reanalyze`,
      {},
      { accept: 'application/x-ndjson' },
    );
    const events = ndjson(response);
    const result = events.at(-1);
    expect(result?.type).toBe('result');
    if (result?.type !== 'result') return;
    expect(result.data.id).not.toBe(saved?.analysisId);
    expect(result.data.savedListingId).toBe(saved?.id);

    const list = (await client.get('/api/saved-listings')).json<SavedListingsResponse>();
    expect(list.items[0]?.analysisId).toBe(result.data.id);
  });

  it('keeps the analysis history a Pro feature', async () => {
    const client = new TestClient(built.app);
    const account = await client.register();
    await client.analyzeUrl(URLS.audi);
    const free = await client.get('/api/analyses');
    expect(free.statusCode).toBe(403);
    expect(errorOf(free).code).toBe('PLAN_LIMIT_REACHED');

    await built.services.db.user.update({ where: { id: account.id }, data: { plan: 'PRO' } });
    const pro = await client.get('/api/analyses');
    expect(pro.statusCode).toBe(200);
    expect(pro.json<{ items: unknown[] }>().items).toHaveLength(1);

    expect((await new TestClient(built.app).get('/api/analyses')).statusCode).toBe(401);
  });

  it('marks photo analysis as a Pro feature and ads as disabled for Pro', async () => {
    const client = new TestClient(built.app);
    const account = await client.register();
    const me = (await client.get('/api/me')).json<{
      entitlements: { showAds: boolean; photoAnalysis: boolean };
    }>();
    expect(me.entitlements).toMatchObject({ showAds: true, photoAnalysis: false });
    await built.services.db.user.update({ where: { id: account.id }, data: { plan: 'PRO' } });
    const pro = (await client.get('/api/me')).json<{
      entitlements: { showAds: boolean; photoAnalysis: boolean };
    }>();
    expect(pro.entitlements).toMatchObject({ showAds: false, photoAnalysis: true });
  });
});
