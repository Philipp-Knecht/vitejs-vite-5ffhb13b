import {
  ChatStreamEventSchema,
  type ChatCard,
  type ChatStreamEvent,
  type ChatTurn,
} from '@kaufcheck/shared';
import type { LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { BuiltApp } from '../src/app';
import type {
  ChatModel,
  ChatModelRequest,
  ChatModelTurn,
} from '../src/infrastructure/ai/chat-model';
import { createTestApp, PASTED_LISTING, resetDatabase, TestClient } from './helpers';

function events(response: LightMyRequestResponse): ChatStreamEvent[] {
  return response.body
    .trim()
    .split('\n')
    .map((line) => ChatStreamEventSchema.parse(JSON.parse(line)));
}

const user = (content: string): ChatTurn => ({ role: 'user', content });
const cards = (list: ChatStreamEvent[]) =>
  list.flatMap((event): ChatCard[] => (event.type === 'card' ? [event.card] : []));
const done = (list: ChatStreamEvent[]) =>
  list.find((event): event is Extract<ChatStreamEvent, { type: 'done' }> => event.type === 'done');
const text = (list: ChatStreamEvent[]) =>
  list.map((event) => (event.type === 'text' ? event.delta : '')).join('');

describe('chat with the scripted development model', () => {
  let built: BuiltApp;
  beforeAll(async () => {
    built = await createTestApp({
      AI_PROVIDER: 'mock',
      CHAT_DAILY_FREE: '3',
      ANON_MONTHLY_ANALYSES: '100',
    });
    await resetDatabase(built.services.db);
  });
  afterAll(() => built.app.close());

  it('checks a pasted listing and keeps a short version of it', async () => {
    const client = new TestClient(built.app);
    const response = await client.post('/api/chat', { messages: [user(PASTED_LISTING)] });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/x-ndjson');
    const list = events(response);
    expect(list).toContainEqual({ type: 'tool', label: 'Prüfe das Inserat', status: 'started' });
    const [card] = cards(list);
    expect(card).toMatchObject({ type: 'analysis', title: 'VW Golf 1.4 TSI Highline' });
    if (card?.type !== 'analysis') return;
    // The check is stored like any other and counts as one.
    expect((await client.get(`/api/analyses/${card.analysisId}`)).statusCode).toBe(200);
    const end = done(list);
    expect(end?.replaceUserMessage).toBe(
      `[Inserat eingefügt: VW Golf 1.4 TSI Highline, 8.450\u00A0€ VB – geprüft: /analyse/${card.analysisId}]`,
    );
    expect(end?.turn.context).toContain(`/analyse/${card.analysisId}`);
    expect(end?.usage).toMatchObject({ used: 1, limit: 3 });
    expect(text(list)).toContain('(Entwicklungsmodus)');
  });

  it('computes a financing from a filled-in form', async () => {
    const client = new TestClient(built.app);
    const list = events(
      await client.post('/api/chat', {
        messages: [
          user('Finanzierung berechnen: Kaufpreis 12.000 €, Anzahlung 2.000 €, Laufzeit 48 Monate'),
        ],
      }),
    );
    expect(cards(list)).toEqual([
      expect.objectContaining({
        type: 'financing',
        priceEur: 12_000,
        downPaymentEur: 2_000,
        amountEur: 10_000,
        months: 48,
        averageRate: true,
      }),
    ]);
  });

  it('builds search links and shows forms', async () => {
    const client = new TestClient(built.app);
    const search = cards(
      events(await client.post('/api/chat', { messages: [user('Such mir einen Golf')] })),
    );
    expect(search[0]).toMatchObject({
      type: 'search',
      summary: 'Volkswagen Golf, bis 10.000\u00A0€',
    });
    if (search[0]?.type === 'search') {
      expect(search[0].findUrl).toMatch(/^\/auto-finden\?marke=vw&modell=vw-golf/);
      expect(search[0].links.map((link) => link.name)).toContain('mobile.de');
    }
    const form = cards(
      events(await client.post('/api/chat', { messages: [user('Was kostet die Steuer?')] })),
    );
    expect(form).toEqual([{ type: 'form', form: 'tax', prefill: {} }]);
  });

  it('stops at the daily limit with a plain 429, before anything streams', async () => {
    const client = new TestClient(built.app);
    for (let index = 0; index < 3; index += 1)
      expect((await client.post('/api/chat', { messages: [user('Hallo')] })).statusCode).toBe(200);
    const response = await client.post('/api/chat', { messages: [user('Hallo')] });
    expect(response.statusCode).toBe(429);
    const { error } = response.json<{ error: { code: string; message: string } }>();
    expect(error.code).toBe('USAGE_LIMIT_REACHED');
    expect(error.message).toContain('heute schon 3 Nachrichten');
  });

  it('rejects a conversation that does not end with the visitor', async () => {
    const client = new TestClient(built.app);
    const response = await client.post('/api/chat', {
      messages: [user('Hallo'), { role: 'assistant', content: 'Hi' }],
    });
    expect(response.statusCode).toBe(400);
  });

  it('says in the configuration that the chat is there', async () => {
    const config = (await new TestClient(built.app).get('/api/config')).json<{
      features: { chat: unknown };
    }>();
    expect(config.features.chat).toEqual({ isMock: true, dailyFree: 3, dailyPro: 150 });
  });
});

/** A model that plays back fixed turns and records what it was sent. */
class ScriptedModel implements ChatModel {
  readonly model = 'scripted';
  readonly isMock = true;
  readonly requests: ChatModelRequest[] = [];
  constructor(private readonly script: ((request: ChatModelRequest) => ChatModelTurn)[]) {}
  turn(request: ChatModelRequest): Promise<ChatModelTurn> {
    this.requests.push({ ...request, messages: [...request.messages] });
    const next = this.script.shift();
    if (!next) throw new Error('script ended');
    return Promise.resolve(next(request));
  }
}

const say =
  (value: string) =>
  (request: ChatModelRequest): ChatModelTurn => {
    request.onText(value);
    return { text: value, toolCalls: [], stop: 'end', fallback: false, raw: [] };
  };
const call = (name: string, input: unknown) => (): ChatModelTurn => ({
  text: '',
  toolCalls: [{ id: `call_${name}`, name, input }],
  stop: 'tool_use',
  fallback: false,
  raw: [],
});

describe('chat tool loop', () => {
  let built: BuiltApp | undefined;
  afterAll(() => built?.app.close());

  async function run(model: ScriptedModel, env: Record<string, string> = {}) {
    await built?.app.close();
    built = await createTestApp(env, { chatModel: model });
    await resetDatabase(built.services.db);
    return events(
      await new TestClient(built.app).post('/api/chat', { messages: [user('Bitte rechnen')] }),
    );
  }

  it('answers invalid tool input with an error the model can correct', async () => {
    const model = new ScriptedModel([
      call('financing', { price_eur: 'zwölftausend' }),
      call('nonexistent', {}),
      say('Ich brauche den Kaufpreis als Zahl.'),
    ]);
    const list = await run(model);
    const results = model.requests[1]?.messages.at(-1);
    expect(results?.role).toBe('tool_results');
    const [result] = results?.role === 'tool_results' ? results.results : [];
    expect(result?.isError).toBe(true);
    expect(result?.content).toContain('Ungültige Eingabe');
    expect(model.requests[2]?.messages.at(-1)).toMatchObject({
      role: 'tool_results',
      results: [{ isError: true, content: 'Unbekanntes Werkzeug.' }],
    });
    expect(cards(list)).toEqual([]);
    expect(done(list)?.turn.content).toBe('Ich brauche den Kaufpreis als Zahl.');
  });

  it('sends the date and the cached instructions, and tells about a fallback model', async () => {
    const model = new ScriptedModel([
      (request) => {
        request.onText('Gern.');
        return { text: 'Gern.', toolCalls: [], stop: 'end', fallback: true, raw: [] };
      },
    ]);
    const list = await run(model);
    expect(model.requests[0]?.system.stable).toContain('Du bist der Assistent von KaufCheck');
    expect(model.requests[0]?.system.dynamic).toMatch(/^Heute ist der \d{2}\.\d{2}\.\d{4}\.$/);
    expect(model.requests[0]?.tools.map((tool) => tool.name)).toContain('analyze_listing');
    expect(done(list)?.fallbackModel).toBe(true);
  });

  it('gives the message back when the model is unreachable', async () => {
    const model = new ScriptedModel([]);
    const list = await run(model, { CHAT_DAILY_FREE: '1' });
    expect(list.at(-1)).toMatchObject({ type: 'error', error: { code: 'SERVICE_UNAVAILABLE' } });
    // The failed message did not count: the next one gets through.
    const again = await new TestClient(built!.app).post('/api/chat', {
      messages: [user('Hallo')],
    });
    expect(again.statusCode).toBe(200);
  });

  it('stops all visitors at the daily total', async () => {
    const model = new ScriptedModel([say('Eins.')]);
    await run(model, { CHAT_DAILY_TOTAL: '1' });
    const response = await new TestClient(built!.app).post('/api/chat', {
      messages: [user('Hallo')],
    });
    expect(response.statusCode).toBe(503);
  });

  it('is off without a model', async () => {
    await built?.app.close();
    built = await createTestApp({}, { chatModel: null });
    const response = await new TestClient(built.app).post('/api/chat', {
      messages: [user('Hallo')],
    });
    expect(response.statusCode).toBe(503);
  });
});
