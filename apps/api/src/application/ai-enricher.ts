import {
  AiPhotoAnalysisSchema,
  AiTextAnalysisSchema,
  buildPhotoAnalysisPrompt,
  buildTextAnalysisPrompt,
  mergeAiPhotoAnalysis,
  mergeAiTextAnalysis,
} from '@kaufcheck/domain';
import {
  ERROR_MESSAGES,
  type AiInfo,
  type AnalysisResult,
  type NormalizedListing,
  type PhotoAnalysis,
} from '@kaufcheck/shared';
import type { FastifyBaseLogger } from 'fastify';
import { downloadListingImages } from '../infrastructure/ai/listing-images';
import { AiProviderError, type AiProvider } from '../infrastructure/ai/types';
import type { Resolver } from '../infrastructure/net/safe-fetch';
import { Semaphore } from '../lib/rate-limiter';
import { TtlCache } from '../lib/ttl-cache';

export interface AiEnricherOptions {
  timeoutMs: number;
  maxConcurrency: number;
  photoAnalysis: boolean;
  maxPhotos: number;
  imageUserAgent: string;
  imageTimeoutMs: number;
  resolver?: Resolver;
}

export interface EnrichmentInput {
  listing: NormalizedListing;
  result: AnalysisResult;
  /** Photo analysis is a Pro feature. */
  photosAllowed: boolean;
  signal: AbortSignal;
  /** Reuse raw provider output for identical input (used for the fictional example). */
  cacheKey?: string;
}

interface RawOutput {
  text: PromiseSettledResult<unknown>;
  photos: PromiseSettledResult<{ data: unknown; listingIndexes: number[] } | null>;
  wantsPhotos: boolean;
}

const TEXT_MAX_TOKENS = 16_000;
const PHOTO_MAX_TOKENS = 8_000;

/**
 * Optional AI step on top of the rule-based result. Any failure degrades to
 * the rule-based result with an honest status – the analysis never fails
 * because of the AI.
 */
export class AiEnricher {
  private readonly semaphore: Semaphore;
  private readonly cache = new TtlCache<RawOutput>(6 * 60 * 60 * 1000, 20);

  constructor(
    private readonly provider: AiProvider,
    private readonly options: AiEnricherOptions,
    private readonly logger: FastifyBaseLogger,
  ) {
    this.semaphore = new Semaphore(options.maxConcurrency);
  }

  get providerName(): string {
    return this.provider.name;
  }

  get model(): string {
    return this.provider.model;
  }

  get isMock(): boolean {
    return this.provider.isMock;
  }

  get photoAnalysisAvailable(): boolean {
    return this.options.photoAnalysis && this.provider.supportsVision;
  }

  hasCached(cacheKey: string | undefined): boolean {
    return cacheKey !== undefined && this.cache.get(cacheKey) !== undefined;
  }

  private info(status: AiInfo['status'], message: string | null): AiInfo {
    return { status, provider: this.provider.name, model: this.provider.model, isMock: this.provider.isMock, message };
  }

  async enrich({ listing, result, photosAllowed, signal, cacheKey }: EnrichmentInput): Promise<AnalysisResult> {
    const cached = cacheKey ? this.cache.get(cacheKey) : undefined;
    if (cached) return this.apply(cached, listing, result);

    const release = this.semaphore.tryAcquire();
    if (!release) {
      return {
        ...result,
        ai: this.info('skipped', 'Die KI-Einschätzung wurde wegen hoher Auslastung übersprungen.'),
      };
    }
    try {
      const wantsPhotos = photosAllowed && this.photoAnalysisAvailable && listing.images.length > 0;
      const [text, photos] = await Promise.allSettled([
        this.runText(listing, result, signal),
        wantsPhotos ? this.runPhotos(listing, signal) : Promise.resolve(null),
      ]);
      signal.throwIfAborted();
      const raw: RawOutput = { text, photos, wantsPhotos };
      if (cacheKey && text.status === 'fulfilled') this.cache.set(cacheKey, raw);
      return this.apply(raw, listing, result);
    } finally {
      release();
    }
  }

  private apply(raw: RawOutput, listing: NormalizedListing, result: AnalysisResult): AnalysisResult {
    let enriched = result;
    let ai: AiInfo;
    if (raw.text.status === 'fulfilled') {
      const merged = mergeAiTextAnalysis(enriched, raw.text.value, listing);
      if (merged) {
        enriched = merged.result;
        ai = this.info('completed', null);
        this.logger.info({ op: 'ai.text', provider: this.provider.name, ...merged.report }, 'ai text analysis merged');
      } else {
        ai = this.info('failed', ERROR_MESSAGES.AI_OUTPUT_INVALID);
        this.logger.warn({ op: 'ai.text', errorCategory: 'AI_OUTPUT_INVALID' }, 'ai output rejected');
      }
    } else {
      ai = this.failure(raw.text.reason, 'ai.text');
    }
    enriched = { ...enriched, ai };
    if (raw.wantsPhotos) enriched = this.applyPhotos(enriched, listing, raw.photos);
    return enriched;
  }

  private async runText(listing: NormalizedListing, result: AnalysisResult, signal: AbortSignal): Promise<unknown> {
    const prompt = buildTextAnalysisPrompt(
      listing,
      result,
      result.sellerQuestions.map((question) => question.text),
    );
    const response = await this.provider.generateStructuredAnalysis({
      task: 'listing_text',
      system: prompt.system,
      prompt: prompt.user,
      schema: AiTextAnalysisSchema,
      schemaName: 'listing_analysis',
      maxOutputTokens: TEXT_MAX_TOKENS,
      timeoutMs: this.options.timeoutMs,
      signal,
    });
    return response.data;
  }

  private async runPhotos(
    listing: NormalizedListing,
    signal: AbortSignal,
  ): Promise<{ data: unknown; listingIndexes: number[] } | null> {
    const images = await downloadListingImages(listing.images, {
      max: this.options.maxPhotos,
      userAgent: this.options.imageUserAgent,
      timeoutMs: this.options.imageTimeoutMs,
      signal,
      resolver: this.options.resolver,
    });
    if (images.length === 0) return null;
    const prompt = buildPhotoAnalysisPrompt(listing, images.length);
    const response = await this.provider.generateStructuredAnalysis({
      task: 'listing_photos',
      system: prompt.system,
      prompt: prompt.user,
      images,
      schema: AiPhotoAnalysisSchema,
      schemaName: 'listing_photos',
      maxOutputTokens: PHOTO_MAX_TOKENS,
      timeoutMs: this.options.timeoutMs,
      signal,
    });
    return { data: response.data, listingIndexes: images.map((image) => image.listingIndex) };
  }

  private applyPhotos(
    result: AnalysisResult,
    listing: NormalizedListing,
    outcome: PromiseSettledResult<{ data: unknown; listingIndexes: number[] } | null>,
  ): AnalysisResult {
    const failed = (message: string): AnalysisResult => ({
      ...result,
      photoAnalysis: { status: 'failed', message, findings: [], analyzedImageCount: 0 } satisfies PhotoAnalysis,
    });
    if (outcome.status === 'rejected') {
      this.failure(outcome.reason, 'ai.photos');
      return failed('Die Fotoanalyse ist fehlgeschlagen. Die übrige Analyse ist davon nicht betroffen.');
    }
    if (!outcome.value) return failed('Die Fotos konnten für die Analyse nicht geladen werden.');

    // The model numbers the images it received; map them back to the listing's photo positions.
    const parsed = AiPhotoAnalysisSchema.safeParse(outcome.value.data);
    if (!parsed.success) return failed('Die Fotoanalyse lieferte kein verwertbares Ergebnis.');
    const indexes = outcome.value.listingIndexes;
    const remapped = {
      findings: parsed.data.findings
        .filter((finding) => finding.imageIndex < indexes.length)
        .map((finding) => ({ ...finding, imageIndex: indexes[finding.imageIndex] ?? 0 })),
      odometer:
        parsed.data.odometer && parsed.data.odometer.imageIndex < indexes.length
          ? { ...parsed.data.odometer, imageIndex: indexes[parsed.data.odometer.imageIndex] ?? 0 }
          : null,
    };
    const merged = mergeAiPhotoAnalysis(result, remapped, listing, listing.images.length);
    if (!merged) return failed('Die Fotoanalyse lieferte kein verwertbares Ergebnis.');
    return {
      ...merged.result,
      photoAnalysis: { ...merged.result.photoAnalysis, analyzedImageCount: indexes.length },
    };
  }

  private failure(reason: unknown, op: string): AiInfo {
    if (reason instanceof DOMException && reason.name === 'AbortError') throw reason;
    const error = reason instanceof AiProviderError ? reason : null;
    if (error?.reason === 'aborted') throw error;
    this.logger.warn(
      { op, provider: this.provider.name, errorCategory: error?.reason ?? 'unknown' },
      'ai step failed',
    );
    return this.info(
      'failed',
      error?.isOutputProblem ? ERROR_MESSAGES.AI_OUTPUT_INVALID : ERROR_MESSAGES.AI_ANALYSIS_FAILED,
    );
  }
}
