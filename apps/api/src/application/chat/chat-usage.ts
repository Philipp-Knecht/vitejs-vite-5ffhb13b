import { createHmac } from 'node:crypto';
import { germanDay, type ChatUsage } from '@kaufcheck/shared';
import { isUniqueViolation, type Db } from '../../infrastructure/db/client';
import { AppError } from '../../lib/errors';
import { blockOf, subscriberOf } from '../../lib/network';
import { usageSubject, type Actor } from '../actor';

export interface ChatLimits {
  dailyFree: number;
  dailyPro: number;
  /** All messages of all visitors per day, to cap the costs. */
  dailyTotal: number;
  /** Messages per internet connection and day without an account (accounts get more, Pro none). */
  dailyPerAddress: number;
}

export interface ChatReservation {
  usage: ChatUsage;
  /** Gives the message back, when no answer came. */
  release(): Promise<void>;
}

const ALL = { subjectType: 'all', subjectId: 'all' } as const;

/** Free accounts count per connection too (no e-mail confirmation needed), with more room. */
const ACCOUNT_FACTOR = 5;
/** No single IPv6 /48 takes more than this many times the limit of one connection. */
const BLOCK_FACTOR = 5;

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
    /** Turns addresses into keyed hashes: the table never holds an address. */
    private readonly secret: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private addressKey(id: string, day: string) {
    const key = createHmac('sha256', this.secret).update('kaufcheck chat address').digest();
    const subjectId = createHmac('sha256', key).update(`${day}|${id}`).digest('hex').slice(0, 32);
    return { subjectType: 'address', subjectId, day };
  }

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

  async reserve(actor: Actor, address: string): Promise<ChatReservation> {
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
    // A client that drops its cookie (or signs up again) is a new visitor each time; its
    // connection is not. Visitors and accounts count apart, so a shared network (office,
    // mobile carrier) leaves room for accounts; Pro is never limited by the connection.
    const taken: { subjectType: string; subjectId: string; day: string }[] = [own];
    const giveBack = () => Promise.all(taken.map((key) => this.give(key)));
    const perConnection = this.limits.dailyPerAddress;
    const subscriber = subscriberOf(address);
    const block = blockOf(address);
    const connectionLimits =
      actor.plan === 'pro'
        ? []
        : [
            actor.userId
              ? { id: `account|${subscriber}`, limit: perConnection * ACCOUNT_FACTOR }
              : { id: `visitor|${subscriber}`, limit: perConnection },
            ...(block ? [{ id: `block|${block}`, limit: perConnection * BLOCK_FACTOR }] : []),
          ];
    for (const { id, limit: connectionLimit } of connectionLimits) {
      const key = this.addressKey(id, day);
      if ((await this.take(key, connectionLimit)) !== null) {
        taken.push(key);
        continue;
      }
      await giveBack();
      throw new AppError('USAGE_LIMIT_REACHED', {
        message: actor.userId
          ? 'Von deinem Internetanschluss kamen heute schon sehr viele Nachrichten an den Assistenten. Morgen geht es weiter; alle Rechner und die Inseratsprüfung funktionieren auch ohne Assistent.'
          : 'Von deinem Internetanschluss kamen heute schon sehr viele Nachrichten an den Assistenten. Mit einem kostenlosen Konto zählen deine Nachrichten getrennt; sonst geht es morgen weiter. Alle Rechner und die Inseratsprüfung funktionieren auch ohne Assistent.',
        internalReason: 'chat_daily_per_address',
      });
    }
    const all = { ...ALL, day };
    if ((await this.take(all, this.limits.dailyTotal)) === null) {
      await giveBack();
      throw new AppError('SERVICE_UNAVAILABLE', {
        message:
          'Der Assistent hat für heute sein Limit erreicht. Morgen geht es weiter; alle Rechner und die Inseratsprüfung funktionieren wie gewohnt.',
        internalReason: 'chat_daily_total',
      });
    }
    return {
      usage: { used, limit, resetsOn },
      release: async () => {
        await giveBack();
        await this.give(all);
      },
    };
  }
}
