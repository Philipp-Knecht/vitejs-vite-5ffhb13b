import { DEFAULT_ENTITLEMENTS, type Entitlements, type Plan } from '@kaufcheck/shared';

/**
 * What each plan may do. Free accounts can save and compare a few listings
 * so the core product is usable without payment; Pro raises the limits and
 * adds history, photo analysis and an ad-free experience. The defaults live
 * in the shared package so the web app can show them before the server
 * configuration has loaded.
 */
export { DEFAULT_ENTITLEMENTS };

export interface EntitlementOverrides {
  anonymousMonthlyAnalyses?: number;
  freeMonthlyAnalyses?: number;
  proMonthlyAnalyses?: number;
}

export function buildEntitlements(
  overrides: EntitlementOverrides = {},
): Record<Plan, Entitlements> {
  return {
    anonymous: {
      ...DEFAULT_ENTITLEMENTS.anonymous,
      monthlyAnalyses:
        overrides.anonymousMonthlyAnalyses ?? DEFAULT_ENTITLEMENTS.anonymous.monthlyAnalyses,
    },
    free: {
      ...DEFAULT_ENTITLEMENTS.free,
      monthlyAnalyses: overrides.freeMonthlyAnalyses ?? DEFAULT_ENTITLEMENTS.free.monthlyAnalyses,
    },
    pro: {
      ...DEFAULT_ENTITLEMENTS.pro,
      monthlyAnalyses: overrides.proMonthlyAnalyses ?? DEFAULT_ENTITLEMENTS.pro.monthlyAnalyses,
    },
  };
}
