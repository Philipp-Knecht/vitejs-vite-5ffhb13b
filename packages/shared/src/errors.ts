import { z } from 'zod';

export const ERROR_CODES = [
  'INVALID_URL',
  'UNSUPPORTED_SOURCE',
  'UNSUPPORTED_CATEGORY',
  'SOURCE_NOT_PERMITTED',
  'FETCH_BLOCKED',
  'FETCH_FAILED',
  'LISTING_NOT_FOUND',
  'PARSING_FAILED',
  'RATE_LIMITED',
  'USAGE_LIMIT_REACHED',
  'PLAN_LIMIT_REACHED',
  'AI_ANALYSIS_FAILED',
  'AI_OUTPUT_INVALID',
  'PAYMENT_NOT_CONFIGURED',
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'INVALID_CREDENTIALS',
  'EMAIL_TAKEN',
  'FORBIDDEN',
  'NOT_FOUND',
  'REQUEST_ABORTED',
  'SERVICE_UNAVAILABLE',
  'INTERNAL_ERROR',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** User-facing default messages (German). Never include technical details here. */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  INVALID_URL:
    'Das sieht nicht nach einem gültigen Link aus. Bitte füge den vollständigen Link zum Inserat ein.',
  UNSUPPORTED_SOURCE:
    'Aktuell unterstützt KaufCheck nur Links von kleinanzeigen.de. Du kannst den Inseratstext aber direkt einfügen.',
  UNSUPPORTED_CATEGORY:
    'KaufCheck prüft derzeit nur Auto-Inserate. Weitere Kategorien sind in Planung.',
  SOURCE_NOT_PERMITTED: 'Dieses Inserat konnte nicht automatisch ausgelesen werden.',
  FETCH_BLOCKED: 'Dieses Inserat konnte nicht automatisch ausgelesen werden.',
  FETCH_FAILED: 'Dieses Inserat konnte nicht automatisch ausgelesen werden.',
  LISTING_NOT_FOUND:
    'Dieses Inserat wurde nicht gefunden. Möglicherweise ist es nicht mehr online.',
  PARSING_FAILED: 'Die Angaben im Inserat konnten nicht zuverlässig erkannt werden.',
  RATE_LIMITED: 'Zu viele Anfragen in kurzer Zeit. Bitte warte einen Moment.',
  USAGE_LIMIT_REACHED: 'Du hast deine Analysen für diesen Monat aufgebraucht.',
  PLAN_LIMIT_REACHED: 'Diese Funktion ist in deinem Tarif begrenzt.',
  AI_ANALYSIS_FAILED:
    'Die ergänzende KI-Einschätzung ist fehlgeschlagen. Die regelbasierte Prüfung ist trotzdem vollständig.',
  AI_OUTPUT_INVALID:
    'Die KI-Antwort war nicht verwertbar und wurde verworfen. Die regelbasierte Prüfung ist trotzdem vollständig.',
  PAYMENT_NOT_CONFIGURED: 'Die Bezahlung ist derzeit noch nicht verfügbar.',
  VALIDATION_ERROR: 'Bitte überprüfe deine Eingabe.',
  UNAUTHENTICATED: 'Bitte melde dich an, um diese Funktion zu nutzen.',
  INVALID_CREDENTIALS: 'E-Mail-Adresse oder Passwort ist falsch.',
  EMAIL_TAKEN: 'Für diese E-Mail-Adresse gibt es bereits ein Konto.',
  FORBIDDEN: 'Dafür fehlt dir die Berechtigung.',
  NOT_FOUND: 'Das haben wir nicht gefunden.',
  REQUEST_ABORTED: 'Die Anfrage wurde abgebrochen.',
  SERVICE_UNAVAILABLE:
    'Der Dienst ist gerade nicht erreichbar. Bitte versuche es gleich noch einmal.',
  INTERNAL_ERROR: 'Etwas ist schiefgelaufen. Bitte versuche es später erneut.',
};

export const ERROR_HTTP_STATUS: Record<ErrorCode, number> = {
  INVALID_URL: 400,
  UNSUPPORTED_SOURCE: 422,
  UNSUPPORTED_CATEGORY: 422,
  SOURCE_NOT_PERMITTED: 422,
  FETCH_BLOCKED: 502,
  FETCH_FAILED: 502,
  LISTING_NOT_FOUND: 404,
  PARSING_FAILED: 422,
  RATE_LIMITED: 429,
  USAGE_LIMIT_REACHED: 429,
  PLAN_LIMIT_REACHED: 403,
  AI_ANALYSIS_FAILED: 502,
  AI_OUTPUT_INVALID: 502,
  PAYMENT_NOT_CONFIGURED: 501,
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  INVALID_CREDENTIALS: 401,
  EMAIL_TAKEN: 409,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  REQUEST_ABORTED: 499,
  SERVICE_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
};

/**
 * Retrieval failures after which the user should be offered to paste the
 * listing text instead of the link.
 */
export const TEXT_FALLBACK_CODES: readonly ErrorCode[] = [
  'SOURCE_NOT_PERMITTED',
  'FETCH_BLOCKED',
  'FETCH_FAILED',
  'LISTING_NOT_FOUND',
  'PARSING_FAILED',
  'UNSUPPORTED_SOURCE',
];

export const ApiErrorDetailsSchema = z
  .object({
    fallbackToText: z.boolean().optional(),
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

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && (ERROR_CODES as readonly string[]).includes(value);
}
