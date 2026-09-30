import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { AnthropicProvider, mapAnthropicError } from './anthropic-provider';
import { AiProviderError, type StructuredAnalysisRequest } from './types';

const Schema = z.object({ summary: z.string() });

function request(overrides: Partial<StructuredAnalysisRequest<{ summary: string }>> = {}) {
  return {
    task: 'listing_text' as const,
    system: 'system prompt',
    prompt: 'user prompt',
    schema: Schema,
    schemaName: 'test',
    maxOutputTokens: 1000,
    timeoutMs: 5000,
    ...overrides,
  };
}

function fakeClient(result: unknown) {
  const parse = vi.fn(() =>
    result instanceof Error ? Promise.reject(result) : Promise.resolve(result),
  );
  const client = { beta: { messages: { parse } } } as unknown as Anthropic;
  return { client, parse };
}

function provider(client: Anthropic) {
  return new AnthropicProvider({
    apiKey: 'test-key',
    model: 'claude-opus-5-5',
    effort: 'medium',
    client,
  });
}

describe('AnthropicProvider', () => {
  it('sends a structured-output request with fallbacks, effort, images first and per-request limits', async () => {
    const { client, parse } = fakeClient({
      stop_reason: 'end_turn',
      parsed_output: { summary: 'ok' },
      model: 'claude-opus-5-5',
    });
    const controller = new AbortController();
    const response = await provider(client).generateStructuredAnalysis(
      request({
        images: [{ mediaType: 'image/jpeg', data: 'aGVsbG8=' }],
        signal: controller.signal,
      }),
    );
    expect(response).toEqual({ data: { summary: 'ok' }, model: 'claude-opus-5-5' });

    const [body, options] = parse.mock.calls[0] as unknown as [
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(body).toMatchObject({
      model: 'claude-opus-5-5',
      max_tokens: 1000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: 'system prompt',
      output_config: { effort: 'medium' },
    });
    const messages = body.messages as { role: string; content: { type: string }[] }[];
    expect(messages[0]?.content.map((block) => block.type)).toEqual(['image', 'text']);
    expect(options).toEqual({ signal: controller.signal, timeout: 5000 });
  });

  it('reports the model that actually answered (e.g. after a server-side fallback)', async () => {
    const { client } = fakeClient({
      stop_reason: 'end_turn',
      parsed_output: { summary: 'ok' },
      model: 'claude-fable-5-1',
    });
    expect((await provider(client).generateStructuredAnalysis(request())).model).toBe(
      'claude-fable-5-1',
    );
  });

  it.each([
    [{ stop_reason: 'refusal', parsed_output: null, model: 'm' }, 'refusal'],
    [{ stop_reason: 'max_tokens', parsed_output: null, model: 'm' }, 'truncated'],
    [{ stop_reason: 'end_turn', parsed_output: null, model: 'm' }, 'invalid_output'],
  ])('rejects unusable responses (%o → %s)', async (result, reason) => {
    const { client } = fakeClient(result);
    await expect(provider(client).generateStructuredAnalysis(request())).rejects.toMatchObject({
      reason,
    });
  });
});

describe('mapAnthropicError', () => {
  const headers = new Headers();
  it.each([
    [new Anthropic.APIUserAbortError(), 'aborted'],
    [new Anthropic.APIConnectionTimeoutError(), 'timeout'],
    [new Anthropic.APIConnectionError({ message: 'reset' }), 'unavailable'],
    [new Anthropic.RateLimitError(429, {}, 'slow down', headers), 'rate_limited'],
    [new Anthropic.AuthenticationError(401, {}, 'bad key', headers), 'authentication'],
    [new Anthropic.PermissionDeniedError(403, {}, 'denied', headers), 'authentication'],
    [new Anthropic.BadRequestError(400, {}, 'bad', headers), 'bad_request'],
    [new Anthropic.InternalServerError(529, {}, 'overloaded', headers), 'unavailable'],
    [new Anthropic.NotFoundError(404, {}, 'model not found', headers), 'unknown'],
    [new Anthropic.AnthropicError('Failed to parse structured output'), 'invalid_output'],
    [new SyntaxError('Unexpected token'), 'invalid_output'],
    [new Error('something else'), 'unknown'],
  ])('%s → %s', (error, reason) => {
    const mapped = mapAnthropicError(error);
    expect(mapped).toBeInstanceOf(AiProviderError);
    expect(mapped.reason).toBe(reason);
  });

  it('never puts the API key into error messages', async () => {
    const { client } = fakeClient(
      new Anthropic.AuthenticationError(401, {}, 'invalid x-api-key', headers),
    );
    const error = await provider(client)
      .generateStructuredAnalysis(request())
      .catch((caught: unknown) => caught);
    expect(String((error as Error).message)).not.toContain('test-key');
  });
});
