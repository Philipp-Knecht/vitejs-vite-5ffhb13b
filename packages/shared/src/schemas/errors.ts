import { z } from 'zod';
import { ERROR_CODES } from '../errors';
import { LISTING_PLATFORMS } from '../url';

export const ApiErrorDetailsSchema = z
  .object({
    fallbackToText: z.boolean().optional(),
    /** The marketplace a link belongs to, when it is known but not retrieved. */
    platform: z.enum(LISTING_PLATFORMS).optional(),
    retryAfterSeconds: z.number().int().nonnegative().optional(),
    limit: z.number().int().nonnegative().optional(),
    used: z.number().int().nonnegative().optional(),
    resetsAt: z.string().optional(),
    reason: z.string().max(300).optional(),
    fieldErrors: z.record(z.string(), z.array(z.string())).optional(),
  })
  .partial();

export type ApiErrorDetails = z.infer<typeof ApiErrorDetailsSchema>;

export const ApiErrorSchema = z.object({
  code: z.enum(ERROR_CODES),
  message: z.string(),
  requestId: z.string().optional(),
  details: ApiErrorDetailsSchema.optional(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

export const ApiErrorResponseSchema = z.object({ error: ApiErrorSchema });

export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
