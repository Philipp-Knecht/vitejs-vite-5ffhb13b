import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import {
  AiProviderError,
  type AiProvider,
  type StructuredAnalysisRequest,
  type StructuredAnalysisResponse,
} from './types';

export interface AnthropicProviderOptions {
  apiKey: string;
  model: string;
  effort: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  /** Injectable for tests. */
  client?: Anthropic;
}

/**
 * Claude via the official SDK with structured outputs (`messages.parse` +
 * Zod output format). Server-side refusal fallbacks are enabled so a
 * classifier false positive falls back to another model instead of failing.
 */
export class AnthropicProvider implements AiProvider {
  readonly name = 'anthropic' as const;
  readonly isMock = false;
  readonly supportsVision = true;
  readonly model: string;
  private readonly client: Anthropic;
  private readonly effort: AnthropicProviderOptions['effort'];

  constructor(options: AnthropicProviderOptions) {
    this.model = options.model;
    this.effort = options.effort;
    this.client = options.client ?? new Anthropic({ apiKey: options.apiKey, maxRetries: 1 });
  }

  async generateStructuredAnalysis<T>(
    request: StructuredAnalysisRequest<T>,
  ): Promise<StructuredAnalysisResponse<T>> {
    const content: Anthropic.Beta.BetaContentBlockParam[] = [
      ...(request.images ?? []).map((image): Anthropic.Beta.BetaImageBlockParam => ({
        type: 'image',
        source: { type: 'base64', media_type: image.mediaType, data: image.data },
      })),
      { type: 'text', text: request.prompt },
    ];

    let response;
    try {
      response = await this.client.beta.messages.parse(
        {
          model: this.model,
          max_tokens: request.maxOutputTokens,
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          system: request.system,
          output_config: { format: betaZodOutputFormat(request.schema), effort: this.effort },
          messages: [{ role: 'user', content }],
        },
        { signal: request.signal, timeout: request.timeoutMs },
      );
    } catch (error) {
      throw mapAnthropicError(error);
    }

    // Check stop_reason before reading content: a refusal may carry no usable output.
    if (response.stop_reason === 'refusal') {
      throw new AiProviderError('refusal', 'The model declined the request');
    }
    if (response.stop_reason === 'max_tokens') {
      throw new AiProviderError('truncated', 'The model output was truncated');
    }
    if (response.parsed_output === null || response.parsed_output === undefined) {
      throw new AiProviderError('invalid_output', 'The model output did not match the schema');
    }
    return { data: response.parsed_output, model: response.model };
  }
}

export function mapAnthropicError(error: unknown): AiProviderError {
  if (error instanceof AiProviderError) return error;
  if (error instanceof Anthropic.APIUserAbortError)
    return new AiProviderError('aborted', 'Request aborted', { cause: error });
  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return new AiProviderError('timeout', 'Request timed out', { cause: error });
  }
  if (error instanceof Anthropic.RateLimitError)
    return new AiProviderError('rate_limited', 'Rate limited', { cause: error });
  if (
    error instanceof Anthropic.AuthenticationError ||
    error instanceof Anthropic.PermissionDeniedError
  ) {
    return new AiProviderError('authentication', 'Authentication failed', { cause: error });
  }
  if (
    error instanceof Anthropic.BadRequestError ||
    error instanceof Anthropic.UnprocessableEntityError
  ) {
    return new AiProviderError('bad_request', 'Request rejected', { cause: error });
  }
  if (
    error instanceof Anthropic.InternalServerError ||
    error instanceof Anthropic.APIConnectionError
  ) {
    return new AiProviderError('unavailable', 'Provider unavailable', { cause: error });
  }
  if (error instanceof Anthropic.APIError)
    return new AiProviderError('unknown', `API error ${error.status ?? ''}`, { cause: error });
  // The SDK raises plain errors when structured output cannot be parsed.
  if (error instanceof Anthropic.AnthropicError || error instanceof SyntaxError) {
    return new AiProviderError('invalid_output', 'Could not parse model output', { cause: error });
  }
  return new AiProviderError('unknown', 'Unexpected AI provider error', { cause: error });
}
