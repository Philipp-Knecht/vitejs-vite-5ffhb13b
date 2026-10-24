import { createHmac } from 'node:crypto';
import net from 'node:net';
import { germanDay, type ChatUsage } from '@kaufcheck/shared';
import { isUniqueViolation, type Db } from '../../infrastructure/db/client';
import { AppError } from '../../lib/errors';
import { usageSubject, type Actor } from '../actor';

export interface ChatLimits {
  dailyFree: number;
  dailyPro: number;
  /** All messages of all visitors per day, to cap the costs. */
  dailyTotal: number;
  /** Messages per internet connection and day, without Pro. */
  dailyPerAddress: number;
}

export interface ChatReservation {
  usage: ChatUsage;
  /** Gives the message back, when no answer came. */
  release(): Promise<void>;
}

const ALL = { subjectType: 'all', subjectId: 'all' } as const;

/** One connection: an IPv4 address, or the /64 network a device gets with IPv6. */
export function connection(address: string): string {
  if (net.isIPv6(address)) {
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
    if (mapped?.[1]) return mapped[1];
    const [head = '', tail = ''] = address.toLowerCase().split('::');
    const left = head ? head.split(':') : [];
    const right = tail ? tail.split(':') : [];
    const groups = address.includes('::')
      ? [...left, ...Array<string>(8 - left.length - right.length).fill('0'), ...right]
      : left;
    return groups
      .slice(0, 4)
      .map((group) => group.replace(/^0+(?=.)/, ''))
      .join(':');
  }
  return address;
}

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

  private addressKey(address: string, day: string) {
    const subjectId = createHmac('sha256', this.secret)
      .update(`chat|${day}|${connection(address)}`)
      .digest('hex')
      .slice(0, 32);
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
    // A client that drops its cookie is a new visitor each time; its connection is not.
    const connectionKey = actor.plan === 'pro' ? null : this.addressKey(address, day);
    if (connectionKey && (await this.take(connectionKey, this.limits.dailyPerAddress)) === null) {
      await this.give(own);
      throw new AppError('USAGE_LIMIT_REACHED', {
        message:
          'Von deinem Internetanschluss kamen heute schon sehr viele Nachrichten an den Assistenten. Morgen geht es weiter; alle Rechner und die Inseratsprüfung funktionieren auch ohne Assistent.',
        internalReason: 'chat_daily_per_address',
      });
    }
    const all = { ...ALL, day };
    if ((await this.take(all, this.limits.dailyTotal)) === null) {
      await this.give(own);
      if (connectionKey) await this.give(connectionKey);
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
        if (connectionKey) await this.give(connectionKey);
        await this.give(all);
      },
    };
  }
}
