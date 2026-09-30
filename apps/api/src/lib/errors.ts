import {
  ERROR_HTTP_STATUS,
  ERROR_MESSAGES,
  type ApiError,
  type ApiErrorDetails,
  type ErrorCode,
} from '@kaufcheck/shared';

/**
 * Application error with a stable code. `message` is user-facing German
 * text; `internalReason` is for logs only and never sent to clients.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: ApiErrorDetails | undefined;
  readonly internalReason: string | undefined;

  constructor(
    code: ErrorCode,
    options: {
      message?: string;
      details?: ApiErrorDetails;
      internalReason?: string;
      cause?: unknown;
    } = {},
  ) {
    super(options.message ?? ERROR_MESSAGES[code], { cause: options.cause });
    this.name = 'AppError';
    this.code = code;
    this.status = ERROR_HTTP_STATUS[code];
    this.details = options.details;
    this.internalReason = options.internalReason;
  }

  toApiError(requestId?: string): ApiError {
    return {
      code: this.code,
      message: this.message,
      ...(requestId ? { requestId } : {}),
      ...(this.details ? { details: this.details } : {}),
    };
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
