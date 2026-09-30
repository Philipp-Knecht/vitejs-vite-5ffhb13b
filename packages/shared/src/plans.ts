import type { Entitlements } from './schemas/plans';

export type { Entitlements } from './schemas/plans';

/**
 * `anonymous` = no account (identified by an anonymous cookie),
 * `free` = registered account without subscription, `pro` = paid subscription.
 */
export const PLANS = ['anonymous', 'free', 'pro'] as const;
export type Plan = (typeof PLANS)[number];

export const PLAN_LABELS: Record<Plan, string> = {
  anonymous: 'Ohne Konto',
  free: 'Kostenlos',
  pro: 'Pro',
};

/**
 * Default plan limits. Operators can override the monthly analysis counts via
 * environment variables; the web app shows these defaults until the server
 * configuration has loaded.
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
