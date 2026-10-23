import { decimalRegistration, formatKm, NBSP, type MarketData } from '@kaufcheck/domain';
import {
  AnalysisResultSchema,
  FUEL_LABELS,
  OriginSchema,
  type AnalysisDto,
  type AnalysisListItem,
  type AnalysisResult,
  type NormalizedListing,
  type SellerQuestion,
} from '@kaufcheck/shared';
import type { Db } from '../infrastructure/db/client';
import {
  Prisma,
  type Analysis,
  type Listing,
  type SellerQuestion as SellerQuestionRow,
  type Vehicle,
} from '../generated/prisma/client';
import { listingFromRow, sourceTypeFromDb, toListingCreate } from './listing-mapper';

const StoredResultSchema = AnalysisResultSchema.omit({ sellerQuestions: true });

/** Like the default retention of anonymous checks (`ANON_RETENTION_DAYS`): older prices say little. */
const COMPARABLE_DAYS = 90;

/** So that one visitor cannot tip the comparison alone. */
const MAX_COMPARABLES_PER_VISITOR = 10;

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
   * Comparable offers for the price verdict: listings checked with KaufCheck
   * in the last 90 days, retrieved or pasted, never examples. Each car counts
   * once with its latest price (same make, model, registration, mileage and
   * postcode), at most ten per visitor, so nobody tips the comparison alone.
   * Damaged cars, cars sold as defective and placeholder prices stay out.
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
    const month = vehicle.firstRegistration.month ?? 0;
    // ±30 %, at least ±10,000 km for cars with few kilometres.
    const minKm = Math.max(
      0,
      Math.round(Math.min(vehicle.mileageKm * 0.7, vehicle.mileageKm - 10_000)),
    );
    const maxKm = Math.round(Math.max(vehicle.mileageKm * 1.3, vehicle.mileageKm + 10_000));
    const since = new Date(now.getTime() - COMPARABLE_DAYS * 24 * 60 * 60 * 1000);
    const fuel = vehicle.fuel;
    const kw = vehicle.powerKw;
    const minKw = kw === null ? null : Math.round(kw * 0.8);
    const maxKw = kw === null ? null : Math.round(kw * 1.2);

    const rows = await this.db.$queryRaw<
      { priceEur: number; year: number; month: number | null; km: number }[]
    >`
      WITH latest AS (
        SELECT DISTINCT ON (lower(v.make), lower(v.model), v."firstRegistrationYear",
                            coalesce(v."firstRegistrationMonth", 0), v."mileageKm",
                            coalesce(l."postalCode", ''))
          l."priceEur", v."firstRegistrationYear" AS year, v."firstRegistrationMonth" AS month,
          v."mileageKm" AS km, l."retrievedAt",
          coalesce(a."userId"::text, a."anonymousId", l.id::text) AS owner
        FROM "Listing" l
        JOIN "Vehicle" v ON v."listingId" = l.id
        JOIN "Analysis" a ON a."listingId" = l.id
        WHERE l."sourceType" IN ('KLEINANZEIGEN_URL', 'TEXT')
          AND l."isExample" = false
          AND l."retrievedAt" >= ${since}
          AND l.fingerprint <> ${fingerprint}
          AND l."priceEur" IS NOT NULL AND l."priceEur" >= 100
          AND l."priceKind" IS DISTINCT FROM 'give_away'
          AND lower(v.make) = lower(${vehicle.make})
          AND lower(v.model) = lower(${vehicle.model})
          AND v."firstRegistrationYear" BETWEEN ${year - 2} AND ${year + 2}
          AND v."mileageKm" BETWEEN ${minKm} AND ${maxKm}
          AND NOT (v."firstRegistrationYear" = ${year}
                   AND coalesce(v."firstRegistrationMonth", 0) = ${month}
                   AND v."mileageKm" = ${vehicle.mileageKm})
          AND v.condition IS DISTINCT FROM 'damaged'
          AND v.condition IS DISTINCT FROM 'not_roadworthy'
          AND v."accidentHistory" IS DISTINCT FROM 'unrepaired_damage'
          AND NOT coalesce(a.result -> 'observations', '[]'::jsonb)
                  @> '[{"id": "sold_as_defective"}]'::jsonb
          AND NOT coalesce(a.result -> 'observations', '[]'::jsonb)
                  @> '[{"id": "price_placeholder"}]'::jsonb
          ${fuel ? Prisma.sql`AND (v.fuel IS NULL OR v.fuel = ${fuel})` : Prisma.empty}
          ${
            minKw !== null && maxKw !== null
              ? Prisma.sql`AND (v."powerKw" IS NULL OR v."powerKw" BETWEEN ${minKw} AND ${maxKw})`
              : Prisma.empty
          }
        ORDER BY lower(v.make), lower(v.model), v."firstRegistrationYear",
                 coalesce(v."firstRegistrationMonth", 0), v."mileageKm",
                 coalesce(l."postalCode", ''), l."retrievedAt" DESC
      ),
      capped AS (
        SELECT *, row_number() OVER (PARTITION BY owner ORDER BY "retrievedAt" DESC) AS rank
        FROM latest
      )
      SELECT "priceEur", year, month, km FROM capped
      WHERE rank <= ${MAX_COMPARABLES_PER_VISITOR}
      ORDER BY "retrievedAt" DESC
      LIMIT 500`;

    const criteria = [
      `${vehicle.make} ${vehicle.model}`,
      `Erstzulassung ${year - 2}–${year + 2}`,
      `${formatKm(minKm)} bis ${formatKm(maxKm)}`,
      ...(fuel ? [FUEL_LABELS[fuel]] : []),
      ...(minKw !== null && maxKw !== null ? [`${minKw}–${maxKw}${NBSP}kW`] : []),
    ];
    return {
      comparables: rows.map((row) => ({
        priceEur: Number(row.priceEur),
        registration: decimalRegistration(
          Number(row.year),
          row.month === null ? null : Number(row.month),
        ),
        mileageKm: Number(row.km),
      })),
      criteria: criteria.join(', '),
      source: `Inserate, die in den letzten ${COMPARABLE_DAYS} Tagen bei KaufCheck geprüft wurden (abgerufen oder als Text eingefügt), jedes Auto einmal. Es sind Angebots-, keine Verkaufspreise; das ist keine repräsentative Marktanalyse.`,
    };
  }
}
