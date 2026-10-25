import type Anthropic from '@anthropic-ai/sdk';
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
});
