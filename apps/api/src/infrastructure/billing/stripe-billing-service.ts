import type { PaymentMethod, ProOffer, VatMode } from '@kaufcheck/shared';
import Stripe from 'stripe';
import type { FastifyBaseLogger } from 'fastify';
import { isUniqueViolation, type Db } from '../db/client';
import { AppError } from '../../lib/errors';
import {
  readSubscription,
  type BillingService,
  type CheckoutHooks,
  type SubscriptionSummary,
} from './billing-service';

export interface StripeBillingOptions {
  secretKey: string;
  webhookSecret: string;
  priceIdPro: string;
  paymentMethods: PaymentMethod[];
  vatMode: VatMode;
  /** Injectable for tests. */
  client?: Stripe;
  now?: () => Date;
}

/** Subscription states that grant Pro. `past_due` keeps access during Stripe's retry period. */
const PRO_STATUSES = new Set<Stripe.Subscription.Status>(['active', 'trialing', 'past_due']);

const OFFER_TTL_MS = 10 * 60 * 1000;
const OFFER_RETRY_MS = 60 * 1000;
/** How long the payment page stays open after the order (Stripe allows 30 minutes to 24 hours). */
const CHECKOUT_LIFETIME_S = 60 * 60;

/**
 * Why a Stripe price cannot be sold with the order page and terms as they
 * are written: a monthly, licensed gross price in euros without trial.
 */
export function priceProblem(price: Stripe.Price): string | null {
  if (!price.active) return 'price_inactive';
  if (price.type !== 'recurring' || !price.recurring) return 'price_not_recurring';
  if (price.currency !== 'eur') return 'price_not_eur';
  if (price.recurring.interval !== 'month' || price.recurring.interval_count !== 1)
    return 'price_not_monthly';
  if (price.recurring.usage_type !== 'licensed') return 'price_metered';
  if (price.recurring.trial_period_days) return 'price_with_trial';
  if (price.billing_scheme !== 'per_unit' || !price.unit_amount || price.unit_amount <= 0)
    return 'price_without_fixed_amount';
  // Taxes on top would make the shown price wrong: it must be the final price.
  if (price.tax_behavior === 'exclusive') return 'price_tax_exclusive';
  return null;
}

/**
 * Stripe Checkout + Customer Portal for the Pro subscription. The user's
 * plan is only ever changed from verified webhook events.
 */
export class StripeBillingService implements BillingService {
  readonly configured = true;
  private readonly stripe: Stripe;
  private readonly now: () => Date;
  private offer: { value: ProOffer | null; expiresAt: number } | null = null;

  constructor(
    private readonly db: Db,
    private readonly options: StripeBillingOptions,
    private readonly logger: FastifyBaseLogger,
  ) {
    this.stripe =
      options.client ?? new Stripe(options.secretKey, { maxNetworkRetries: 1, timeout: 20_000 });
    this.now = options.now ?? (() => new Date());
  }

  async getOffer(): Promise<ProOffer | null> {
    const now = Date.now();
    if (this.offer && this.offer.expiresAt > now) return this.offer.value;
    let value: ProOffer | null = null;
    try {
      const price = await this.stripe.prices.retrieve(this.options.priceIdPro);
      const problem = priceProblem(price);
      if (problem) {
        this.logger.error(
          { op: 'billing.offer', errorCategory: problem },
          'the Stripe price cannot be offered; payments stay unavailable',
        );
      } else if (price.unit_amount) {
        value = {
          priceCents: price.unit_amount,
          currency: 'eur',
          interval: 'month',
          vatMode: this.options.vatMode,
          paymentMethods: this.options.paymentMethods,
        };
      }
    } catch (error) {
      this.logger.error(
        { op: 'billing.offer', errorCategory: 'price_unavailable', err: error },
        'could not load the Stripe price',
      );
    }
    this.offer = { value, expiresAt: now + (value ? OFFER_TTL_MS : OFFER_RETRY_MS) };
    return value;
  }

  private async customerFor(userId: string, email: string): Promise<string> {
    const existing = await this.db.subscription.findUnique({
      where: { userId },
      select: { providerCustomerId: true },
    });
    if (existing?.providerCustomerId) return existing.providerCustomerId;
    const customer = await this.stripe.customers.create({ email, metadata: { userId } });
    await this.db.subscription.upsert({
      where: { userId },
      create: {
        userId,
        provider: 'stripe',
        providerCustomerId: customer.id,
        status: 'incomplete',
        plan: 'FREE',
      },
      update: { provider: 'stripe', providerCustomerId: customer.id },
    });
    return customer.id;
  }

  async createCheckoutSession(input: {
    userId: string;
    email: string;
    orderId: string;
    orderNumber: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ url: string; sessionId: string }> {
    const customer = await this.customerFor(input.userId, input.email);
    const metadata = {
      userId: input.userId,
      orderId: input.orderId,
      orderNumber: input.orderNumber,
    };
    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer,
      client_reference_id: input.userId,
      line_items: [{ price: this.options.priceIdPro, quantity: 1 }],
      payment_method_types: this.options.paymentMethods,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      locale: 'de',
      expires_at: Math.floor(this.now().getTime() / 1000) + CHECKOUT_LIFETIME_S,
      metadata,
      subscription_data: { metadata },
      custom_text: {
        submit: {
          message: `Deine Bestellung ${input.orderNumber} hast du bei KaufCheck bereits zahlungspflichtig abgegeben. Hier wählst du nur noch die Zahlungsart und gibst die Zahlung frei.`,
        },
      },
    });
    if (!session.url)
      throw new AppError('SERVICE_UNAVAILABLE', { internalReason: 'checkout_without_url' });
    return { url: session.url, sessionId: session.id };
  }

  async createPortalSession(input: {
    userId: string;
    returnUrl: string;
  }): Promise<{ url: string }> {
    const subscription = await this.db.subscription.findUnique({
      where: { userId: input.userId },
      select: { providerCustomerId: true },
    });
    if (!subscription?.providerCustomerId) {
      throw new AppError('NOT_FOUND', { message: 'Für dein Konto gibt es noch kein Abonnement.' });
    }
    const session = await this.stripe.billingPortal.sessions.create({
      customer: subscription.providerCustomerId,
      return_url: input.returnUrl,
    });
    return { url: session.url };
  }

  getSubscription(userId: string): Promise<SubscriptionSummary | null> {
    return readSubscription(this.db, userId);
  }

  async handleWebhook(
    rawBody: Buffer,
    signature: string | undefined,
    hooks: CheckoutHooks,
  ): Promise<void> {
    if (!signature) throw new AppError('VALIDATION_ERROR', { internalReason: 'missing_signature' });
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, this.options.webhookSecret);
    } catch (error) {
      throw new AppError('VALIDATION_ERROR', { internalReason: 'invalid_signature', cause: error });
    }

    const seen = await this.db.billingEvent.findUnique({
      where: { id: event.id },
      select: { id: true },
    });
    if (seen) return;

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const subscriptionId =
          typeof session.subscription === 'string'
            ? session.subscription
            : (session.subscription?.id ?? null);
        if (subscriptionId)
          await this.sync(
            await this.stripe.subscriptions.retrieve(subscriptionId),
            session.client_reference_id,
          );
        // Throws if the contract confirmation could not be sent: Stripe then retries the event.
        await hooks.checkoutCompleted({
          orderId: session.metadata?.orderId ?? null,
          sessionId: session.id,
          subscriptionId,
        });
        break;
      }
      case 'checkout.session.expired': {
        const session = event.data.object;
        await hooks.checkoutExpired({
          orderId: session.metadata?.orderId ?? null,
          sessionId: session.id,
        });
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await this.sync(event.data.object, null);
        break;
      default:
        break;
    }

    try {
      await this.db.billingEvent.create({ data: { id: event.id, type: event.type } });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }

  /** Mirrors a Stripe subscription into the database and updates the user's plan. */
  private async sync(
    subscription: Stripe.Subscription,
    referenceUserId: string | null,
  ): Promise<void> {
    const customerId =
      typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
    const known = await this.db.subscription.findFirst({
      where: {
        OR: [{ providerSubscriptionId: subscription.id }, { providerCustomerId: customerId }],
      },
      select: { userId: true },
    });
    const metadataUserId =
      typeof subscription.metadata.userId === 'string' ? subscription.metadata.userId : null;
    const userId = known?.userId ?? metadataUserId ?? referenceUserId;
    if (!userId) {
      this.logger.warn(
        { op: 'billing.sync', errorCategory: 'unknown_customer' },
        'subscription for unknown user',
      );
      return;
    }
    const plan = PRO_STATUSES.has(subscription.status) ? 'PRO' : 'FREE';
    const periodEnd = subscription.items.data[0]?.current_period_end;
    const data = {
      provider: 'stripe',
      providerCustomerId: customerId,
      providerSubscriptionId: subscription.id,
      status: subscription.status,
      plan,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    } as const;
    await this.db.$transaction([
      this.db.subscription.upsert({ where: { userId }, create: { userId, ...data }, update: data }),
      this.db.user.update({ where: { id: userId }, data: { plan } }),
    ]);
    this.logger.info(
      { op: 'billing.sync', status: subscription.status, plan },
      'subscription synced',
    );
  }

  async cancelAtPeriodEnd(
    subscriptionId: string,
    comment: string,
  ): Promise<{ endsAt: Date | null }> {
    const subscription = await this.stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
      cancellation_details: { comment },
    });
    await this.sync(subscription, null);
    const periodEnd = subscription.items.data[0]?.current_period_end;
    return { endsAt: periodEnd ? new Date(periodEnd * 1000) : null };
  }

  async endNow(subscriptionId: string, comment: string): Promise<void> {
    const subscription = await this.stripe.subscriptions.cancel(subscriptionId, {
      cancellation_details: { comment },
    });
    await this.sync(subscription, null);
  }

  async cancelForAccountDeletion(userId: string): Promise<void> {
    const subscription = await this.db.subscription.findUnique({
      where: { userId },
      select: { providerSubscriptionId: true, status: true },
    });
    if (subscription?.providerSubscriptionId && subscription.status !== 'canceled') {
      await this.stripe.subscriptions.cancel(subscription.providerSubscriptionId);
    }
  }
}
