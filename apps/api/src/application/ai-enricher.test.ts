import {
  getExampleListing,
  parseListingText,
  prepareListing,
  VehicleAnalyzer,
  type AiTextAnalysis,
} from '@kaufcheck/domain';
import { ERROR_MESSAGES, type AnalysisResult, type NormalizedListing } from '@kaufcheck/shared';
import type { FastifyBaseLogger } from 'fastify';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { MockAiProvider } from '../infrastructure/ai/mock-provider';
import {
  AiProviderError,
  type AiProvider,
  type StructuredAnalysisRequest,
  type StructuredAnalysisResponse,
} from '../infrastructure/ai/types';
import { AiEnricher, type AiEnricherOptions } from './ai-enricher';

const NOW = new Date('2026-09-30T10:00:00Z');
let listing: NormalizedListing;
let result: AnalysisResult;

beforeAll(async () => {
  const example = getExampleListing();
  if (!example) throw new Error('example missing');
  const prepared = prepareListing({
    parsed: parseListingText(example.text),
    source: {
      type: 'example',
      url: null,
      externalId: null,
      retrievedAt: NOW.toISOString(),
      isExample: true,
    },
    urlCategoryId: null,
  });
  if (!prepared.ok) throw new Error(prepared.reason);
  listing = prepared.listing;
  result = await new VehicleAnalyzer().analyze(listing, { now: NOW, market: null });
});

function logger() {
  const log = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    silent: vi.fn(),
    level: 'silent',
    child: () => log,
  };
  return log;
}

const OPTIONS: AiEnricherOptions = {
  timeoutMs: 5000,
  maxConcurrency: 2,
  photoAnalysis: true,
  maxPhotos: 4,
  imageUserAgent: 'KaufCheckBot/test',
  imageTimeoutMs: 1000,
  // No network in unit tests: image downloads fail like an unreachable CDN.
  resolver: () => Promise.reject(new Error('offline')),
};

class FakeProvider implements AiProvider {
  readonly name = 'anthropic' as const;
  readonly model = 'claude-test';
  readonly isMock = false;
  readonly supportsVision = true;
  readonly calls: StructuredAnalysisRequest<unknown>[] = [];

  constructor(
    private readonly respond: (request: StructuredAnalysisRequest<unknown>) => Promise<unknown>,
  ) {}

  async generateStructuredAnalysis<T>(
    request: StructuredAnalysisRequest<T>,
  ): Promise<StructuredAnalysisResponse<T>> {
    this.calls.push(request);
    return { data: (await this.respond(request)) as T, model: this.model };
  }
}

const VALID: AiTextAnalysis = {
  summary:
    'Das Inserat beschreibt einen Audi A7 mit vielen Angaben. Offen bleiben vor allem die Wartungsnachweise und der genaue Kilometerstand.',
  observations: [
    {
      title: 'Hinweis auf Gebrauchsspuren am Heck',
      detail:
        'Die Beschreibung erwähnt Kratzer an der Stoßstange. Bei der Besichtigung genau ansehen.',
      severity: 'notice',
      quote: 'Kleine Kratzer an der hinteren Stoßstange',
    },
    {
      title: 'Erfundenes Zitat',
      detail: 'Dieses Zitat steht nicht im Inserat und muss verworfen werden.',
      severity: 'warning',
      quote: 'Motor wurde komplett überholt',
    },
  ],
  checks: [],
  sellerQuestions: [
    {
      formal: 'Welche Arbeiten wurden bei der letzten Inspektion durchgeführt?',
      informal: 'Welche Arbeiten wurden bei der letzten Inspektion durchgeführt?',
      reason: 'Die Beschreibung nennt regelmäßige Wartung ohne Details.',
    },
  ],
};

const enrich = (enricher: AiEnricher, extra: Partial<Parameters<AiEnricher['enrich']>[0]> = {}) =>
  enricher.enrich({
    listing,
    result,
    photosAllowed: false,
    signal: new AbortController().signal,
    ...extra,
  });

describe('AiEnricher', () => {
  it('merges validated AI output as labelled inference and drops unverifiable quotes', async () => {
    const provider = new FakeProvider(() => Promise.resolve(VALID));
    const log = logger();
    const enriched = await enrich(new AiEnricher(provider, OPTIONS, log));

    expect(enriched.ai).toMatchObject({
      status: 'completed',
      provider: 'anthropic',
      model: 'claude-test',
      isMock: false,
    });
    expect(enriched.summary.ai?.text).toBe(VALID.summary);
    const aiObservations = enriched.observations.filter((item) => item.origin === 'ai');
    expect(aiObservations).toHaveLength(1);
    expect(aiObservations[0]).toMatchObject({
      evidence: 'inference',
      quotes: ['Kleine Kratzer an der hinteren Stoßstange'],
    });
    expect(enriched.sellerQuestions.some((question) => question.origin === 'ai')).toBe(true);
    // Rule-based content is kept.
    expect(enriched.observations.length).toBeGreaterThan(result.observations.length);
    expect(provider.calls[0]).toMatchObject({
      task: 'listing_text',
      schemaName: 'listing_analysis',
    });
  });

  it('never logs listing content', async () => {
    const log = logger();
    await enrich(new AiEnricher(new FakeProvider(() => Promise.resolve(VALID)), OPTIONS, log));
    await enrich(
      new AiEnricher(
        new FakeProvider(() => Promise.reject(new AiProviderError('timeout', 't'))),
        OPTIONS,
        log,
      ),
    );
    const logged = JSON.stringify([...log.info.mock.calls, ...log.warn.mock.calls]);
    expect(logged).not.toContain('Stoßstange');
    expect(logged).not.toContain(listing.description?.slice(0, 30) ?? '__none__');
  });

  it('keeps the rule-based result when the output does not match the schema', async () => {
    const provider = new FakeProvider(() => Promise.resolve({ summary: 'zu kurz' }));
    const enriched = await enrich(new AiEnricher(provider, OPTIONS, logger()));
    expect(enriched.ai).toMatchObject({
      status: 'failed',
      message: ERROR_MESSAGES.AI_OUTPUT_INVALID,
    });
    expect(enriched.observations).toEqual(result.observations);
    expect(enriched.summary.ai ?? null).toBeNull();
  });

  it.each([
    ['timeout', ERROR_MESSAGES.AI_ANALYSIS_FAILED],
    ['rate_limited', ERROR_MESSAGES.AI_ANALYSIS_FAILED],
    ['refusal', ERROR_MESSAGES.AI_ANALYSIS_FAILED],
    ['truncated', ERROR_MESSAGES.AI_OUTPUT_INVALID],
  ] as const)('degrades gracefully on provider failure (%s)', async (reason, message) => {
    const provider = new FakeProvider(() => Promise.reject(new AiProviderError(reason, 'x')));
    const enriched = await enrich(new AiEnricher(provider, OPTIONS, logger()));
    expect(enriched.ai).toMatchObject({ status: 'failed', message });
    expect(enriched.sellerQuestions).toEqual(result.sellerQuestions);
  });

  it('propagates aborts instead of reporting a failure', async () => {
    const provider = new FakeProvider(() => Promise.reject(new AiProviderError('aborted', 'x')));
    await expect(
      enrich(new AiEnricher(provider, OPTIONS, logger() as unknown as FastifyBaseLogger)),
    ).rejects.toMatchObject({
      reason: 'aborted',
    });
  });

  it('skips the AI step instead of queueing when all slots are busy', async () => {
    let unblock: (value: unknown) => void = () => undefined;
    const provider = new FakeProvider(() => new Promise((resolve) => (unblock = resolve)));
    const enricher = new AiEnricher(provider, { ...OPTIONS, maxConcurrency: 1 }, logger());
    const first = enrich(enricher);
    const second = await enrich(enricher);
    expect(second.ai.status).toBe('skipped');
    unblock(VALID);
    expect((await first).ai.status).toBe('completed');
  });

  it('reuses cached raw output for identical input only when a cache key is given', async () => {
    const provider = new FakeProvider(() => Promise.resolve(VALID));
    const enricher = new AiEnricher(provider, OPTIONS, logger());
    expect(enricher.hasCached('example:audi-a7')).toBe(false);
    await enrich(enricher, { cacheKey: 'example:audi-a7' });
    expect(enricher.hasCached('example:audi-a7')).toBe(true);
    const again = await enrich(enricher, { cacheKey: 'example:audi-a7' });
    expect(again.ai.status).toBe('completed');
    expect(provider.calls).toHaveLength(1);
    await enrich(enricher);
    expect(provider.calls).toHaveLength(2);
  });

  it('does not cache failed calls', async () => {
    const provider = new FakeProvider(() =>
      Promise.reject(new AiProviderError('unavailable', 'x')),
    );
    const enricher = new AiEnricher(provider, OPTIONS, logger());
    await enrich(enricher, { cacheKey: 'k' });
    expect(enricher.hasCached('k')).toBe(false);
  });

  it('runs photo analysis only when allowed and reports honestly when photos cannot be loaded', async () => {
    const withImages: NormalizedListing = {
      ...listing,
      images: [
        {
          url: 'https://img.kleinanzeigen.de/api/v1/prod-ads/images/aa/aa-1?rule=$_59.JPG',
          thumbnailUrl: null,
        },
      ],
    };
    const provider = new FakeProvider((request) =>
      Promise.resolve(request.task === 'listing_text' ? VALID : { findings: [], odometer: null }),
    );
    const enricher = new AiEnricher(provider, OPTIONS, logger());

    const free = await enricher.enrich({
      listing: withImages,
      result,
      photosAllowed: false,
      signal: new AbortController().signal,
    });
    expect(provider.calls.map((call) => call.task)).toEqual(['listing_text']);
    expect(free.photoAnalysis).toEqual(result.photoAnalysis);

    const pro = await enricher.enrich({
      listing: withImages,
      result,
      photosAllowed: true,
      signal: new AbortController().signal,
    });
    expect(pro.photoAnalysis).toMatchObject({
      status: 'failed',
      findings: [],
      analyzedImageCount: 0,
    });
    expect(pro.photoAnalysis.message).toContain('nicht geladen');
    // No image could be downloaded, so the photo model was never called.
    expect(provider.calls.filter((call) => call.task === 'listing_photos')).toHaveLength(0);
  });
});

describe('MockAiProvider (development only)', () => {
  it('returns schema-valid, clearly simulated output', async () => {
    const enriched = await enrich(new AiEnricher(new MockAiProvider(), OPTIONS, logger()));
    expect(enriched.ai).toMatchObject({ status: 'completed', provider: 'mock', isMock: true });
    expect(enriched.summary.ai?.text).toContain('Simulierte');
    for (const item of enriched.observations.filter((observation) => observation.origin === 'ai')) {
      expect(item.evidence).toBe('inference');
    }
  });
});
