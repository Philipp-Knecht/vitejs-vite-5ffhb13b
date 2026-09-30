import Stripe from 'stripe';
import type { FastifyBaseLogger } from 'fastify';
import { isUniqueViolation, type Db } from '../db/client';
import { AppError } from '../../lib/errors';
import { readSubscription, type BillingService, type SubscriptionSummary } from './billing-service';

export interface StripeBillingOptions {
  secretKey: string;
  webhookSecret: string;
  priceIdPro: string;
  /** Injectable for tests. */
  client?: Stripe;
}

/** Subscription states that grant Pro. `past_due` keeps access during Stripe's retry period. */
const PRO_STATUSES = new Set<Stripe.Subscription.Status>(['active', 'trialing', 'past_due']);

/**
 * Stripe Checkout + Customer Portal for the Pro subscription. The user's
 * plan is only ever changed from verified webhook events.
 */
export class StripeBillingService implements BillingService {
  readonly configured = true;
  private readonly stripe: Stripe;

  constructor(
    private readonly db: Db,
    private readonly options: StripeBillingOptions,
    private readonly logger: FastifyBaseLogger,
  ) {
    this.stripe = options.client ?? new Stripe(options.secretKey, { maxNetworkRetries: 1, timeout: 20_000 });
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
      create: { userId, provider: 'stripe', providerCustomerId: customer.id, status: 'incomplete', plan: 'FREE' },
      update: { provider: 'stripe', providerCustomerId: customer.id },
    });
    return customer.id;
  }

  async createCheckoutSession(input: {
    userId: string;
    email: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ url: string }> {
    const customer = await this.customerFor(input.userId, input.email);
    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer,
      client_reference_id: input.userId,
      line_items: [{ price: this.options.priceIdPro, quantity: 1 }],
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      allow_promotion_codes: true,
      locale: 'de',
      subscription_data: { metadata: { userId: input.userId } },
    });
    if (!session.url) throw new AppError('SERVICE_UNAVAILABLE', { internalReason: 'checkout_without_url' });
    return { url: session.url };
  }

  async createPortalSession(input: { userId: string; returnUrl: string }): Promise<{ url: string }> {
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

  async handleWebhook(rawBody: Buffer, signature: string | undefined): Promise<void> {
    if (!signature) throw new AppError('VALIDATION_ERROR', { internalReason: 'missing_signature' });
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, this.options.webhookSecret);
    } catch (error) {
      throw new AppError('VALIDATION_ERROR', { internalReason: 'invalid_signature', cause: error });
    }

    const seen = await this.db.billingEvent.findUnique({ where: { id: event.id }, select: { id: true } });
    if (seen) return;

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
        if (subscriptionId) await this.sync(await this.stripe.subscriptions.retrieve(subscriptionId), session.client_reference_id);
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
  private async sync(subscription: Stripe.Subscription, referenceUserId: string | null): Promise<void> {
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
    const known = await this.db.subscription.findFirst({
      where: { OR: [{ providerSubscriptionId: subscription.id }, { providerCustomerId: customerId }] },
      select: { userId: true },
    });
    const metadataUserId = typeof subscription.metadata.userId === 'string' ? subscription.metadata.userId : null;
    const userId = known?.userId ?? metadataUserId ?? referenceUserId;
    if (!userId) {
      this.logger.warn({ op: 'billing.sync', errorCategory: 'unknown_customer' }, 'subscription for unknown user');
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
    this.logger.info({ op: 'billing.sync', status: subscription.status, plan }, 'subscription synced');
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
