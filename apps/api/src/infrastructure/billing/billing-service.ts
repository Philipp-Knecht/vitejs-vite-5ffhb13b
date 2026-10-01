import type { MeDto, ProOffer } from '@kaufcheck/shared';
import type { Db } from '../db/client';
import { AppError } from '../../lib/errors';

export type SubscriptionSummary = NonNullable<MeDto['subscription']>;

/** Contract steps that follow from payment events (see ContractService). */
export interface CheckoutHooks {
  checkoutCompleted(input: {
    orderId: string | null;
    sessionId: string;
    subscriptionId: string | null;
  }): Promise<void>;
  checkoutExpired(input: { orderId: string | null; sessionId: string }): Promise<void>;
}

/**
 * Payment abstraction. Stripe is used only when fully configured; otherwise
 * checkout honestly reports PAYMENT_NOT_CONFIGURED – nothing is faked.
 */
export interface BillingService {
  readonly configured: boolean;
  /** The offer as the payment provider will charge it; null while it is unavailable. */
  getOffer(): Promise<ProOffer | null>;
  createCheckoutSession(input: {
    userId: string;
    email: string;
    orderId: string;
    orderNumber: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ url: string; sessionId: string }>;
  createPortalSession(input: { userId: string; returnUrl: string }): Promise<{ url: string }>;
  getSubscription(userId: string): Promise<SubscriptionSummary | null>;
  handleWebhook(
    rawBody: Buffer,
    signature: string | undefined,
    hooks: CheckoutHooks,
  ): Promise<void>;
  /** Ordinary cancellation at the end of the current billing period; returns that end. */
  cancelAtPeriodEnd(subscriptionId: string, comment: string): Promise<{ endsAt: Date | null }>;
  /** Ends a subscription immediately (withdrawal). */
  endNow(subscriptionId: string, comment: string): Promise<void>;
  /** Cancels an active subscription before the account is deleted. */
  cancelForAccountDeletion(userId: string): Promise<void>;
}

export async function readSubscription(
  db: Db,
  userId: string,
): Promise<SubscriptionSummary | null> {
  const subscription = await db.subscription.findUnique({
    where: { userId },
    select: { status: true, currentPeriodEnd: true, cancelAtPeriodEnd: true },
  });
  if (!subscription) return null;
  return {
    status: subscription.status,
    currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
  };
}

export class NotConfiguredBillingService implements BillingService {
  readonly configured = false;

  constructor(private readonly db: Db) {}

  getOffer(): Promise<ProOffer | null> {
    return Promise.resolve(null);
  }

  createCheckoutSession(): Promise<{ url: string; sessionId: string }> {
    return Promise.reject(new AppError('PAYMENT_NOT_CONFIGURED'));
  }

  createPortalSession(): Promise<{ url: string }> {
    return Promise.reject(new AppError('PAYMENT_NOT_CONFIGURED'));
  }

  getSubscription(userId: string): Promise<SubscriptionSummary | null> {
    return readSubscription(this.db, userId);
  }

  handleWebhook(): Promise<void> {
    return Promise.reject(new AppError('PAYMENT_NOT_CONFIGURED'));
  }

  cancelAtPeriodEnd(): Promise<{ endsAt: Date | null }> {
    return Promise.reject(new AppError('PAYMENT_NOT_CONFIGURED'));
  }

  endNow(): Promise<void> {
    return Promise.reject(new AppError('PAYMENT_NOT_CONFIGURED'));
  }

  cancelForAccountDeletion(): Promise<void> {
    return Promise.resolve();
  }
}
