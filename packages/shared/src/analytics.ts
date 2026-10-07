/**
 * Privacy-conscious product analytics: a fixed allowlist of events and a tiny,
 * non-personal property vocabulary. No user ids, no IPs, no free text.
 */
export const ANALYTICS_EVENTS = [
  'landing_page_view',
  'listing_analysis_started',
  'listing_analysis_completed',
  'listing_analysis_failed',
  'seller_questions_copied',
  'seller_message_created',
  'checklist_started',
  'listing_saved',
  'comparison_created',
  'pro_clicked',
  'car_search_started',
  'platform_search_opened',
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

/** Allowed property keys. Events with other keys are rejected. */
export const ANALYTICS_PROP_KEYS = [
  'source',
  'errorCode',
  'placement',
  'count',
  'plan',
  'aiStatus',
  'path',
] as const;

export type AnalyticsPropKey = (typeof ANALYTICS_PROP_KEYS)[number];
export type AnalyticsProps = Partial<Record<AnalyticsPropKey, string | number | boolean>>;

export type { AnalyticsEventRequest } from './schemas/analytics';
