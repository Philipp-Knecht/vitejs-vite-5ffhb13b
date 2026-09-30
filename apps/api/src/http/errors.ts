import { ERROR_MESSAGES, type ErrorCode } from '@kaufcheck/shared';
import type { FastifyError, FastifyInstance } from 'fastify';
import type { z } from 'zod';
import { AppError, isAppError } from '../lib/errors';

/** Validates request input with a shared Zod schema; errors become VALIDATION_ERROR (400). */
export function parseInput<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value ?? {});
  if (parsed.success) return parsed.data;
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path.join('.') || '_';
    (fieldErrors[key] ??= []).push(issue.message);
  }
  const first = parsed.error.issues[0];
  const message =
    first && !/^(Invalid|Expected|Required)/.test(first.message) ? first.message : ERROR_MESSAGES.VALIDATION_ERROR;
  throw new AppError('VALIDATION_ERROR', { message, details: { fieldErrors } });
}

function codeForStatus(status: number): ErrorCode {
  if (status === 401) return 'UNAUTHENTICATED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 429) return 'RATE_LIMITED';
  if (status >= 400 && status < 500) return 'VALIDATION_ERROR';
  return 'INTERNAL_ERROR';
}

/**
 * Maps every error to the `{ error: { code, message, requestId } }` shape.
 * Stack traces and internal reasons are logged, never returned.
 */
export function registerErrorHandling(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError | AppError, request, reply) => {
    if (isAppError(error)) {
      const level = error.status >= 500 ? 'error' : 'info';
      request.log[level](
        { op: 'request.error', errorCategory: error.code, reason: error.internalReason, ...(error.status >= 500 ? { err: error } : {}) },
        'request failed',
      );
      if (error.details?.retryAfterSeconds) reply.header('retry-after', String(error.details.retryAfterSeconds));
      return reply.status(error.status).send({ error: error.toApiError(request.id) });
    }

    const status = typeof error.statusCode === 'number' ? error.statusCode : 500;
    if (status >= 500) {
      request.log.error({ op: 'request.error', errorCategory: 'INTERNAL_ERROR', err: error }, 'unhandled error');
    } else {
      request.log.info({ op: 'request.error', errorCategory: codeForStatus(status), reason: error.code }, 'request rejected');
    }
    const code = codeForStatus(status);
    const message =
      status === 413
        ? 'Die Anfrage ist zu groß.'
        : status === 415
          ? 'Dieser Inhaltstyp wird nicht unterstützt.'
          : error.code === 'FST_ERR_CTP_INVALID_JSON_BODY' || error.code === 'FST_ERR_CTP_EMPTY_JSON_BODY'
            ? 'Die Anfrage enthält kein gültiges JSON.'
            : ERROR_MESSAGES[code];
    return reply.status(status >= 500 ? 500 : status).send({ error: { code, message, requestId: request.id } });
  });
}
