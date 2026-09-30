import { z } from 'zod';
import {
  AiProviderError,
  type AiProvider,
  type StructuredAnalysisRequest,
  type StructuredAnalysisResponse,
} from './types';

export interface OpenAiProviderOptions {
  apiKey: string;
  /** Required – there is deliberately no default model. */
  model: string;
  baseUrl: string;
  fetchImpl?: typeof fetch;
}

type JsonSchema = Record<string, unknown>;

/** Keywords the strict JSON-schema mode does not accept; limits are enforced by Zod afterwards. */
const UNSUPPORTED_KEYWORDS = new Set([
  '$schema',
  'minLength',
  'maxLength',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'minItems',
  'maxItems',
  'default',
]);

/** Converts a Zod schema to the strict JSON-schema dialect: all properties required, no extras. */
export function toStrictJsonSchema(schema: z.ZodType): JsonSchema {
  const visit = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(visit);
    if (!node || typeof node !== 'object') return node;
    const result: JsonSchema = {};
    for (const [key, value] of Object.entries(node as JsonSchema)) {
      if (UNSUPPORTED_KEYWORDS.has(key)) continue;
      result[key] = visit(value);
    }
    if (result.type === 'object' && result.properties && typeof result.properties === 'object') {
      result.required = Object.keys(result.properties);
      result.additionalProperties = false;
    }
    return result;
  };
  return visit(z.toJSONSchema(schema, { target: 'draft-7' })) as JsonSchema;
}

interface ChatCompletionResponse {
  model?: string;
  choices?: {
    finish_reason?: string;
    message?: { content?: string | null; refusal?: string | null };
  }[];
}

/**
 * OpenAI Chat Completions with structured outputs (`response_format` json_schema, strict).
 * Uses plain fetch to keep the dependency surface small.
 */
export class OpenAiProvider implements AiProvider {
  readonly name = 'openai' as const;
  readonly isMock = false;
  readonly supportsVision = true;
  readonly model: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: OpenAiProviderOptions) {
    this.model = options.model;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async generateStructuredAnalysis<T>(request: StructuredAnalysisRequest<T>): Promise<StructuredAnalysisResponse<T>> {
    const deadline = AbortSignal.timeout(request.timeoutMs);
    const signal = request.signal ? AbortSignal.any([deadline, request.signal]) : deadline;
    const userContent = [
      ...(request.images ?? []).map((image) => ({
        type: 'image_url',
        image_url: { url: `data:${image.mediaType};base64,${image.data}` },
      })),
      { type: 'text', text: request.prompt },
    ];

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.options.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { authorization: `Bearer ${this.options.apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          max_completion_tokens: request.maxOutputTokens,
          messages: [
            { role: 'system', content: request.system },
            { role: 'user', content: userContent },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: { name: request.schemaName, strict: true, schema: toStrictJsonSchema(request.schema) },
          },
        }),
        signal,
      });
    } catch (error) {
      if (deadline.aborted) throw new AiProviderError('timeout', 'Request timed out', { cause: error });
      if (request.signal?.aborted) throw new AiProviderError('aborted', 'Request aborted', { cause: error });
      throw new AiProviderError('unavailable', 'Network error', { cause: error });
    }

    if (!response.ok) {
      const reason =
        response.status === 401 || response.status === 403
          ? 'authentication'
          : response.status === 429
            ? 'rate_limited'
            : response.status >= 500
              ? 'unavailable'
              : 'bad_request';
      await response.body?.cancel();
      throw new AiProviderError(reason, `HTTP ${response.status}`);
    }

    const payload = (await response.json()) as ChatCompletionResponse;
    const choice = payload.choices?.[0];
    if (choice?.message?.refusal) throw new AiProviderError('refusal', 'The model declined the request');
    if (choice?.finish_reason === 'length') throw new AiProviderError('truncated', 'The model output was truncated');
    const content = choice?.message?.content;
    if (!content) throw new AiProviderError('invalid_output', 'Empty model output');

    let json: unknown;
    try {
      json = JSON.parse(content);
    } catch (error) {
      throw new AiProviderError('invalid_output', 'Model output is not JSON', { cause: error });
    }
    const parsed = request.schema.safeParse(json);
    if (!parsed.success) throw new AiProviderError('invalid_output', 'Model output did not match the schema');
    return { data: parsed.data, model: payload.model ?? this.model };
  }
}
