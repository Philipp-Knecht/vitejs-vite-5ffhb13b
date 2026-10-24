import { germanDay, type ChatUsage } from '@kaufcheck/shared';
import { isUniqueViolation, type Db } from '../../infrastructure/db/client';
import { AppError } from '../../lib/errors';
import { usageSubject, type Actor } from '../actor';

export interface ChatLimits {
  dailyFree: number;
  dailyPro: number;
  /** All messages of all visitors per day, to cap the costs. */
  dailyTotal: number;
}

export interface ChatReservation {
  usage: ChatUsage;
  /** Gives the message back, when no answer came. */
  release(): Promise<void>;
}

const ALL = { subjectType: 'all', subjectId: 'all' } as const;

/** The German day after `day`, „YYYY-MM-DD“. */
function nextDay(day: string): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

/**
 * Chat messages per visitor (or account) and German day, plus one count for
 * everybody. A single conditional UPDATE per count keeps parallel requests
 * within the limits. Nothing of the conversation is stored.
 */
export class ChatUsageService {
  constructor(
    private readonly db: Db,
    private readonly limits: ChatLimits,
    private readonly now: () => Date = () => new Date(),
  ) {}

  limitFor(actor: Actor): number {
    return actor.plan === 'pro' ? this.limits.dailyPro : this.limits.dailyFree;
  }

  private async take(
    key: { subjectType: string; subjectId: string; day: string },
    limit: number,
  ): Promise<number | null> {
    try {
      await this.db.chatUsage.upsert({
        where: { subjectType_subjectId_day: key },
        create: { ...key, count: 0 },
        update: {},
      });
    } catch (error) {
      // A parallel request created the row first – that is fine.
      if (!isUniqueViolation(error)) throw error;
    }
    const updated = await this.db.chatUsage.updateMany({
      where: { ...key, count: { lt: limit } },
      data: { count: { increment: 1 } },
    });
    if (updated.count === 0) return null;
    const row = await this.db.chatUsage.findUnique({
      where: { subjectType_subjectId_day: key },
      select: { count: true },
    });
    return row?.count ?? 1;
  }

  private async give(key: { subjectType: string; subjectId: string; day: string }) {
    await this.db.chatUsage.updateMany({
      where: { ...key, count: { gt: 0 } },
      data: { count: { decrement: 1 } },
    });
  }

  async reserve(actor: Actor): Promise<ChatReservation> {
    const subject = usageSubject(actor);
    if (!subject) throw new AppError('INTERNAL_ERROR', { internalReason: 'chat_without_subject' });
    const day = germanDay(this.now());
    const limit = this.limitFor(actor);
    const own = { ...subject, day };
    const resetsOn = nextDay(day);

    const used = await this.take(own, limit);
    if (used === null) {
      throw new AppError('USAGE_LIMIT_REACHED', {
        message:
          actor.plan === 'pro'
            ? `Du hast heute schon ${limit} Nachrichten an den Assistenten geschickt. Morgen geht es weiter.`
            : `Du hast heute schon ${limit} Nachrichten an den Assistenten geschickt. Morgen geht es weiter – mit KaufCheck Pro sind es ${this.limits.dailyPro} am Tag. Alle Rechner und die Inseratsprüfung funktionieren auch ohne Assistent.`,
        details: { limit, used: limit, resetsAt: resetsOn },
      });
    }
    const all = { ...ALL, day };
    if ((await this.take(all, this.limits.dailyTotal)) === null) {
      await this.give(own);
      throw new AppError('SERVICE_UNAVAILABLE', {
        message:
          'Der Assistent hat für heute sein Limit erreicht. Morgen geht es weiter; alle Rechner und die Inseratsprüfung funktionieren wie gewohnt.',
        internalReason: 'chat_daily_total',
      });
    }
    return {
      usage: { used, limit, resetsOn },
      release: async () => {
        await this.give(own);
        await this.give(all);
      },
    };
  }
}
