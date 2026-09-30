import { z } from 'zod';

/**
 * `anonymous` = no account (identified by an anonymous cookie),
 * `free` = registered account without subscription, `pro` = paid subscription.
 */
export const PLANS = ['anonymous', 'free', 'pro'] as const;
export const PlanSchema = z.enum(PLANS);
export type Plan = z.infer<typeof PlanSchema>;

export const PLAN_LABELS: Record<Plan, string> = {
  anonymous: 'Ohne Konto',
  free: 'Kostenlos',
  pro: 'Pro',
};

export const EntitlementsSchema = z.object({
  monthlyAnalyses: z.number().int().nonnegative(),
  savedListingsMax: z.number().int().nonnegative(),
  /** Maximum listings per comparison; 0 = comparison not available. */
  compareMax: z.number().int().nonnegative(),
  history: z.boolean(),
  photoAnalysis: z.boolean(),
  showAds: z.boolean(),
});
export type Entitlements = z.infer<typeof EntitlementsSchema>;
