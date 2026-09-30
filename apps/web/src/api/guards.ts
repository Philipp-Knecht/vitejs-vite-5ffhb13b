import {
  ANALYSIS_STAGES,
  isErrorCode,
  type AnalysisDto,
  type AnalysisStage,
  type AnalysisStreamEvent,
  type ApiError,
} from '@kaufcheck/shared';

/*
 * Lightweight shape checks for responses of our own API. The server validates
 * all input and output with the shared Zod schemas; the browser only guards
 * against version skew and broken responses without shipping Zod.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStage(value: unknown): value is AnalysisStage {
  return typeof value === 'string' && (ANALYSIS_STAGES as readonly string[]).includes(value);
}

export function parseApiError(value: unknown): ApiError | null {
  if (!isRecord(value)) return null;
  const { code, message, requestId, details } = value;
  if (!isErrorCode(code) || typeof message !== 'string') return null;
  return {
    code,
    message,
    ...(typeof requestId === 'string' ? { requestId } : {}),
    ...(isRecord(details) ? { details } : {}),
  };
}

/** `{ error: {...} }` bodies of failed requests. */
export function parseErrorResponse(body: unknown): ApiError | null {
  return isRecord(body) ? parseApiError(body.error) : null;
}

function isAnalysisDto(value: unknown): value is AnalysisDto {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    isRecord(value.listing) &&
    isRecord(value.analysis) &&
    Array.isArray(value.analysis.sellerQuestions)
  );
}

/** One line of the NDJSON analysis stream. */
export function parseStreamEvent(value: unknown): AnalysisStreamEvent | null {
  if (!isRecord(value)) return null;
  switch (value.type) {
    case 'stage':
      return isStage(value.stage) && (value.status === 'started' || value.status === 'completed')
        ? { type: 'stage', stage: value.stage, status: value.status }
        : null;
    case 'result':
      return isAnalysisDto(value.data) ? { type: 'result', data: value.data } : null;
    case 'error': {
      const error = parseApiError(value.error);
      return error ? { type: 'error', error } : null;
    }
    default:
      return null;
  }
}
