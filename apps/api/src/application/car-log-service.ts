import {
  CAR_LOG_MAX_ENTRIES,
  QUANTITY_UNITS,
  type CarLogEntryDto,
  type CarLogEntryInput,
  type CarLogKind,
  type CarLogResponse,
} from '@kaufcheck/shared';
import type { Db } from '../infrastructure/db/client';
import { AppError } from '../lib/errors';
import { isUuid } from '../repositories/analysis-repository';
import type { Actor } from './actor';

interface CarLogRow {
  id: string;
  carId: string;
  date: Date;
  kind: string;
  odometerKm: number | null;
  amountCents: number | null;
  quantityHundredths: number | null;
  fullTank: boolean;
  workshop: string | null;
  note: string | null;
  invoice: boolean;
  createdAt: Date;
}

function toDto(row: CarLogRow): CarLogEntryDto {
  return {
    id: row.id,
    carId: row.carId,
    date: row.date.toISOString().slice(0, 10),
    kind: row.kind as CarLogKind,
    odometerKm: row.odometerKm,
    amountCents: row.amountCents,
    quantity: row.quantityHundredths === null ? null : row.quantityHundredths / 100,
    fullTank: row.fullTank,
    workshop: row.workshop,
    note: row.note,
    invoice: row.invoice,
    createdAt: row.createdAt.toISOString(),
  };
}

const invalid = (field: string, message: string) =>
  new AppError('VALIDATION_ERROR', { message, details: { fieldErrors: { [field]: [message] } } });

/** Today in German time – the server itself runs in UTC. */
function today(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(now);
}

/** Checks what the schema cannot and returns the columns to store. */
function toColumns(input: CarLogEntryInput, now: Date) {
  if (input.date > today(now)) throw invalid('date', 'Das Datum liegt in der Zukunft.');
  if (input.date < '1950-01-01') throw invalid('date', 'Bitte gib ein gültiges Datum an.');
  const unit = QUANTITY_UNITS[input.kind];
  return {
    date: new Date(`${input.date}T00:00:00Z`),
    kind: input.kind,
    odometerKm: input.odometerKm,
    amountCents: input.amountCents,
    // A quantity belongs to fuel and charging only, a full tank to fuel only.
    quantityHundredths: unit && input.quantity !== null ? Math.round(input.quantity * 100) : null,
    fullTank: input.kind === 'fuel' && input.fullTank,
    workshop: input.workshop || null,
    note: input.note || null,
    invoice: input.invoice,
  };
}

/**
 * Kostenbuch and service history of the cars in „Mein Auto“. Adding and
 * changing entries needs Pro; after Pro ends, the owner can still read,
 * export and delete them.
 */
export class CarLogService {
  constructor(
    private readonly db: Db,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async list(actor: Actor, carId: string): Promise<CarLogResponse> {
    const userId = this.requireUser(actor);
    await this.requireCar(userId, carId);
    const rows = await this.db.carLogEntry.findMany({
      where: { carId },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
    return {
      items: rows.map(toDto),
      limit: CAR_LOG_MAX_ENTRIES,
      editable: actor.entitlements.carLog,
    };
  }

  async add(actor: Actor, carId: string, input: CarLogEntryInput): Promise<CarLogEntryDto> {
    const userId = this.requireUser(actor);
    this.requirePro(actor);
    if (!isUuid(carId)) throw this.carNotFound();
    const data = toColumns(input, this.now());
    const row = await this.db.$transaction(async (tx) => {
      // Locks the car so that parallel requests cannot pass the limit together.
      const locked = await tx.$queryRaw<{ id: string; mileageKm: number | null }[]>`
        SELECT "id", "mileageKm" FROM "OwnedCar"
        WHERE "id" = ${carId}::uuid
          AND "userId" = ${userId}::uuid
        FOR UPDATE`;
      const car = locked[0];
      if (!car) throw this.carNotFound();
      const used = await tx.carLogEntry.count({ where: { carId } });
      if (used >= CAR_LOG_MAX_ENTRIES)
        throw new AppError('PLAN_LIMIT_REACHED', {
          message: `Ein Kostenbuch hat Platz für ${CAR_LOG_MAX_ENTRIES} Einträge. Lösche ältere, um Platz zu schaffen.`,
          details: { limit: CAR_LOG_MAX_ENTRIES, used },
        });
      // A newer reading keeps the mileage in „Mein Auto“ up to date.
      if (data.odometerKm !== null && data.odometerKm > (car.mileageKm ?? -1))
        await tx.ownedCar.update({ where: { id: carId }, data: { mileageKm: data.odometerKm } });
      return tx.carLogEntry.create({ data: { carId, ...data } });
    });
    return toDto(row);
  }

  async update(
    actor: Actor,
    carId: string,
    id: string,
    input: CarLogEntryInput,
  ): Promise<CarLogEntryDto> {
    const userId = this.requireUser(actor);
    this.requirePro(actor);
    if (!isUuid(id)) throw this.entryNotFound();
    await this.requireCar(userId, carId);
    const data = toColumns(input, this.now());
    const [row] = await this.db.carLogEntry.updateManyAndReturn({ where: { id, carId }, data });
    if (!row) throw this.entryNotFound();
    return toDto(row);
  }

  async remove(actor: Actor, carId: string, id: string): Promise<void> {
    const userId = this.requireUser(actor);
    if (!isUuid(id)) throw this.entryNotFound();
    await this.requireCar(userId, carId);
    const { count } = await this.db.carLogEntry.deleteMany({ where: { id, carId } });
    if (count === 0) throw this.entryNotFound();
  }

  private requireUser(actor: Actor): string {
    if (!actor.userId)
      throw new AppError('UNAUTHENTICATED', {
        message: 'Melde dich an, um dein Kostenbuch zu sehen.',
      });
    return actor.userId;
  }

  private requirePro(actor: Actor): void {
    if (!actor.entitlements.carLog)
      throw new AppError('PLAN_LIMIT_REACHED', {
        message: 'Das Kostenbuch gehört zu KaufCheck Pro.',
      });
  }

  private async requireCar(userId: string, carId: string): Promise<void> {
    if (!isUuid(carId)) throw this.carNotFound();
    const car = await this.db.ownedCar.findFirst({
      where: { id: carId, userId },
      select: { id: true },
    });
    if (!car) throw this.carNotFound();
  }

  private carNotFound() {
    return new AppError('NOT_FOUND', { message: 'Dieses Auto gibt es nicht.' });
  }

  private entryNotFound() {
    return new AppError('NOT_FOUND', { message: 'Diesen Eintrag gibt es nicht.' });
  }
}
