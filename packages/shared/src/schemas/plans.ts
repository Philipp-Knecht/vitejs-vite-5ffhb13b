import { z } from 'zod';
import { PLANS } from '../plans';

export const PlanSchema = z.enum(PLANS);

export const EntitlementsSchema = z.object({
  monthlyAnalyses: z.number().int().nonnegative(),
  savedListingsMax: z.number().int().nonnegative(),
  /** Maximum listings per comparison; 0 = comparison not available. */
  compareMax: z.number().int().nonnegative(),
  /** Saved car searches (all marketplaces); 0 = not available. */
  savedSearchesMax: z.number().int().nonnegative(),
  history: z.boolean(),
  photoAnalysis: z.boolean(),
  showAds: z.boolean(),
});
export type Entitlements = z.infer<typeof EntitlementsSchema>;
