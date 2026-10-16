import { makeById } from '@kaufcheck/catalog';
import {
  dueOccurrence,
  REMINDER_KINDS,
  REMINDER_NEEDS_MONTH,
  reminderMonthProblem,
  reminderPlan,
  type CarRemindersResponse,
  type LegalContext,
  type OperatorInfo,
  type ReminderDto,
  type ReminderInput,
  type ReminderKind,
} from '@kaufcheck/shared';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyBaseLogger } from 'fastify';
import type { Db } from '../infrastructure/db/client';
import type { EmailService } from '../infrastructure/email/email-service';
import { randomToken, sha256 } from '../lib/crypto';
import { AppError } from '../lib/errors';
import { isUuid } from '../repositories/analysis-repository';
import type { Actor } from './actor';
import { REMINDER_CONFIRM_HOURS, reminderConfirmEmail, reminderEmail } from './reminder-emails';

const HOUR_MS = 60 * 60 * 1000;
/** A new confirmation link at most every ten minutes. */
const CONFIRM_RESEND_MS = 10 * 60 * 1000;
const SEND_BATCH = 200;
const DAY_MS = 24 * HOUR_MS;
/** Confirmation links per account and day. */
const CONFIRM_PER_DAY = 3;

export interface ReminderServiceOptions {
  siteUrl: string;
  operator: OperatorInfo | null;
  /** Signs the unsubscribe links. */
  secret: string;
  now: () => Date;
}

export interface ReminderSendReport {
  remindersSent: number;
  remindersFailed: number;
}

/** Today in Germany: due months and tyre seasons follow German time. */
function germanToday(now: Date) {
  const [year, month, day] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' })
    .format(now)
    .split('-')
    .map(Number) as [number, number, number];
  return { year, month, day };
}

interface ReminderRow {
  kind: string;
  email: boolean;
  year: number | null;
  month: number | null;
  lastSentKey: string | null;
}

function toDto(kind: ReminderKind, row: ReminderRow | undefined): ReminderDto {
  return {
    kind,
    email: row?.email ?? false,
    lastSentKey: row?.lastSentKey ?? null,
    month:
      row && row.year !== null && row.month !== null ? { year: row.year, month: row.month } : null,
  };
}

const invalid = (field: string, message: string) =>
  new AppError('VALIDATION_ERROR', { message, details: { fieldErrors: { [field]: [message] } } });

/**
 * E-mail reminders for the cars in „Mein Auto“ (Pro). An e-mail goes out only
 * after the owner switched it on and confirmed the account address, once per
 * due date, with a one-click unsubscribe link (RFC 8058) and no advertising.
 */
export class ReminderService {
  constructor(
    private readonly db: Db,
    private readonly email: EmailService,
    private readonly options: ReminderServiceOptions,
    private readonly logger: FastifyBaseLogger,
  ) {}

  private get context(): LegalContext | null {
    return this.options.operator
      ? { operator: this.options.operator, siteUrl: this.options.siteUrl }
      : null;
  }

  /** E-mails need a mail server and the operator's details for the footer. */
  get available(): boolean {
    return this.email.enabled && this.context !== null;
  }

  /** Signs a reminder id; the link only switches this one reminder off. */
  unsubscribeToken(reminderId: string): string {
    return createHmac('sha256', this.options.secret)
      .update(`reminder-unsubscribe:${reminderId}`)
      .digest('base64url');
  }

  async list(actor: Actor, carId: string): Promise<CarRemindersResponse> {
    const user = await this.requireUser(actor);
    await this.requireCar(user.id, carId);
    const rows = await this.db.carReminder.findMany({ where: { carId } });
    const pending = await this.db.reminderConfirmToken.count({
      where: { userId: user.id, expiresAt: { gt: this.options.now() } },
    });
    return {
      items: REMINDER_KINDS.map((kind) =>
        toDto(
          kind,
          rows.find((row) => row.kind === kind),
        ),
      ),
      emailAddress: user.email,
      emailConfirmed: user.remindersConfirmedAt !== null,
      confirmationPending: user.remindersConfirmedAt === null && pending > 0,
      editable: actor.entitlements.reminders,
    };
  }

  /**
   * Saves one reminder. Without Pro it can only be switched off. Switching on
   * an e-mail reminder before the address is confirmed sends the confirmation link.
   */
  async update(
    actor: Actor,
    carId: string,
    kind: string,
    input: ReminderInput,
  ): Promise<CarRemindersResponse> {
    const user = await this.requireUser(actor);
    if (!(REMINDER_KINDS as readonly string[]).includes(kind))
      throw new AppError('NOT_FOUND', { message: 'Diese Erinnerung gibt es nicht.' });
    const reminderKind = kind as ReminderKind;
    const car = await this.requireCar(user.id, carId);
    const existing = await this.db.carReminder.findUnique({
      where: { carId_kind: { carId, kind } },
    });
    const pro = actor.entitlements.reminders;
    if (!pro && (input.email || !sameMonth(existing, input.month)))
      throw new AppError('PLAN_LIMIT_REACHED', {
        message: 'Erinnerungen gehören zu KaufCheck Pro. Ausschalten kannst du sie jederzeit.',
      });
    if (input.email && !this.available)
      throw new AppError('SERVICE_UNAVAILABLE', {
        message: 'E-Mail-Erinnerungen sind derzeit nicht verfügbar.',
      });
    // A month that was valid when saved may lie in the past by now: only a changed one is checked.
    if (pro && !sameMonth(existing, input.month)) {
      const problem = reminderMonthProblem(
        reminderKind,
        input.month,
        germanToday(this.options.now()),
      );
      if (problem) throw invalid('month', problem);
    }
    if (pro) {
      if (input.email && REMINDER_NEEDS_MONTH.has(reminderKind) && input.month === null)
        throw invalid(
          'month',
          reminderKind === 'service'
            ? 'Bitte gib an, wann die nächste Inspektion fällig ist.'
            : 'Bitte gib an, wann die Bremsflüssigkeit zuletzt gewechselt wurde.',
        );
    }
    const month = pro ? input.month : existingMonth(existing);
    // A reminder that could never send is not switched on.
    if (input.email && (!existing?.email || !sameMonth(existing, input.month))) {
      const huUntil =
        car.huYear !== null && car.huMonth !== null
          ? { year: car.huYear, month: car.huMonth }
          : null;
      if (reminderKind === 'hu' && !huUntil)
        throw new AppError('VALIDATION_ERROR', {
          message: 'Trag zuerst in „Mein Auto“ Monat und Jahr von der Prüfplakette ein.',
        });
      const plan = reminderPlan(
        reminderKind,
        { huUntil, month },
        germanToday(this.options.now()),
        existing?.lastSentKey ?? null,
      );
      if (plan.state === 'past')
        throw reminderKind === 'hu'
          ? new AppError('VALIDATION_ERROR', {
              message:
                'Die HU ist laut „Mein Auto“ schon abgelaufen. Trag nach der HU den Monat von der neuen Plakette ein, dann erinnern wir dich.',
            })
          : invalid(
              'month',
              'Der Termin ist schon vorbei. Trag den neuen Termin ein, dann erinnern wir dich.',
            );
    }
    // The link goes out before saving: if it cannot be sent, nothing is switched on.
    if (input.email && user.remindersConfirmedAt === null) await this.sendConfirmation(user, false);
    const now = this.options.now();
    const data = {
      email: input.email,
      year: month?.year ?? null,
      month: month?.month ?? null,
      ...(input.email && !existing?.email ? { emailOnAt: now } : {}),
    };
    await this.db.carReminder.upsert({
      where: { carId_kind: { carId, kind } },
      create: { carId, kind, ...data },
      update: data,
    });
    return this.list(actor, carId);
  }

  /** Sends a new confirmation link; `explicit` = the owner asked for it again. */
  async requestConfirmation(actor: Actor): Promise<void> {
    const user = await this.requireUser(actor);
    if (!actor.entitlements.reminders)
      throw new AppError('PLAN_LIMIT_REACHED', {
        message: 'Erinnerungen gehören zu KaufCheck Pro.',
      });
    if (user.remindersConfirmedAt !== null) return;
    if (!this.available)
      throw new AppError('SERVICE_UNAVAILABLE', {
        message: 'E-Mail-Erinnerungen sind derzeit nicht verfügbar.',
      });
    await this.sendConfirmation(user, true);
  }

  private async sendConfirmation(
    user: { id: string; email: string },
    explicit: boolean,
  ): Promise<void> {
    const context = this.context;
    if (!context || !this.email.enabled) return;
    const now = this.options.now();
    const recent = await this.db.reminderConfirmToken.findFirst({
      where: { userId: user.id, createdAt: { gt: new Date(now.getTime() - CONFIRM_RESEND_MS) } },
    });
    const today = await this.db.reminderConfirmToken.count({
      where: { userId: user.id, createdAt: { gt: new Date(now.getTime() - DAY_MS) } },
    });
    // At most a few links a day: the address is not verified yet.
    if (today >= CONFIRM_PER_DAY) {
      if (!explicit) return;
      throw new AppError('RATE_LIMITED', {
        message:
          'Wir haben dir heute schon mehrere Links geschickt. Bitte schau in deinem Postfach und im Spam-Ordner nach oder versuch es morgen wieder.',
      });
    }
    if (recent) {
      if (explicit)
        throw new AppError('RATE_LIMITED', {
          message: 'Wir haben dir gerade erst einen Link geschickt. Bitte warte ein paar Minuten.',
        });
      return;
    }
    const token = randomToken(32);
    await this.db.reminderConfirmToken.create({
      data: {
        tokenHash: sha256(token),
        userId: user.id,
        createdAt: now,
        expiresAt: new Date(now.getTime() + REMINDER_CONFIRM_HOURS * HOUR_MS),
      },
    });
    try {
      await this.email.send(reminderConfirmEmail(context, user.email, token));
    } catch (error) {
      this.logger.error({ op: 'reminders.confirm_email', err: error }, 'confirmation not sent');
      // Allows a new attempt right away.
      await this.db.reminderConfirmToken.deleteMany({ where: { tokenHash: sha256(token) } });
      throw new AppError('SERVICE_UNAVAILABLE', {
        message: 'Die Bestätigungs-E-Mail konnte nicht verschickt werden. Bitte versuch es später.',
      });
    }
  }

  /** The link from the confirmation e-mail; no login needed. */
  async confirm(token: string): Promise<void> {
    const now = this.options.now();
    const record = await this.db.reminderConfirmToken.findUnique({
      where: { tokenHash: sha256(token) },
    });
    if (!record || record.expiresAt <= now)
      throw new AppError('VALIDATION_ERROR', {
        message:
          'Der Link ist abgelaufen oder wurde schon benutzt. Hast du schon bestätigt, ist alles erledigt; sonst forderst du auf der Seite „Erinnerungen“ deines Autos einen neuen Link an.',
      });
    await this.db.$transaction([
      this.db.user.update({
        where: { id: record.userId },
        data: { remindersConfirmedAt: now },
      }),
      this.db.reminderConfirmToken.deleteMany({ where: { userId: record.userId } }),
    ]);
  }

  private checkUnsubscribe(reminderId: string, token: string): void {
    const expected = Buffer.from(this.unsubscribeToken(reminderId));
    const given = Buffer.from(token);
    if (
      !isUuid(reminderId) ||
      given.length !== expected.length ||
      !timingSafeEqual(given, expected)
    )
      throw new AppError('VALIDATION_ERROR', {
        message: 'Dieser Link zum Abbestellen ist ungültig.',
      });
  }

  /** Which reminder a link from an e-mail is about, for the page that asks before unsubscribing. */
  async describeUnsubscribe(
    reminderId: string,
    token: string,
  ): Promise<{ kind: ReminderKind; carName: string; email: boolean } | null> {
    this.checkUnsubscribe(reminderId, token);
    const row = await this.db.carReminder.findUnique({
      where: { id: reminderId },
      include: { car: { select: { nickname: true, makeId: true, modelName: true } } },
    });
    if (!row || !(REMINDER_KINDS as readonly string[]).includes(row.kind)) return null;
    return { kind: row.kind as ReminderKind, carName: carName(row.car), email: row.email };
  }

  /** Switches one reminder off with the signed link from an e-mail; repeating it does no harm. */
  async unsubscribe(reminderId: string, token: string): Promise<void> {
    this.checkUnsubscribe(reminderId, token);
    await this.db.carReminder.updateMany({ where: { id: reminderId }, data: { email: false } });
  }

  /** Called hourly by the server: sends what is due today, each due date once. */
  async sendDue(): Promise<ReminderSendReport> {
    const report: ReminderSendReport = { remindersSent: 0, remindersFailed: 0 };
    const context = this.context;
    if (!context || !this.email.enabled) return report;
    const now = this.options.now();
    const today = germanToday(now);
    let cursor: string | undefined;
    for (;;) {
      const rows = await this.db.carReminder.findMany({
        where: {
          email: true,
          car: { user: { plan: 'PRO', remindersConfirmedAt: { not: null } } },
          // Not a Prisma cursor: the last row may change or go while e-mails are sent.
          ...(cursor ? { id: { gt: cursor } } : {}),
        },
        include: { car: { include: { user: { select: { email: true } } } } },
        orderBy: { id: 'asc' },
        take: SEND_BATCH,
      });
      if (rows.length === 0) break;
      cursor = rows.at(-1)!.id;
      for (const row of rows) {
        if (!(REMINDER_KINDS as readonly string[]).includes(row.kind)) continue;
        const kind = row.kind as ReminderKind;
        const car = row.car;
        const occurrence = dueOccurrence(
          kind,
          {
            huUntil:
              car.huYear !== null && car.huMonth !== null
                ? { year: car.huYear, month: car.huMonth }
                : null,
            month: existingMonth(row),
          },
          today,
        );
        if (!occurrence || occurrence.key === row.lastSentKey) continue;
        // Claims the due date first, so that a parallel run cannot send it twice.
        const claimed = await this.db.carReminder.updateMany({
          where: { id: row.id, email: true, lastSentKey: row.lastSentKey },
          data: { lastSentKey: occurrence.key, lastSentAt: now },
        });
        if (claimed.count !== 1) continue;
        try {
          await this.email.send(
            reminderEmail(context, {
              to: car.user.email,
              kind,
              occurrence,
              carName: carName(car),
              carId: car.id,
              reminderId: row.id,
              unsubscribeToken: this.unsubscribeToken(row.id),
            }),
          );
          report.remindersSent++;
        } catch (error) {
          report.remindersFailed++;
          this.logger.error({ op: 'reminders.send', kind, err: error }, 'reminder not sent');
          // The next run tries again.
          await this.db.carReminder.updateMany({
            where: { id: row.id, lastSentKey: occurrence.key },
            data: { lastSentKey: row.lastSentKey, lastSentAt: row.lastSentAt },
          });
        }
      }
    }
    return report;
  }

  private async requireUser(actor: Actor) {
    if (!actor.userId) throw new AppError('UNAUTHENTICATED');
    const user = await this.db.user.findUnique({
      where: { id: actor.userId },
      select: { id: true, email: true, remindersConfirmedAt: true },
    });
    if (!user) throw new AppError('UNAUTHENTICATED');
    return user;
  }

  private async requireCar(userId: string, carId: string) {
    const car = isUuid(carId)
      ? await this.db.ownedCar.findFirst({
          where: { id: carId, userId },
          select: { id: true, huYear: true, huMonth: true },
        })
      : null;
    if (!car) throw new AppError('NOT_FOUND', { message: 'Dieses Auto gibt es nicht (mehr).' });
    return car;
  }
}

function carName(car: { nickname: string | null; makeId: string; modelName: string }): string {
  return car.nickname ?? `${makeById(car.makeId)?.name ?? car.makeId} ${car.modelName}`;
}

function existingMonth(row: { year: number | null; month: number | null } | null) {
  return row && row.year !== null && row.month !== null
    ? { year: row.year, month: row.month }
    : null;
}

function sameMonth(
  row: { year: number | null; month: number | null } | null,
  month: { year: number; month: number } | null,
): boolean {
  const stored = existingMonth(row);
  return stored === null || month === null
    ? stored === month
    : stored.year === month.year && stored.month === month.month;
}
