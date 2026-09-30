import { formatKm, type MarketData } from '@kaufcheck/domain';
import {
  AnalysisResultSchema,
  OriginSchema,
  type AnalysisDto,
  type AnalysisListItem,
  type AnalysisResult,
  type NormalizedListing,
  type SellerQuestion,
} from '@kaufcheck/shared';
import type { Db } from '../infrastructure/db/client';
import type {
  Analysis,
  Listing,
  SellerQuestion as SellerQuestionRow,
  Vehicle,
} from '../generated/prisma/client';
import { listingFromRow, sourceTypeFromDb, toListingCreate } from './listing-mapper';

const StoredResultSchema = AnalysisResultSchema.omit({ sellerQuestions: true });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID.test(value);
}

export interface AnalysisOwner {
  userId: string | null;
  anonymousId: string | null;
}

type AnalysisRow = Analysis & {
  listing: Listing & { vehicle: Vehicle | null };
  sellerQuestions: SellerQuestionRow[];
};

function questionFromRow(row: SellerQuestionRow): SellerQuestion {
  return {
    id: row.key,
    text: row.text,
    textInformal: row.textInformal,
    reason: row.reason,
    priority: Math.min(3, Math.max(1, row.priority)),
    relatedField: row.relatedField,
    origin: OriginSchema.catch('rules').parse(row.origin),
  };
}

export function analysisFromRow(row: AnalysisRow): AnalysisResult {
  const stored = StoredResultSchema.parse(row.result);
  return { ...stored, sellerQuestions: row.sellerQuestions.map(questionFromRow) };
}

export function toAnalysisDto(row: AnalysisRow, savedListingId: string | null): AnalysisDto {
  const listing = listingFromRow(row.listing);
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    listing,
    vehicle: listing.vehicle,
    analysis: analysisFromRow(row),
    savedListingId,
  };
}

const INCLUDE = {
  listing: { include: { vehicle: true } },
  sellerQuestions: { orderBy: { position: 'asc' } },
} as const;

export class AnalysisRepository {
  constructor(private readonly db: Db) {}

  /** Stores listing snapshot, vehicle, analysis and questions atomically. */
  async create(input: {
    listing: NormalizedListing;
    fingerprint: string;
    result: AnalysisResult;
    owner: AnalysisOwner;
  }): Promise<{ analysisId: string; listingId: string; createdAt: Date }> {
    const { sellerQuestions, ...stored } = input.result;
    return this.db.$transaction(async (tx) => {
      const listing = await tx.listing.create({
        data: toListingCreate(input.listing, input.fingerprint),
        select: { id: true },
      });
      const analysis = await tx.analysis.create({
        data: {
          listingId: listing.id,
          userId: input.owner.userId,
          anonymousId: input.owner.userId ? null : input.owner.anonymousId,
          rulesVersion: input.result.rulesVersion,
          aiStatus: input.result.ai.status,
          aiProvider: input.result.ai.provider,
          aiModel: input.result.ai.model,
          completenessScore: input.result.completeness.score,
          result: stored,
          sellerQuestions: {
            createMany: {
              data: sellerQuestions.map((question, position) => ({
                key: question.id,
                position,
                text: question.text,
                textInformal: question.textInformal,
                reason: question.reason,
                priority: question.priority,
                relatedField: question.relatedField,
                origin: question.origin,
              })),
            },
          },
        },
        select: { id: true, createdAt: true },
      });
      return { analysisId: analysis.id, listingId: listing.id, createdAt: analysis.createdAt };
    });
  }

  async findRow(id: string): Promise<AnalysisRow | null> {
    if (!isUuid(id)) return null;
    return this.db.analysis.findUnique({ where: { id }, include: INCLUDE });
  }

  /**
   * Analyses are reachable by their unguessable id (like a private link),
   * so a result can be reopened and shared.
   */
  async findDto(id: string, viewerUserId: string | null): Promise<AnalysisDto | null> {
    const row = await this.findRow(id);
    if (!row) return null;
    const saved = viewerUserId
      ? await this.db.savedListing.findUnique({
          where: {
            userId_fingerprint: { userId: viewerUserId, fingerprint: row.listing.fingerprint },
          },
          select: { id: true },
        })
      : null;
    return toAnalysisDto(row, saved?.id ?? null);
  }

  async listForUser(userId: string, limit = 50): Promise<AnalysisListItem[]> {
    const rows = await this.db.analysis.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { listing: { select: { sourceType: true, isExample: true, title: true } } },
    });
    return rows.map((row) => {
      const result = StoredResultSchema.safeParse(row.result);
      return {
        id: row.id,
        createdAt: row.createdAt.toISOString(),
        title:
          (result.success ? result.data.vehicleSummary?.title : null) ??
          row.listing.title ??
          'Inserat',
        priceDisplay: result.success
          ? (result.data.priceContext.askingPrice?.display ?? null)
          : null,
        chips: result.success
          ? (result.data.vehicleSummary?.chips
              .filter((chip) => chip.key !== 'price')
              .map((chip) => chip.text) ?? [])
          : [],
        completenessScore: row.completenessScore,
        sourceType: sourceTypeFromDb(row.listing.sourceType),
        isExample: row.listing.isExample,
      };
    });
  }

  /** After login/registration, analyses made anonymously in this browser belong to the account. */
  async attachAnonymousToUser(anonymousId: string, userId: string): Promise<number> {
    const result = await this.db.analysis.updateMany({
      where: { anonymousId, userId: null },
      data: { userId, anonymousId: null },
    });
    return result.count;
  }

  /**
   * Comparable listings for price context. Only listings that were actually
   * retrieved from Kleinanzeigen count (never pasted text or examples), one
   * snapshot per offer, similar model, age and mileage, last 90 days.
   */
  async findComparables(
    listing: NormalizedListing,
    fingerprint: string,
    now: Date,
  ): Promise<MarketData | null> {
    const vehicle = listing.vehicle;
    if (
      !vehicle?.make ||
      !vehicle.model ||
      !vehicle.firstRegistration ||
      vehicle.mileageKm === null
    )
      return null;
    const year = vehicle.firstRegistration.year;
    const minKm = Math.round(vehicle.mileageKm * 0.7);
    const maxKm = Math.round(vehicle.mileageKm * 1.3);
    const since = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const rows = await this.db.$queryRaw<{ priceEur: number }[]>`
      SELECT DISTINCT ON (l.fingerprint) l."priceEur"
      FROM "Listing" l
      JOIN "Vehicle" v ON v."listingId" = l.id
      WHERE l."sourceType" = 'KLEINANZEIGEN_URL'
        AND l."isExample" = false
        AND l."retrievedAt" >= ${since}
        AND l.fingerprint <> ${fingerprint}
        AND l."priceEur" IS NOT NULL AND l."priceEur" >= 100
        AND lower(v.make) = lower(${vehicle.make})
        AND lower(v.model) = lower(${vehicle.model})
        AND v."firstRegistrationYear" BETWEEN ${year - 2} AND ${year + 2}
        AND v."mileageKm" BETWEEN ${minKm} AND ${maxKm}
      ORDER BY l.fingerprint, l."retrievedAt" DESC
      LIMIT 500`;

    return {
      comparables: rows.map((row) => ({ priceEur: Number(row.priceEur) })),
      criteria: `${vehicle.make} ${vehicle.model}, Erstzulassung ${year - 2}–${year + 2}, ${formatKm(minKm)} bis ${formatKm(maxKm)}`,
      source:
        'Über KaufCheck abgerufene Kleinanzeigen-Inserate der letzten 90 Tage. Das ist keine repräsentative Marktanalyse.',
    };
  }
}
