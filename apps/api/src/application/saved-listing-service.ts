import { buildComparison, type ComparisonInput } from '@kaufcheck/domain';
import {
  AnalysisResultSchema,
  type AnalysisDto,
  type ComparisonDto,
  type SavedListingDto,
  type SavedListingsResponse,
} from '@kaufcheck/shared';
import type { Db } from '../infrastructure/db/client';
import { AppError } from '../lib/errors';
import { analysisFromRow, isUuid } from '../repositories/analysis-repository';
import { listingFromRow, sourceTypeFromDb } from '../repositories/listing-mapper';
import type { Actor } from './actor';
import type { AnalysisRunContext, AnalysisService } from './analysis-service';
import type { AnalyticsService } from './analytics-service';

const StoredSummarySchema = AnalysisResultSchema.pick({ vehicleSummary: true, priceContext: true });

function requireUser(actor: Actor): string {
  if (!actor.userId)
    throw new AppError('UNAUTHENTICATED', {
      message: 'Melde dich an, um Angebote zu speichern und zu vergleichen.',
    });
  return actor.userId;
}

const SAVED_INCLUDE = {
  listing: { select: { title: true, sourceType: true, sourceUrl: true, isExample: true } },
  analysis: { select: { id: true, createdAt: true, completenessScore: true, result: true } },
} as const;

type SavedRow = Awaited<ReturnType<Db['savedListing']['findFirstOrThrow']>> & {
  listing: {
    title: string | null;
    sourceType: 'KLEINANZEIGEN_URL' | 'TEXT' | 'EXAMPLE';
    sourceUrl: string | null;
    isExample: boolean;
  };
  analysis: { id: string; createdAt: Date; completenessScore: number; result: unknown };
};

function toDto(row: SavedRow): SavedListingDto {
  const summary = StoredSummarySchema.safeParse(row.analysis.result);
  const listingTitle = summary.success
    ? (summary.data.vehicleSummary?.title ?? row.listing.title)
    : row.listing.title;
  return {
    id: row.id,
    title: row.customTitle ?? listingTitle ?? 'Gespeichertes Angebot',
    customTitle: row.customTitle,
    listingTitle,
    analysisId: row.analysis.id,
    analyzedAt: row.analysis.createdAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    priceDisplay: summary.success ? (summary.data.priceContext.askingPrice?.display ?? null) : null,
    chips: summary.success
      ? (summary.data.vehicleSummary?.chips
          .filter((chip) => chip.key !== 'price')
          .map((chip) => chip.text) ?? [])
      : [],
    completenessScore: row.analysis.completenessScore,
    sourceType: sourceTypeFromDb(row.listing.sourceType),
    sourceUrl: row.listing.sourceUrl,
    isExample: row.listing.isExample,
    canReanalyze: true,
  };
}

export class SavedListingService {
  constructor(
    private readonly db: Db,
    private readonly analyses: AnalysisService,
    private readonly analytics: AnalyticsService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async list(actor: Actor): Promise<SavedListingsResponse> {
    const userId = requireUser(actor);
    const rows = await this.db.savedListing.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: SAVED_INCLUDE,
    });
    return { items: rows.map(toDto), limit: actor.entitlements.savedListingsMax };
  }

  async save(
    actor: Actor,
    analysisId: string,
    title: string | undefined,
  ): Promise<SavedListingDto> {
    const userId = requireUser(actor);
    const max = actor.entitlements.savedListingsMax;
    if (max === 0)
      throw new AppError('PLAN_LIMIT_REACHED', {
        message: 'Mit deinem Tarif kannst du keine Angebote speichern.',
      });
    if (!isUuid(analysisId))
      throw new AppError('NOT_FOUND', { message: 'Diese Analyse gibt es nicht.' });

    const analysis = await this.db.analysis.findUnique({
      where: { id: analysisId },
      select: { id: true, listingId: true, listing: { select: { fingerprint: true } } },
    });
    if (!analysis) throw new AppError('NOT_FOUND', { message: 'Diese Analyse gibt es nicht.' });
    const fingerprint = analysis.listing.fingerprint;

    const existing = await this.db.savedListing.findUnique({
      where: { userId_fingerprint: { userId, fingerprint } },
      select: { id: true },
    });
    if (!existing) {
      const count = await this.db.savedListing.count({ where: { userId } });
      if (count >= max) {
        throw new AppError('PLAN_LIMIT_REACHED', {
          message: `Mit deinem Tarif kannst du bis zu ${max} Angebote speichern. Lösche ein gespeichertes Angebot oder wechsle zu Pro.`,
          details: { limit: max, used: count },
        });
      }
    }

    const row = await this.db.savedListing.upsert({
      where: { userId_fingerprint: { userId, fingerprint } },
      create: {
        userId,
        fingerprint,
        listingId: analysis.listingId,
        analysisId: analysis.id,
        customTitle: title || null,
      },
      update: {
        listingId: analysis.listingId,
        analysisId: analysis.id,
        ...(title ? { customTitle: title } : {}),
      },
      include: SAVED_INCLUDE,
    });
    this.analytics.track('listing_saved', { plan: actor.plan });
    return toDto(row);
  }

  async rename(actor: Actor, id: string, title: string | null): Promise<SavedListingDto> {
    const userId = requireUser(actor);
    if (!isUuid(id)) throw new AppError('NOT_FOUND');
    const updated = await this.db.savedListing.updateMany({
      where: { id, userId },
      data: { customTitle: title || null },
    });
    if (updated.count === 0) throw new AppError('NOT_FOUND');
    const row = await this.db.savedListing.findUniqueOrThrow({
      where: { id },
      include: SAVED_INCLUDE,
    });
    return toDto(row);
  }

  async remove(actor: Actor, id: string): Promise<void> {
    const userId = requireUser(actor);
    if (!isUuid(id)) throw new AppError('NOT_FOUND');
    const deleted = await this.db.savedListing.deleteMany({ where: { id, userId } });
    if (deleted.count === 0) throw new AppError('NOT_FOUND');
  }

  /**
   * Re-analysis: listings from a URL are retrieved again (fresh data);
   * pasted and example listings are analysed again from the stored snapshot.
   */
  async reanalyze(
    actor: Actor,
    id: string,
    ctx: Omit<AnalysisRunContext, 'actor'>,
  ): Promise<AnalysisDto> {
    const userId = requireUser(actor);
    if (!isUuid(id)) throw new AppError('NOT_FOUND');
    const saved = await this.db.savedListing.findFirst({
      where: { id, userId },
      include: { listing: { include: { vehicle: true } } },
    });
    if (!saved) throw new AppError('NOT_FOUND');

    const { id: _listingId, ...stored } = listingFromRow(saved.listing);
    const dto =
      stored.source.type === 'kleinanzeigen_url' && stored.source.url
        ? await this.analyses.run({ kind: 'url', url: stored.source.url }, { ...ctx, actor })
        : stored.source.isExample
          ? await this.analyses.run(
              { kind: 'example', exampleId: stored.source.externalId ?? undefined },
              { ...ctx, actor },
            )
          : await this.analyses.run({ kind: 'stored', listing: stored }, { ...ctx, actor });

    const fingerprint = await this.db.listing.findUniqueOrThrow({
      where: { id: dto.listing.id },
      select: { fingerprint: true },
    });
    // If the offer changed its identity (e.g. new ad id), keep the saved entry pointing at the new analysis anyway.
    await this.db.savedListing
      .update({
        where: { id: saved.id },
        data: {
          analysisId: dto.id,
          listingId: dto.listing.id,
          fingerprint: fingerprint.fingerprint,
        },
      })
      .catch(async () => {
        // Unique conflict: the new fingerprint is already saved separately – just refresh that entry.
        await this.db.savedListing.updateMany({
          where: { userId, fingerprint: fingerprint.fingerprint },
          data: { analysisId: dto.id, listingId: dto.listing.id },
        });
      });
    return { ...dto, savedListingId: saved.id };
  }

  async compare(actor: Actor, savedListingIds: readonly string[]): Promise<ComparisonDto> {
    const userId = requireUser(actor);
    const max = actor.entitlements.compareMax;
    const ids = [...new Set(savedListingIds)];
    if (max === 0)
      throw new AppError('PLAN_LIMIT_REACHED', {
        message: 'Vergleiche sind mit einem Konto verfügbar.',
      });
    if (ids.length < 2)
      throw new AppError('VALIDATION_ERROR', {
        message: 'Wähle mindestens zwei Angebote zum Vergleichen aus.',
      });
    if (ids.length > max) {
      throw new AppError('PLAN_LIMIT_REACHED', {
        message: `Mit deinem Tarif kannst du bis zu ${max} Angebote gleichzeitig vergleichen.`,
        details: { limit: max },
      });
    }
    if (!ids.every(isUuid)) throw new AppError('NOT_FOUND');

    const rows = await this.db.savedListing.findMany({
      where: { userId, id: { in: ids } },
      include: {
        listing: { include: { vehicle: true } },
        analysis: {
          include: {
            listing: { include: { vehicle: true } },
            sellerQuestions: { orderBy: { position: 'asc' } },
          },
        },
      },
    });
    if (rows.length !== ids.length)
      throw new AppError('NOT_FOUND', { message: 'Mindestens ein Angebot wurde nicht gefunden.' });

    const byId = new Map(rows.map((row) => [row.id, row]));
    const items: ComparisonInput[] = ids.map((savedId) => {
      const row = byId.get(savedId);
      if (!row) throw new AppError('NOT_FOUND');
      const analysis = analysisFromRow(row.analysis);
      const { id: _listingId, ...listing } = listingFromRow(row.analysis.listing);
      return {
        savedListingId: row.id,
        analysisId: row.analysis.id,
        title: row.customTitle ?? analysis.vehicleSummary?.title ?? listing.title ?? 'Angebot',
        listing,
        analysis,
      };
    });
    this.analytics.track('comparison_created', { count: items.length, plan: actor.plan });
    return buildComparison(items, this.now());
  }
}
