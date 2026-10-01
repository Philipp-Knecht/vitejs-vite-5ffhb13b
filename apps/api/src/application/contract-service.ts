import { randomInt } from 'node:crypto';
import {
  berlinDate,
  ORDER_CONSENT_TEXTS,
  PRO_PRODUCT_NAME,
  proFeatures,
  TERMS_VERSION,
  withdrawalDeadline,
  withinWithdrawalPeriod,
  type CancellationRequest,
  type ContractNoticeOutcome,
  type ContractNoticeReceipt,
  type Entitlements,
  type LegalContext,
  type MeDto,
  type OperatorInfo,
  type OrderCreated,
  type OrderDto,
  type OrderRequest,
  type WithdrawalRequest,
} from '@kaufcheck/shared';
import type { FastifyBaseLogger } from 'fastify';
import type { ContractNotice, Order } from '../generated/prisma/client';
import type { BillingService, CheckoutHooks } from '../infrastructure/billing/billing-service';
import type { Db } from '../infrastructure/db/client';
import type { EmailMessage, EmailService } from '../infrastructure/email/email-service';
import { AppError } from '../lib/errors';
import type { Actor } from './actor';
import {
  contractConfirmationEmail,
  noticeConfirmationEmail,
  operatorNoticeEmail,
  orderReceiptEmail,
  type OperatorNoticeFacts,
} from './contract-emails';

/** Subscription states of a contract that is still running. */
const RUNNING = new Set(['active', 'trialing', 'past_due', 'unpaid']);
const DAY_MS = 24 * 60 * 60 * 1000;
/** Unpaid orders are only kept briefly; contract records until retention ends. */
const UNPAID_ORDER_RETENTION_DAYS = 30;
const CONTRACT_RECORD_RETENTION_DAYS = 10 * 366;
const RESEND_WINDOW_DAYS = 7;
/** No 0/O, 1/I: easy to read out and type. */
const NUMBER_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function referenceNumber(prefix: string, length = 8): string {
  let value = '';
  for (let index = 0; index < length; index += 1) {
    value += NUMBER_ALPHABET[randomInt(NUMBER_ALPHABET.length)];
  }
  return `${prefix}-${value}`;
}

/** One month later on the same day of the month, clamped to the month's last day. */
export function addMonth(date: Date): Date {
  const next = new Date(date);
  const day = next.getUTCDate();
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(day, lastDay));
  return next;
}

/**
 * Compensation for the time Pro was available before the withdrawal
 * (§ 357a Abs. 2 BGB): the share of the first billing month up to the moment
 * the withdrawal arrived, rounded down in the consumer's favour.
 */
export function withdrawalRefund(
  paidCents: number,
  concludedAt: Date,
  receivedAt: Date,
): NonNullable<OperatorNoticeFacts['refund']> {
  const total = addMonth(concludedAt).getTime() - concludedAt.getTime();
  const used = Math.min(Math.max(receivedAt.getTime() - concludedAt.getTime(), 0), total);
  return {
    paidCents,
    keptCents: Math.floor((paidCents * used) / total),
    days: Math.ceil(used / DAY_MS),
    periodDays: Math.round(total / DAY_MS),
  };
}

export interface ContractServiceOptions {
  siteUrl: string;
  operator: OperatorInfo | null;
  pro: Entitlements;
  photoAnalysisAvailable: boolean;
  now: () => Date;
}

function toReceipt(notice: ContractNotice, confirmationSent: boolean): ContractNoticeReceipt {
  return {
    number: notice.number,
    type: notice.type === 'CANCELLATION' ? 'cancellation' : 'withdrawal',
    receivedAt: notice.receivedAt.toISOString(),
    name: notice.name,
    email: notice.email,
    contract: notice.contract,
    kind: notice.kind === 'ordinary' || notice.kind === 'extraordinary' ? notice.kind : null,
    reason: notice.reason,
    requestedEndDate: notice.requestedEndDate?.toISOString().slice(0, 10) ?? null,
    outcome: notice.outcome as ContractNoticeOutcome,
    effectiveEnd: notice.effectiveEnd?.toISOString() ?? null,
    confirmationSent,
  };
}

const contractName = (orderNumber: string | undefined) =>
  orderNumber ? `${PRO_PRODUCT_NAME}, Bestellnummer ${orderNumber}` : PRO_PRODUCT_NAME;

/**
 * The contract side of KaufCheck Pro: orders with the legally required
 * confirmations, the cancellation button (§ 312k BGB) and the withdrawal
 * function (§ 356a BGB). Payments themselves go through BillingService.
 */
export class ContractService implements CheckoutHooks {
  constructor(
    private readonly db: Db,
    private readonly billing: BillingService,
    private readonly email: EmailService,
    private readonly options: ContractServiceOptions,
    private readonly logger: FastifyBaseLogger,
  ) {}

  private get context(): LegalContext | null {
    return this.options.operator
      ? { operator: this.options.operator, siteUrl: this.options.siteUrl }
      : null;
  }

  /** Orders are possible only with payments, e-mail and the operator's full contact details. */
  get ordersPossible(): boolean {
    return this.billing.configured && this.email.enabled && Boolean(this.options.operator?.phone);
  }

  private features(): string[] {
    return proFeatures(this.options.pro, { photoAnalysis: this.options.photoAnalysisAvailable });
  }

  private async trySend(message: EmailMessage, op: string): Promise<boolean> {
    try {
      await this.email.send(message);
      return true;
    } catch (error) {
      this.logger.error({ op, errorCategory: 'email_failed', err: error }, 'e-mail not sent');
      return false;
    }
  }

  async placeOrder(actor: Actor, _request: OrderRequest): Promise<OrderCreated> {
    if (!actor.userId || !actor.email) {
      throw new AppError('UNAUTHENTICATED', {
        message: 'Bitte melde dich an, um Pro zu bestellen.',
      });
    }
    const context = this.context;
    const offer = this.ordersPossible ? await this.billing.getOffer() : null;
    if (!context || !offer) throw new AppError('PAYMENT_NOT_CONFIGURED');
    const subscription = await this.billing.getSubscription(actor.userId);
    if (actor.plan === 'pro' || (subscription && RUNNING.has(subscription.status))) {
      throw new AppError('VALIDATION_ERROR', { message: 'Du hast bereits KaufCheck Pro.' });
    }

    const now = this.options.now();
    const order = await this.db.order.create({
      data: {
        number: referenceNumber('KC'),
        userId: actor.userId,
        email: actor.email,
        priceCents: offer.priceCents,
        currency: offer.currency,
        vatMode: offer.vatMode,
        termsVersion: TERMS_VERSION,
        consentTexts: ORDER_CONSENT_TEXTS,
        termsAcceptedAt: now,
        immediateStartRequestedAt: now,
        createdAt: now,
      },
    });

    let session: { url: string; sessionId: string };
    try {
      session = await this.billing.createCheckoutSession({
        userId: actor.userId,
        email: actor.email,
        orderId: order.id,
        orderNumber: order.number,
        successUrl: `${this.options.siteUrl}/pro/bestellt?bestellung=${order.number}`,
        cancelUrl: `${this.options.siteUrl}/pro/bestellen?abgebrochen=${order.number}`,
      });
    } catch (error) {
      await this.db.order.update({ where: { id: order.id }, data: { status: 'ABANDONED' } });
      this.logger.error(
        { op: 'contracts.order', errorCategory: 'checkout_failed', err: error },
        'checkout session could not be created',
      );
      throw new AppError('SERVICE_UNAVAILABLE', {
        message:
          'Die Bezahlseite konnte nicht geöffnet werden. Es ist kein Vertrag zustande gekommen. Bitte versuche es gleich noch einmal.',
        cause: error,
      });
    }

    const receiptSent = await this.trySend(
      orderReceiptEmail(context, order, offer),
      'contracts.order_receipt',
    );
    await this.db.order.update({
      where: { id: order.id },
      data: { checkoutSessionId: session.sessionId, receiptSentAt: receiptSent ? now : null },
    });
    this.logger.info({ op: 'contracts.order' }, 'order placed');
    return { number: order.number, url: session.url };
  }

  async getOrder(actor: Actor, number: string): Promise<OrderDto> {
    const order = await this.db.order.findUnique({ where: { number } });
    if (!order || !actor.userId || order.userId !== actor.userId) {
      throw new AppError('NOT_FOUND', { message: 'Diese Bestellung haben wir nicht gefunden.' });
    }
    return {
      number: order.number,
      status:
        order.status === 'CONCLUDED'
          ? 'concluded'
          : order.status === 'ABANDONED'
            ? 'abandoned'
            : 'pending',
      email: order.email,
      priceCents: order.priceCents,
      vatMode: order.vatMode === 'standard' ? 'standard' : 'small_business',
      createdAt: order.createdAt.toISOString(),
      concludedAt: order.concludedAt?.toISOString() ?? null,
      withdrawalEndsAt: order.concludedAt ? withdrawalDeadline(order.concludedAt) : null,
    };
  }

  /** The latest contract of an account, for the withdrawal notice in the account. */
  async currentContract(userId: string): Promise<MeDto['contract']> {
    const order = await this.db.order.findFirst({
      where: { userId, status: 'CONCLUDED' },
      orderBy: { concludedAt: 'desc' },
      select: { number: true, concludedAt: true },
    });
    if (!order?.concludedAt) return null;
    return {
      orderNumber: order.number,
      concludedAt: order.concludedAt.toISOString(),
      withdrawalEndsAt: withdrawalDeadline(order.concludedAt),
    };
  }

  private findOrder(orderId: string | null, sessionId: string) {
    return this.db.order.findFirst({
      where: orderId
        ? { OR: [{ id: orderId }, { checkoutSessionId: sessionId }] }
        : { checkoutSessionId: sessionId },
    });
  }

  /** Payment succeeded: the contract is concluded and confirmed on a durable medium. */
  async checkoutCompleted(input: {
    orderId: string | null;
    sessionId: string;
    subscriptionId: string | null;
  }): Promise<void> {
    const order = await this.findOrder(input.orderId, input.sessionId);
    if (!order) {
      this.logger.warn({ op: 'contracts.conclude', errorCategory: 'unknown_order' }, 'no order');
      return;
    }
    const concluded =
      order.status === 'CONCLUDED'
        ? order
        : await this.db.order.update({
            where: { id: order.id },
            data: {
              status: 'CONCLUDED',
              concludedAt: this.options.now(),
              subscriptionId: input.subscriptionId,
            },
          });
    if (concluded.confirmationSentAt) return;
    await this.sendContractConfirmation(concluded);
  }

  private async sendContractConfirmation(order: Order): Promise<void> {
    const context = this.context;
    if (!context || !order.concludedAt) {
      throw new AppError('INTERNAL_ERROR', { internalReason: 'contract_confirmation_impossible' });
    }
    const consentTexts = order.consentTexts as typeof ORDER_CONSENT_TEXTS;
    await this.email.send(
      contractConfirmationEmail(
        context,
        {
          number: order.number,
          email: order.email,
          priceCents: order.priceCents,
          createdAt: order.createdAt,
          concludedAt: order.concludedAt,
          termsAcceptedAt: order.termsAcceptedAt,
          consentTexts,
          vatMode: order.vatMode === 'standard' ? 'standard' : 'small_business',
        },
        this.features(),
      ),
    );
    await this.db.order.update({
      where: { id: order.id },
      data: { confirmationSentAt: this.options.now() },
    });
    this.logger.info({ op: 'contracts.conclude' }, 'contract confirmed');
  }

  async checkoutExpired(input: { orderId: string | null; sessionId: string }): Promise<void> {
    const order = await this.findOrder(input.orderId, input.sessionId);
    if (order?.status === 'PENDING') {
      await this.db.order.update({ where: { id: order.id }, data: { status: 'ABANDONED' } });
    }
  }

  /** Account and subscription a declaration belongs to. */
  private async match(actor: Actor, email: string, orderNumber: string | undefined) {
    const order = orderNumber
      ? await this.db.order.findUnique({
          where: { number: orderNumber },
          select: {
            number: true,
            userId: true,
            concludedAt: true,
            priceCents: true,
            subscriptionId: true,
          },
        })
      : null;
    let userId = actor.userId;
    if (!userId) {
      const account = await this.db.user.findUnique({ where: { email }, select: { id: true } });
      userId = account?.id ?? order?.userId ?? null;
    }
    if (!userId) return { userId: null, accountEmail: null, subscription: null, order: null };
    const [account, subscription, latestOrder] = await Promise.all([
      this.db.user.findUnique({ where: { id: userId }, select: { email: true } }),
      this.db.subscription.findUnique({ where: { userId } }),
      this.db.order.findFirst({
        where: { userId, status: 'CONCLUDED' },
        orderBy: { concludedAt: 'desc' },
        select: {
          number: true,
          userId: true,
          concludedAt: true,
          priceCents: true,
          subscriptionId: true,
        },
      }),
    ]);
    return {
      userId,
      accountEmail: account?.email ?? null,
      subscription,
      order: order?.userId === userId ? order : latestOrder,
    };
  }

  private async finishNotice(
    notice: ContractNotice,
    recipients: string[],
    operatorFacts: OperatorNoticeFacts | null,
  ): Promise<ContractNoticeReceipt> {
    const context = this.context;
    let confirmationSent = false;
    if (context && this.email.enabled) {
      for (const [index, to] of [...new Set(recipients)].entries()) {
        const sent = await this.trySend(
          noticeConfirmationEmail(context, toReceipt(notice, false), to),
          'contracts.notice_confirmation',
        );
        if (index === 0) confirmationSent = sent;
      }
    }
    const now = this.options.now();
    let operatorNotified = false;
    const receipt = toReceipt(notice, confirmationSent);
    if (context && operatorFacts && this.email.enabled) {
      operatorNotified = await this.trySend(
        operatorNoticeEmail(context, receipt, operatorFacts),
        'contracts.operator_notice',
      );
    }
    await this.db.contractNotice.update({
      where: { id: notice.id },
      data: {
        confirmationSentAt: confirmationSent ? now : null,
        operatorNotifiedAt: operatorNotified ? now : null,
      },
    });
    return receipt;
  }

  /** § 312k BGB: a cancellation sent with "jetzt kündigen". Works without signing in. */
  async cancel(actor: Actor, request: CancellationRequest): Promise<ContractNoticeReceipt> {
    const number = referenceNumber('KC-K', 6);
    const found = await this.match(actor, request.email, request.orderNumber);
    const subscription =
      found.subscription?.providerSubscriptionId && RUNNING.has(found.subscription.status)
        ? found.subscription
        : null;

    let outcome: ContractNoticeOutcome = 'review';
    let effectiveEnd: Date | null = null;
    let problem: string | null = found.userId ? null : 'no_account';
    if (subscription?.providerSubscriptionId) {
      const periodEnd = subscription.currentPeriodEnd;
      const later =
        request.kind === 'ordinary' &&
        request.endDate !== undefined &&
        periodEnd !== null &&
        request.endDate > berlinDate(periodEnd);
      try {
        if (subscription.cancelAtPeriodEnd) {
          outcome = request.kind === 'extraordinary' ? 'review' : 'already_ending';
          effectiveEnd = periodEnd;
        } else if (later) {
          outcome = 'scheduled_later';
        } else {
          const { endsAt } = await this.billing.cancelAtPeriodEnd(
            subscription.providerSubscriptionId,
            `Kündigung ${number} über die Website`,
          );
          effectiveEnd = endsAt ?? periodEnd;
          outcome = request.kind === 'extraordinary' ? 'review' : 'scheduled';
        }
      } catch (error) {
        this.logger.error(
          { op: 'contracts.cancel', errorCategory: 'billing_failed', err: error },
          'cancellation could not be passed on',
        );
        problem = 'billing_failed';
        outcome = 'review';
      }
    } else if (found.userId) {
      problem = 'no_running_subscription';
    }

    const notice = await this.db.contractNotice.create({
      data: {
        number,
        type: 'CANCELLATION',
        receivedAt: this.options.now(),
        name: request.name,
        email: request.email,
        contract: contractName(request.orderNumber),
        orderNumber: request.orderNumber ?? null,
        kind: request.kind,
        reason: request.kind === 'extraordinary' ? (request.reason ?? null) : null,
        requestedEndDate: request.endDate ? new Date(`${request.endDate}T00:00:00Z`) : null,
        userId: found.userId,
        subscriptionId: subscription?.providerSubscriptionId ?? null,
        outcome,
        effectiveEnd,
      },
    });
    this.logger.info({ op: 'contracts.cancel', outcome }, 'cancellation received');
    // The account holder learns about a cancellation even if it was sent from another address.
    const recipients = [
      request.email,
      ...(subscription && found.accountEmail ? [found.accountEmail] : []),
    ];
    return this.finishNotice(
      notice,
      recipients,
      outcome === 'review'
        ? {
            account: found.accountEmail,
            subscriptionId: subscription?.providerSubscriptionId ?? null,
            orderNumber: found.order?.number ?? null,
            refund: null,
            problem,
          }
        : null,
    );
  }

  /**
   * § 356a BGB: a withdrawal sent with "Widerruf bestätigen". Signed-in
   * account holders within the period end their subscription right away;
   * every withdrawal reaches the operator, who refunds the payment.
   */
  async withdraw(actor: Actor, request: WithdrawalRequest): Promise<ContractNoticeReceipt> {
    const number = referenceNumber('KC-W', 6);
    const now = this.options.now();
    const found = await this.match(actor, request.email, request.orderNumber);
    const order = found.order;
    let outcome: ContractNoticeOutcome = 'review';
    let effectiveEnd: Date | null = null;
    let refund: OperatorNoticeFacts['refund'] = null;
    let problem: string | null = null;

    const subscription = found.subscription;
    const canExecute =
      actor.userId !== null &&
      order?.concludedAt &&
      withinWithdrawalPeriod(order.concludedAt, now) &&
      order.subscriptionId &&
      subscription?.providerSubscriptionId === order.subscriptionId &&
      RUNNING.has(subscription.status);
    if (canExecute && order.subscriptionId && order.concludedAt) {
      try {
        await this.billing.endNow(order.subscriptionId, `Widerruf ${number} über die Website`);
        outcome = 'withdrawn';
        effectiveEnd = now;
        refund = withdrawalRefund(order.priceCents, order.concludedAt, now);
      } catch (error) {
        this.logger.error(
          { op: 'contracts.withdraw', errorCategory: 'billing_failed', err: error },
          'withdrawal could not be passed on',
        );
        problem = 'billing_failed';
      }
    } else {
      problem = !actor.userId
        ? 'not_signed_in'
        : !order?.concludedAt
          ? 'no_contract'
          : !withinWithdrawalPeriod(order.concludedAt, now)
            ? 'after_withdrawal_period'
            : 'subscription_not_running';
    }

    const notice = await this.db.contractNotice.create({
      data: {
        number,
        type: 'WITHDRAWAL',
        receivedAt: now,
        name: request.name,
        email: request.email,
        contract: contractName(request.orderNumber),
        orderNumber: request.orderNumber ?? null,
        userId: found.userId,
        subscriptionId: order?.subscriptionId ?? null,
        outcome,
        effectiveEnd,
      },
    });
    this.logger.info({ op: 'contracts.withdraw', outcome }, 'withdrawal received');
    return this.finishNotice(
      notice,
      [
        request.email,
        ...(outcome === 'withdrawn' && found.accountEmail ? [found.accountEmail] : []),
      ],
      {
        account: found.accountEmail,
        subscriptionId: order?.subscriptionId ?? null,
        orderNumber: order?.number ?? null,
        refund,
        problem,
      },
    );
  }

  /**
   * Periodic work: passes later cancellation dates on to the payment
   * provider once their billing month has begun, resends confirmations that
   * failed and removes records whose retention period has ended.
   */
  async runMaintenance(): Promise<Record<string, number>> {
    const now = this.options.now();
    let laterCancellations = 0;
    const pending = await this.db.contractNotice.findMany({
      where: { type: 'CANCELLATION', outcome: 'scheduled_later', appliedAt: null },
    });
    for (const notice of pending) {
      if (!notice.userId || !notice.requestedEndDate) continue;
      const subscription = await this.db.subscription.findUnique({
        where: { userId: notice.userId },
      });
      const running =
        subscription?.providerSubscriptionId === notice.subscriptionId &&
        subscription?.providerSubscriptionId &&
        RUNNING.has(subscription.status);
      if (!running || !subscription?.providerSubscriptionId) {
        await this.db.contractNotice.update({ where: { id: notice.id }, data: { appliedAt: now } });
        continue;
      }
      const requested = notice.requestedEndDate.toISOString().slice(0, 10);
      if (!subscription.currentPeriodEnd || berlinDate(subscription.currentPeriodEnd) < requested)
        continue;
      try {
        const { endsAt } = subscription.cancelAtPeriodEnd
          ? { endsAt: subscription.currentPeriodEnd }
          : await this.billing.cancelAtPeriodEnd(
              subscription.providerSubscriptionId,
              `Kündigung ${notice.number} über die Website`,
            );
        await this.db.contractNotice.update({
          where: { id: notice.id },
          data: { appliedAt: now, effectiveEnd: endsAt },
        });
        laterCancellations += 1;
      } catch (error) {
        this.logger.error(
          { op: 'contracts.maintenance', errorCategory: 'billing_failed', err: error },
          'later cancellation not applied yet',
        );
      }
    }

    let confirmations = 0;
    const since = new Date(now.getTime() - RESEND_WINDOW_DAYS * DAY_MS);
    const unconfirmed = await this.db.order.findMany({
      where: { status: 'CONCLUDED', confirmationSentAt: null, concludedAt: { gte: since } },
    });
    for (const order of unconfirmed) {
      try {
        await this.sendContractConfirmation(order);
        confirmations += 1;
      } catch (error) {
        this.logger.error(
          { op: 'contracts.maintenance', errorCategory: 'email_failed', err: error },
          'contract confirmation still not sent',
        );
      }
    }
    const context = this.context;
    if (context && this.email.enabled) {
      const notices = await this.db.contractNotice.findMany({
        where: { confirmationSentAt: null, receivedAt: { gte: since } },
      });
      for (const notice of notices) {
        if (
          await this.trySend(
            noticeConfirmationEmail(context, toReceipt(notice, false), notice.email),
            'contracts.maintenance',
          )
        ) {
          await this.db.contractNotice.update({
            where: { id: notice.id },
            data: { confirmationSentAt: now },
          });
          confirmations += 1;
        }
      }
    }

    const unpaid = await this.db.order.deleteMany({
      where: {
        status: { in: ['PENDING', 'ABANDONED'] },
        createdAt: { lt: new Date(now.getTime() - UNPAID_ORDER_RETENTION_DAYS * DAY_MS) },
      },
    });
    const retentionCutoff = new Date(now.getTime() - CONTRACT_RECORD_RETENTION_DAYS * DAY_MS);
    const oldOrders = await this.db.order.deleteMany({
      where: { createdAt: { lt: retentionCutoff } },
    });
    const oldNotices = await this.db.contractNotice.deleteMany({
      where: { receivedAt: { lt: retentionCutoff } },
    });
    return {
      laterCancellations,
      confirmations,
      unpaidOrders: unpaid.count,
      expiredContractRecords: oldOrders.count + oldNotices.count,
    };
  }
}
