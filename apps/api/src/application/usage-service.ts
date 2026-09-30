import type { Usage } from '@kaufcheck/shared';
import { isUniqueViolation, type Db } from '../infrastructure/db/client';
import { AppError } from '../lib/errors';
import { usageSubject, type Actor } from './actor';

/** Calendar month in UTC, e.g. "2026-09". Quotas reset on the first of each month. */
export function usagePeriod(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function periodResetsAt(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

export interface UsageReservation {
  release(): Promise<void>;
}

export class UsageService {
  constructor(
    private readonly db: Db,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async get(actor: Actor): Promise<Usage> {
    const now = this.now();
    const period = usagePeriod(now);
    const subject = usageSubject(actor);
    const row = subject
      ? await this.db.usage.findUnique({
          where: { subjectType_subjectId_period: { ...subject, period } },
          select: { analysesCount: true },
        })
      : null;
    return {
      period,
      used: row?.analysesCount ?? 0,
      limit: actor.entitlements.monthlyAnalyses,
      resetsAt: periodResetsAt(now).toISOString(),
    };
  }

  /**
   * Atomically reserves one analysis. A single conditional UPDATE guarantees
   * that concurrent requests can never exceed the monthly limit.
   */
  async reserve(actor: Actor): Promise<UsageReservation> {
    const subject = usageSubject(actor);
    if (!subject) throw new AppError('INTERNAL_ERROR', { internalReason: 'usage_without_subject' });
    const now = this.now();
    const period = usagePeriod(now);
    const limit = actor.entitlements.monthlyAnalyses;
    const key = { ...subject, period };

    try {
      await this.db.usage.upsert({
        where: { subjectType_subjectId_period: key },
        create: { ...key, analysesCount: 0 },
        update: {},
      });
    } catch (error) {
      // A parallel request created the row first – that is fine.
      if (!isUniqueViolation(error)) throw error;
    }

    const updated = await this.db.usage.updateMany({
      where: { ...key, analysesCount: { lt: limit } },
      data: { analysesCount: { increment: 1 } },
    });
    if (updated.count === 0) {
      throw new AppError('USAGE_LIMIT_REACHED', {
        message:
          actor.plan === 'anonymous'
            ? `Du hast deine ${limit} kostenlosen Analysen für diesen Monat genutzt. Mit einem kostenlosen Konto bekommst du mehr.`
            : actor.plan === 'free'
              ? `Du hast deine ${limit} Analysen für diesen Monat genutzt. Mit KaufCheck Pro kannst du deutlich mehr Inserate prüfen.`
              : `Du hast das Kontingent von ${limit} Analysen für diesen Monat erreicht.`,
        details: { limit, used: limit, resetsAt: periodResetsAt(now).toISOString() },
      });
    }

    let released = false;
    return {
      release: async () => {
        if (released) return;
        released = true;
        await this.db.usage.updateMany({
          where: { ...key, analysesCount: { gt: 0 } },
          data: { analysesCount: { decrement: 1 } },
        });
      },
    };
  }
}
