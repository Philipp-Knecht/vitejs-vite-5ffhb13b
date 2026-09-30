import { z } from 'zod';

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
] as const;

export const AnalyticsEventNameSchema = z.enum(ANALYTICS_EVENTS);
export type AnalyticsEventName = z.infer<typeof AnalyticsEventNameSchema>;

const PropValue = z.union([
  z
    .string()
    .max(64)
    .regex(/^[\w.:/-]*$/),
  z.number().finite(),
  z.boolean(),
]);

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

export const AnalyticsPropsSchema = z.partialRecord(z.enum(ANALYTICS_PROP_KEYS), PropValue);
export type AnalyticsProps = z.infer<typeof AnalyticsPropsSchema>;

export const AnalyticsEventRequestSchema = z.object({
  name: AnalyticsEventNameSchema,
  props: AnalyticsPropsSchema.optional(),
});
export type AnalyticsEventRequest = z.infer<typeof AnalyticsEventRequestSchema>;
