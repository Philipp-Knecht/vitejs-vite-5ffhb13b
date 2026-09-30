import type { MeDto } from '@kaufcheck/shared';
import type { Db } from '../db/client';
import { AppError } from '../../lib/errors';

export type SubscriptionSummary = NonNullable<MeDto['subscription']>;

/**
 * Payment abstraction. Stripe is used only when fully configured; otherwise
 * checkout honestly reports PAYMENT_NOT_CONFIGURED – nothing is faked.
 */
export interface BillingService {
  readonly configured: boolean;
  createCheckoutSession(input: { userId: string; email: string; successUrl: string; cancelUrl: string }): Promise<{ url: string }>;
  createPortalSession(input: { userId: string; returnUrl: string }): Promise<{ url: string }>;
  getSubscription(userId: string): Promise<SubscriptionSummary | null>;
  handleWebhook(rawBody: Buffer, signature: string | undefined): Promise<void>;
  /** Cancels an active subscription before the account is deleted. */
  cancelForAccountDeletion(userId: string): Promise<void>;
}

export async function readSubscription(db: Db, userId: string): Promise<SubscriptionSummary | null> {
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

  createCheckoutSession(): Promise<{ url: string }> {
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

  cancelForAccountDeletion(): Promise<void> {
    return Promise.resolve();
  }
}
