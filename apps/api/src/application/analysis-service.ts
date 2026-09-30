import {
  getAnalyzer,
  getExampleListing,
  parseListingText,
  prepareListing,
  DEFAULT_EXAMPLE_ID,
} from '@kaufcheck/domain';
import {
  recognizeListingUrl,
  type AnalysisDto,
  type AnalysisResult,
  type AnalysisStage,
  type ListingSource,
  type NormalizedListing,
} from '@kaufcheck/shared';
import type { FastifyBaseLogger } from 'fastify';
import type { ListingUrlRetriever, RetrievedListing } from '../infrastructure/listing-sources/types';
import type { Db } from '../infrastructure/db/client';
import { AppError, isAppError } from '../lib/errors';
import { AnalysisRepository } from '../repositories/analysis-repository';
import { listingFingerprint } from '../repositories/listing-mapper';
import type { Actor } from './actor';
import type { AiEnricher } from './ai-enricher';
import type { AnalyticsService } from './analytics-service';
import type { UsageReservation, UsageService } from './usage-service';

export type AnalysisInput =
  | { kind: 'url'; url: string }
  | { kind: 'text'; text: string; url?: string }
  | { kind: 'example'; exampleId?: string }
  | { kind: 'stored'; listing: NormalizedListing };

export interface AnalysisRunContext {
  actor: Actor;
  signal: AbortSignal;
  onStage?: (stage: AnalysisStage, status: 'started' | 'completed') => void;
}

export interface AnalysisServiceDeps {
  db: Db;
  retriever: ListingUrlRetriever;
  enricher: AiEnricher | null;
  usage: UsageService;
  analytics: AnalyticsService;
  logger: FastifyBaseLogger;
  now?: () => Date;
}

function sourceLabel(input: AnalysisInput): 'url' | 'text' | 'example' | 'reanalysis' {
  return input.kind === 'stored' ? 'reanalysis' : input.kind;
}

function ensureNotAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new AppError('REQUEST_ABORTED');
}

/**
 * The listing analysis pipeline:
 * validate → retrieve → extract → analyze (rules) → questions (rules) → ai (optional) → persist.
 * Each stage is reported when it really starts and completes.
 */
export class AnalysisService {
  private readonly repository: AnalysisRepository;
  private readonly now: () => Date;

  constructor(private readonly deps: AnalysisServiceDeps) {
    this.repository = new AnalysisRepository(deps.db);
    this.now = deps.now ?? (() => new Date());
  }

  get analyses(): AnalysisRepository {
    return this.repository;
  }

  async run(input: AnalysisInput, ctx: AnalysisRunContext): Promise<AnalysisDto> {
    const started = Date.now();
    const source = sourceLabel(input);
    this.deps.analytics.track('listing_analysis_started', { source });
    try {
      const dto = await this.execute(input, ctx);
      this.deps.analytics.track('listing_analysis_completed', { source, aiStatus: dto.analysis.ai.status });
      this.deps.logger.info(
        {
          op: 'listing.analyze',
          source,
          success: true,
          durationMs: Date.now() - started,
          aiStatus: dto.analysis.ai.status,
          analysisId: dto.id,
        },
        'analysis completed',
      );
      return dto;
    } catch (error) {
      const appError = isAppError(error)
        ? error
        : ctx.signal.aborted
          ? new AppError('REQUEST_ABORTED')
          : new AppError('INTERNAL_ERROR', { cause: error });
      if (appError.code !== 'REQUEST_ABORTED') {
        this.deps.analytics.track('listing_analysis_failed', { source, errorCode: appError.code });
      }
      const level = appError.code === 'INTERNAL_ERROR' ? 'error' : 'info';
      this.deps.logger[level](
        {
          op: 'listing.analyze',
          source,
          success: false,
          durationMs: Date.now() - started,
          errorCategory: appError.code,
          reason: appError.internalReason,
          ...(appError.code === 'INTERNAL_ERROR' ? { err: error } : {}),
        },
        'analysis failed',
      );
      throw appError;
    }
  }

  private async stage<T>(ctx: AnalysisRunContext, stage: AnalysisStage, work: () => Promise<T> | T): Promise<T> {
    ensureNotAborted(ctx.signal);
    ctx.onStage?.(stage, 'started');
    const value = await work();
    ensureNotAborted(ctx.signal);
    ctx.onStage?.(stage, 'completed');
    return value;
  }

  private async execute(input: AnalysisInput, ctx: AnalysisRunContext): Promise<AnalysisDto> {
    const { actor } = ctx;
    const quota: { reservation: UsageReservation | null } = { reservation: null };

    try {
      // 1. Validate input and reserve quota (the fictional example is free).
      const recognized = await this.stage(ctx, 'validate', async () => {
        let url = null;
        if (input.kind === 'url') {
          const recognition = recognizeListingUrl(input.url);
          if (!recognition.ok) {
            if (recognition.reason === 'unsupported_host') {
              throw new AppError('UNSUPPORTED_SOURCE', {
                details: { fallbackToText: true },
                internalReason: 'unsupported_host',
              });
            }
            throw new AppError('INVALID_URL', { internalReason: recognition.reason });
          }
          url = recognition;
        }
        if (input.kind !== 'example') quota.reservation = await this.deps.usage.reserve(actor);
        return url;
      });

      // 2. Retrieve.
      const retrieved = await this.stage(
        ctx,
        'retrieve',
        (): Promise<RetrievedListing | { listing: NormalizedListing }> => {
          switch (input.kind) {
            case 'url':
              if (!recognized) throw new AppError('INVALID_URL');
              return this.deps.retriever.retrieve(recognized, ctx.signal);
            case 'text':
              return Promise.resolve(this.fromText(input.text, input.url));
            case 'example':
              return Promise.resolve(this.fromExample(input.exampleId));
            case 'stored':
              return Promise.resolve({ listing: input.listing });
          }
        },
      );

      // 3. Extract structured information and detect the category.
      const listing = await this.stage(ctx, 'extract', () => {
        if ('listing' in retrieved) return retrieved.listing;
        const prepared = prepareListing(retrieved);
        if (!prepared.ok) {
          if (prepared.reason === 'no_content') {
            throw new AppError('PARSING_FAILED', { details: { fallbackToText: input.kind === 'url' } });
          }
          throw new AppError('UNSUPPORTED_CATEGORY', {
            message:
              prepared.reason === 'unsupported_vehicle_kind'
                ? 'KaufCheck prüft derzeit nur Autos. Motorräder, Wohnmobile, Nutzfahrzeuge und Teile werden noch nicht unterstützt.'
                : 'Das sieht nicht nach einem Auto-Inserat aus. KaufCheck prüft derzeit nur Autos.',
            internalReason: prepared.detection?.vehicleKind ?? 'no_category',
          });
        }
        return prepared.listing;
      });

      const exampleId = input.kind === 'example' ? (input.exampleId ?? DEFAULT_EXAMPLE_ID) : undefined;
      const fingerprint = listingFingerprint(listing, exampleId);
      const analyzer = getAnalyzer(listing.category);
      if (!analyzer) throw new AppError('UNSUPPORTED_CATEGORY');
      const now = this.now();

      // 4. Rule-based assessment, including verified comparables for price context.
      const { assessment, context } = await this.stage(ctx, 'analyze', async () => {
        const market = listing.source.isExample
          ? null
          : await this.repository.findComparables(listing, fingerprint, now);
        const analysisContext = { now, market };
        return { assessment: analyzer.assess(listing, analysisContext), context: analysisContext };
      });

      // 5. Seller questions and inspection checklist.
      const preparation = await this.stage(ctx, 'questions', () =>
        analyzer.prepareBuyerQuestions(listing, assessment, context),
      );
      let result: AnalysisResult = { ...assessment, ...preparation };

      // 6. Optional AI enrichment. For the fictional example the raw AI output is
      //    cached, so repeated demo clicks do not cause provider calls.
      const enricher = this.deps.enricher;
      if (enricher) {
        const cacheKey = exampleId ? `${exampleId}:${analyzer.rulesVersion}` : undefined;
        const enrich = () =>
          enricher.enrich({
            listing,
            result,
            photosAllowed: actor.entitlements.photoAnalysis,
            signal: ctx.signal,
            cacheKey,
          });
        result = enricher.hasCached(cacheKey) ? await enrich() : await this.stage(ctx, 'ai', enrich);
      } else {
        result = {
          ...result,
          ai: { status: 'not_configured', provider: null, model: null, isMock: false, message: null },
        };
      }
      result = this.finalizePhotoStatus(result, listing, actor);

      // 7. Persist – unless the client has gone away.
      ensureNotAborted(ctx.signal);
      const owner = { userId: actor.userId, anonymousId: actor.anonymousId };
      const stored = await this.repository.create({ listing, fingerprint, result, owner });
      const saved = actor.userId
        ? await this.deps.db.savedListing.findUnique({
            where: { userId_fingerprint: { userId: actor.userId, fingerprint } },
            select: { id: true },
          })
        : null;

      return {
        id: stored.analysisId,
        createdAt: stored.createdAt.toISOString(),
        listing: { ...listing, id: stored.listingId },
        vehicle: listing.vehicle,
        analysis: result,
        savedListingId: saved?.id ?? null,
      };
    } catch (error) {
      await quota.reservation?.release().catch(() => undefined);
      throw error;
    }
  }

  private fromText(text: string, url: string | undefined): RetrievedListing {
    const reference = url ? recognizeListingUrl(url) : recognizeListingUrl(text);
    const parsed = parseListingText(text);
    const source: ListingSource = {
      type: 'text',
      url: reference.ok ? reference.canonicalUrl : null,
      externalId: parsed.externalId ?? (reference.ok ? reference.externalId : null),
      retrievedAt: this.now().toISOString(),
      isExample: false,
    };
    return { parsed, source, urlCategoryId: reference.ok ? reference.categoryId : null };
  }

  private fromExample(exampleId: string | undefined): RetrievedListing {
    const example = getExampleListing(exampleId ?? DEFAULT_EXAMPLE_ID);
    if (!example) throw new AppError('NOT_FOUND', { message: 'Dieses Beispiel gibt es nicht.' });
    const parsed = parseListingText(example.text);
    return {
      parsed,
      urlCategoryId: null,
      source: {
        type: 'example',
        url: null,
        externalId: example.id,
        retrievedAt: this.now().toISOString(),
        isExample: true,
      },
    };
  }

  /** Makes the photo status explicit when no photo analysis ran. */
  private finalizePhotoStatus(result: AnalysisResult, listing: NormalizedListing, actor: Actor): AnalysisResult {
    if (result.photoAnalysis.status !== 'not_configured' || listing.images.length === 0) return result;
    const enricher = this.deps.enricher;
    if (!enricher || !enricher.photoAnalysisAvailable) {
      return {
        ...result,
        photoAnalysis: {
          ...result.photoAnalysis,
          message: 'Die automatische Fotoanalyse ist auf diesem Server nicht aktiviert.',
        },
      };
    }
    if (!actor.entitlements.photoAnalysis) {
      return {
        ...result,
        photoAnalysis: {
          status: 'not_in_plan',
          message: 'Die Fotoanalyse ist in KaufCheck Pro enthalten.',
          findings: [],
          analyzedImageCount: 0,
        },
      };
    }
    return result;
  }
}
