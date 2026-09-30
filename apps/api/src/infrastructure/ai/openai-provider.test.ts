import { AiTextAnalysisSchema } from '@kaufcheck/domain';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { OpenAiProvider, toStrictJsonSchema } from './openai-provider';

const Schema = z.object({ summary: z.string().min(3), note: z.string().nullable() });

const request = (overrides: Record<string, unknown> = {}) => ({
  task: 'listing_text' as const,
  system: 'system prompt',
  prompt: 'user prompt',
  schema: Schema,
  schemaName: 'test_schema',
  maxOutputTokens: 1000,
  timeoutMs: 2000,
  ...overrides,
});

function completion(content: string | null, extra: Record<string, unknown> = {}) {
  return new Response(
    JSON.stringify({
      model: 'gpt-test-2026',
      choices: [{ finish_reason: 'stop', message: { content, refusal: null }, ...extra }],
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

function provider(fetchImpl: typeof fetch) {
  return new OpenAiProvider({
    apiKey: 'sk-test',
    model: 'gpt-test',
    baseUrl: 'https://api.example.test/v1/',
    fetchImpl,
  });
}

describe('toStrictJsonSchema', () => {
  it('produces the strict dialect: every property required, no additional properties, no length keywords', () => {
    const schema = toStrictJsonSchema(AiTextAnalysisSchema);
    const json = JSON.stringify(schema);
    expect(json).not.toMatch(/"(minLength|maxLength|minItems|maxItems|\$schema)"/);
    const walk = (node: unknown): void => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (!node || typeof node !== 'object') return;
      const record = node as Record<string, unknown>;
      if (record.type === 'object' && record.properties) {
        expect(record.additionalProperties).toBe(false);
        expect(record.required).toEqual(Object.keys(record.properties));
      }
      Object.values(record).forEach(walk);
    };
    walk(schema);
  });
});

describe('OpenAiProvider', () => {
  it('sends a strict json_schema request and validates the answer', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(completion('{"summary":"Alles gut","note":null}')),
    );
    const result = await provider(fetchImpl).generateStructuredAnalysis(
      request({ images: [{ mediaType: 'image/png', data: 'aGk=' }] }),
    );
    expect(result).toEqual({ data: { summary: 'Alles gut', note: null }, model: 'gpt-test-2026' });

    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe('https://api.example.test/v1/chat/completions');
    expect((init?.headers as Record<string, string>).authorization).toBe('Bearer sk-test');
    const body = JSON.parse(init?.body as string) as {
      model: string;
      max_completion_tokens: number;
      messages: { role: string; content: unknown }[];
      response_format: { type: string; json_schema: { name: string; strict: boolean } };
    };
    expect(body.model).toBe('gpt-test');
    expect(body.max_completion_tokens).toBe(1000);
    expect(body.response_format.type).toBe('json_schema');
    expect(body.response_format.json_schema).toMatchObject({ name: 'test_schema', strict: true });
    const userContent = body.messages[1]?.content as {
      type: string;
      image_url?: { url: string };
    }[];
    expect(userContent.map((part) => part.type)).toEqual(['image_url', 'text']);
    expect(userContent[0]?.image_url?.url).toBe('data:image/png;base64,aGk=');
  });

  it.each([
    ['refusal', completion(null, { message: { content: null, refusal: 'no' } })],
    ['truncated', completion('{"summary":"Alles', { finish_reason: 'length' })],
    ['invalid_output', completion('')],
    ['invalid_output', completion('not json')],
    ['invalid_output', completion('{"summary":"x"}')],
  ])('rejects unusable answers (%s)', async (reason, response) => {
    await expect(
      provider(() => Promise.resolve(response)).generateStructuredAnalysis(request()),
    ).rejects.toMatchObject({ reason });
  });

  it.each([
    [401, 'authentication'],
    [403, 'authentication'],
    [429, 'rate_limited'],
    [500, 'unavailable'],
    [503, 'unavailable'],
    [400, 'bad_request'],
  ])('maps HTTP %i to %s', async (status, reason) => {
    const fetchImpl = () =>
      Promise.resolve(new Response('{"error":{"message":"details"}}', { status }));
    await expect(provider(fetchImpl).generateStructuredAnalysis(request())).rejects.toMatchObject({
      reason,
    });
  });

  it('distinguishes network errors, timeouts and caller aborts', async () => {
    const hang: typeof fetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError')),
        );
      });
    await expect(
      provider(() => Promise.reject(new TypeError('fetch failed'))).generateStructuredAnalysis(
        request(),
      ),
    ).rejects.toMatchObject({ reason: 'unavailable' });
    await expect(
      provider(hang).generateStructuredAnalysis(request({ timeoutMs: 50 })),
    ).rejects.toMatchObject({
      reason: 'timeout',
    });
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 20);
    await expect(
      provider(hang).generateStructuredAnalysis(request({ signal: controller.signal })),
    ).rejects.toMatchObject({ reason: 'aborted' });
  });
});
