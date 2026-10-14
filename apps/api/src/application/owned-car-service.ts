import { makeById, modelById } from '@kaufcheck/catalog';
import { MODEL_INDEX } from '@kaufcheck/catalog/advisor-index';
import type { FuelType, OwnedCarDto, OwnedCarInput, OwnedCarsResponse } from '@kaufcheck/shared';
import type { Db } from '../infrastructure/db/client';
import { AppError } from '../lib/errors';
import { isUuid } from '../repositories/analysis-repository';
import type { Actor } from './actor';
import type { AnalyticsService } from './analytics-service';

interface OwnedCarRow {
  id: string;
  nickname: string | null;
  makeId: string;
  modelId: string | null;
  modelName: string;
  generationId: string | null;
  fuel: string | null;
  firstRegistrationYear: number;
  firstRegistrationMonth: number | null;
  mileageKm: number | null;
  huYear: number | null;
  huMonth: number | null;
  createdAt: Date;
  updatedAt: Date;
}

function requireUser(actor: Actor): string {
  if (!actor.userId)
    throw new AppError('UNAUTHENTICATED', { message: 'Melde dich an, um dein Auto anzulegen.' });
  return actor.userId;
}

function toDto(row: OwnedCarRow): OwnedCarDto {
  return {
    id: row.id,
    nickname: row.nickname,
    makeId: row.makeId,
    modelId: row.modelId,
    modelName: row.modelName,
    generationId: row.generationId,
    fuel: row.fuel as FuelType | null,
    firstRegistration: { year: row.firstRegistrationYear, month: row.firstRegistrationMonth },
    mileageKm: row.mileageKm,
    huUntil:
      row.huYear !== null && row.huMonth !== null ? { year: row.huYear, month: row.huMonth } : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const invalid = (field: string, message: string) =>
  new AppError('VALIDATION_ERROR', { message, details: { fieldErrors: { [field]: [message] } } });

/** Months since year 0, for comparing year/month pairs. */
const monthIndex = (year: number, month: number) => year * 12 + month - 1;

/**
 * Checks what the schema cannot: catalog ids that belong together and dates
 * that are possible today. Returns the columns to store.
 */
function toColumns(input: OwnedCarInput, now: Date) {
  if (!makeById(input.makeId)) throw invalid('makeId', 'Diese Marke kennen wir nicht.');
  const model = modelById(input.modelId);
  if (input.modelId && model?.makeId !== input.makeId)
    throw invalid('modelId', 'Dieses Modell passt nicht zur Marke.');
  if (input.generationId) {
    const summary = MODEL_INDEX.find((entry) => entry.id === input.modelId);
    if (!summary?.generations.some((generation) => generation.id === input.generationId))
      throw invalid('generationId', 'Diese Generation passt nicht zum Modell.');
  }

  const current = monthIndex(now.getFullYear(), now.getMonth() + 1);
  const registration = input.firstRegistration;
  // Without a month, the year alone must not be in the future.
  if (monthIndex(registration.year, registration.month ?? 1) > current)
    throw invalid('firstRegistration', 'Die Erstzulassung liegt in der Zukunft.');
  if (input.huUntil) {
    const hu = monthIndex(input.huUntil.year, input.huUntil.month);
    // A new car gets its first HU after 36 months (§ 29 StVZO, Anlage VIII).
    if (hu > current + 36)
      throw invalid('huUntil', 'Die HU kann höchstens drei Jahre im Voraus gültig sein.');
    if (hu < monthIndex(registration.year, registration.month ?? 1))
      throw invalid('huUntil', 'Die HU liegt vor der Erstzulassung.');
  }

  return {
    nickname: input.nickname || null,
    makeId: input.makeId,
    modelId: input.modelId,
    modelName: input.modelName,
    generationId: input.generationId,
    fuel: input.fuel,
    firstRegistrationYear: registration.year,
    firstRegistrationMonth: registration.month,
    mileageKm: input.mileageKm,
    huYear: input.huUntil?.year ?? null,
    huMonth: input.huUntil?.month ?? null,
  };
}

/** „Mein Auto“: the cars a user owns, with what KaufCheck knows about them. */
export class OwnedCarService {
  constructor(
    private readonly db: Db,
    private readonly analytics: AnalyticsService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async list(actor: Actor): Promise<OwnedCarsResponse> {
    const userId = requireUser(actor);
    const rows = await this.db.ownedCar.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    return { items: rows.map(toDto), limit: actor.entitlements.ownedCarsMax };
  }

  async add(actor: Actor, input: OwnedCarInput): Promise<OwnedCarDto> {
    const userId = requireUser(actor);
    const max = actor.entitlements.ownedCarsMax;
    const data = toColumns(input, this.now());
    const used = await this.db.ownedCar.count({ where: { userId } });
    if (used >= max)
      throw new AppError('PLAN_LIMIT_REACHED', {
        message:
          max === 1
            ? 'Mit dem kostenlosen Konto kannst du ein Auto anlegen. Mehrere Autos gehen mit KaufCheck Pro.'
            : `Du kannst bis zu ${max} Autos anlegen. Lösche eines, um Platz zu schaffen.`,
        details: { limit: max, used },
      });
    const row = await this.db.ownedCar.create({ data: { userId, ...data } });
    this.analytics.track('owned_car_added', { plan: actor.plan }, actor);
    return toDto(row);
  }

  async update(actor: Actor, id: string, input: OwnedCarInput): Promise<OwnedCarDto> {
    const userId = requireUser(actor);
    if (!isUuid(id)) throw this.notFound();
    const data = toColumns(input, this.now());
    const { count } = await this.db.ownedCar.updateMany({ where: { id, userId }, data });
    if (count === 0) throw this.notFound();
    return toDto(await this.db.ownedCar.findUniqueOrThrow({ where: { id } }));
  }

  async remove(actor: Actor, id: string): Promise<void> {
    const userId = requireUser(actor);
    if (!isUuid(id)) throw this.notFound();
    const { count } = await this.db.ownedCar.deleteMany({ where: { id, userId } });
    if (count === 0) throw this.notFound();
  }

  private notFound() {
    return new AppError('NOT_FOUND', { message: 'Dieses Auto gibt es nicht.' });
  }
}
