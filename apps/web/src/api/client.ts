import {
  ERROR_MESSAGES,
  type ApiError,
  type ApiErrorDetails,
  type ErrorCode,
} from '@kaufcheck/shared';
import { parseErrorResponse } from './guards';

/** Error returned by the API (or a network failure), with a user-facing German message. */
export class ApiRequestError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: ApiErrorDetails | undefined;
  readonly requestId: string | undefined;

  constructor(error: ApiError, status: number) {
    super(error.message);
    this.name = 'ApiRequestError';
    this.code = error.code;
    this.status = status;
    this.details = error.details;
    this.requestId = error.requestId;
  }

  get fallbackToText(): boolean {
    return this.details?.fallbackToText === true;
  }
}

export function toApiRequestError(error: unknown): ApiRequestError {
  if (error instanceof ApiRequestError) return error;
  if (error instanceof DOMException && error.name === 'AbortError') {
    return new ApiRequestError(
      { code: 'REQUEST_ABORTED', message: ERROR_MESSAGES.REQUEST_ABORTED },
      499,
    );
  }
  return new ApiRequestError(
    {
      code: 'SERVICE_UNAVAILABLE',
      message: 'Keine Verbindung zu KaufCheck. Bitte prüfe deine Internetverbindung.',
    },
    0,
  );
}

export async function errorFromResponse(response: Response): Promise<ApiRequestError> {
  const body: unknown = await response.json().catch(() => null);
  const parsed = parseErrorResponse(body);
  if (parsed) return new ApiRequestError(parsed, response.status);
  const code: ErrorCode =
    response.status === 429
      ? 'RATE_LIMITED'
      : response.status === 404
        ? 'NOT_FOUND'
        : response.status >= 500
          ? 'SERVICE_UNAVAILABLE'
          : 'INTERNAL_ERROR';
  return new ApiRequestError({ code, message: ERROR_MESSAGES[code] }, response.status);
}

interface RequestOptions {
  body?: unknown;
  signal?: AbortSignal;
}

async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers:
        options.body === undefined
          ? { accept: 'application/json' }
          : { accept: 'application/json', 'content-type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (error) {
    throw toApiRequestError(error);
  }
  if (!response.ok) throw await errorFromResponse(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>('GET', path, { signal }),
  post: <T>(path: string, body: unknown = {}, signal?: AbortSignal) =>
    request<T>('POST', path, { body, signal }),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, { body }),
  delete: <T>(path: string, body?: unknown) => request<T>('DELETE', path, { body }),
};
