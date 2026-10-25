import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { AnthropicChatModel } from './anthropic-chat-model';
import type { ChatModelRequest } from './chat-model';

/** A client that answers every request with one fixed message and records the request. */
function fakeClient(content: unknown[], stopReason = 'tool_use') {
  const requests: Record<string, unknown>[] = [];
  const client = {
    beta: {
      messages: {
        stream: (body: Record<string, unknown>) => {
          requests.push(body);
          return {
            on: () => undefined,
            finalMessage: () =>
              Promise.resolve({
                content,
                stop_reason: stopReason,
                usage: { iterations: [{ type: 'message' }, { type: 'fallback_message' }] },
              }),
          };
        },
      },
    },
  } as unknown as Anthropic;
  return { client, requests };
}

const request = (): ChatModelRequest => ({
  system: { stable: 'System', dynamic: 'Heute' },
  tools: [
    { name: 'financing', description: 'Rechnet', inputSchema: { type: 'object' }, strict: true },
    { name: 'search_cars', description: 'Sucht', inputSchema: { type: 'object' }, strict: false },
  ],
  messages: [{ role: 'user', text: 'Hallo' }],
  signal: new AbortController().signal,
  onText: () => undefined,
});

describe('AnthropicChatModel', () => {
  it('runs only the tool calls of the model that answered after a fallback', async () => {
    const { client } = fakeClient([
      { type: 'thinking', thinking: '', signature: 'a' },
      { type: 'text', text: 'Ich rechne ' },
      { type: 'tool_use', id: 'declined', name: 'financing', input: { price_eur: 1 } },
      { type: 'fallback', model: 'claude-opus-5' },
      { type: 'text', text: 'das durch.' },
      { type: 'tool_use', id: 'kept', name: 'financing', input: { price_eur: 2 } },
    ]);
    const model = new AnthropicChatModel({
      apiKey: 'x',
      model: 'claude-opus-5-5',
      effort: 'low',
      client,
    });
    const turn = await model.turn(request());
    expect(turn.toolCalls.map((call) => call.id)).toEqual(['kept']);
    expect(turn.fallback).toBe(true);
    expect((turn.raw as { type: string }[]).map((block) => block.type)).toEqual([
      'text',
      'text',
      'tool_use',
    ]);
  });

  it('marks only the tools meant to be strict', async () => {
    const { client, requests } = fakeClient([{ type: 'text', text: 'Hallo' }], 'end_turn');
    const model = new AnthropicChatModel({
      apiKey: 'x',
      model: 'claude-opus-5-5',
      effort: 'low',
      client,
    });
    await model.turn(request());
    expect(requests[0]?.tools).toMatchObject([
      { name: 'financing', strict: true },
      { name: 'search_cars', strict: false },
    ]);
  });

  it('falls back to the basic request once the API rejects the full one, and says why', async () => {
    const bodies: Record<string, unknown>[] = [];
    const rejected: string[] = [];
    const client = {
      beta: {
        messages: {
          stream: (body: Record<string, unknown>) => {
            bodies.push(body);
            const tools = body.tools as Record<string, unknown>[];
            const full = tools.some((tool) => 'strict' in tool);
            return {
              on: () => undefined,
              finalMessage: () =>
                full
                  ? Promise.reject(
                      new Anthropic.BadRequestError(
                        400,
                        {
                          type: 'error',
                          error: {
                            type: 'invalid_request_error',
                            message: 'tools.0: unsupported field',
                          },
                        },
                        'tools.0: unsupported field',
                        new Headers(),
                      ),
                    )
                  : Promise.resolve({
                      content: [{ type: 'text', text: 'Hallo' }],
                      stop_reason: 'end_turn',
                      usage: {},
                    }),
            };
          },
        },
      },
    } as unknown as Anthropic;
    const model = new AnthropicChatModel({
      apiKey: 'x',
      model: 'claude-opus-5-5',
      effort: 'low',
      client,
      onRejected: (detail) => rejected.push(detail),
    });
    expect((await model.turn(request())).text).toBe('Hallo');
    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toContain('tools.0: unsupported field');
    expect(bodies[1]).not.toHaveProperty('cache_control');
    expect(bodies[1]).not.toHaveProperty('fallbacks');
    // Later turns go straight to the basic request.
    await model.turn(request());
    expect(bodies).toHaveLength(3);
    expect(bodies[2]?.tools).toEqual([
      { name: 'financing', description: 'Rechnet', input_schema: { type: 'object' } },
      { name: 'search_cars', description: 'Sucht', input_schema: { type: 'object' } },
    ]);
  });
});
