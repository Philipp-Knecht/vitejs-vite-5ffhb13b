import { z } from 'zod';
import { ANALYTICS_EVENTS, ANALYTICS_PROP_KEYS } from '../analytics';

export const AnalyticsEventNameSchema = z.enum(ANALYTICS_EVENTS);

const PropValue = z.union([
  z
    .string()
    .max(64)
    .regex(/^[\w.:/-]*$/),
  z.number().finite(),
  z.boolean(),
]);

export const AnalyticsPropsSchema = z.partialRecord(z.enum(ANALYTICS_PROP_KEYS), PropValue);

export const AnalyticsEventRequestSchema = z.object({
  name: AnalyticsEventNameSchema,
  props: AnalyticsPropsSchema.optional(),
});
export type AnalyticsEventRequest = z.infer<typeof AnalyticsEventRequestSchema>;
