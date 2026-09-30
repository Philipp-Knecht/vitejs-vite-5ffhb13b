import type { z } from 'zod';

export type AiProviderName = 'anthropic' | 'openai' | 'mock';

export interface AiImageInput {
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
  /** Base64-encoded image data. */
  data: string;
}

export interface StructuredAnalysisRequest<T> {
  task: 'listing_text' | 'listing_photos';
  system: string;
  prompt: string;
  images?: readonly AiImageInput[];
  /** Output contract; providers must return data matching it. */
  schema: z.ZodType<T>;
  schemaName: string;
  maxOutputTokens: number;
  timeoutMs: number;
  signal?: AbortSignal;
}

export interface StructuredAnalysisResponse<T> {
  data: T;
  model: string;
}

/**
 * Provider abstraction for structured AI output. The application never
 * depends on a specific vendor; every response is validated again by the
 * domain merge functions before anything reaches a user.
 */
export interface AiProvider {
  readonly name: AiProviderName;
  readonly model: string;
  /** True only for the development mock – its output is labelled as simulated. */
  readonly isMock: boolean;
  readonly supportsVision: boolean;
  generateStructuredAnalysis<T>(request: StructuredAnalysisRequest<T>): Promise<StructuredAnalysisResponse<T>>;
}

export type AiFailureReason =
  | 'refusal'
  | 'truncated'
  | 'invalid_output'
  | 'timeout'
  | 'aborted'
  | 'rate_limited'
  | 'authentication'
  | 'bad_request'
  | 'unavailable'
  | 'unknown';

/** Provider failure. `reason` is for logs and metrics, never shown verbatim to users. */
export class AiProviderError extends Error {
  constructor(
    readonly reason: AiFailureReason,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'AiProviderError';
  }

  get isOutputProblem(): boolean {
    return this.reason === 'invalid_output' || this.reason === 'truncated';
  }
}
