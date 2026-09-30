import type { Entitlements, Plan } from '@kaufcheck/shared';

/**
 * What each plan may do. Free accounts can save and compare a few listings
 * so the core product is usable without payment; Pro raises the limits and
 * adds history, photo analysis and an ad-free experience.
 */
export const DEFAULT_ENTITLEMENTS: Readonly<Record<Plan, Entitlements>> = {
  anonymous: {
    monthlyAnalyses: 3,
    savedListingsMax: 0,
    compareMax: 0,
    history: false,
    photoAnalysis: false,
    showAds: true,
  },
  free: {
    monthlyAnalyses: 10,
    savedListingsMax: 5,
    compareMax: 3,
    history: false,
    photoAnalysis: false,
    showAds: true,
  },
  pro: {
    monthlyAnalyses: 300,
    savedListingsMax: 500,
    compareMax: 6,
    history: true,
    photoAnalysis: true,
    showAds: false,
  },
};

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
