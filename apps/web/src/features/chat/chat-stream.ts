import {
  NDJSON_CONTENT_TYPE,
  type ChatCard,
  type ChatStreamEvent,
  type ChatTurn,
} from '@kaufcheck/shared';
import { ApiRequestError, errorFromResponse, toApiRequestError } from '../../api/client';
import { parseApiError } from '../../api/guards';

const CARD_TYPES: readonly ChatCard['type'][] = [
  'analysis',
  'search',
  'tax',
  'financing',
  'model',
  'advisor',
  'rdw',
  'links',
  'form',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTurn(value: unknown): value is ChatTurn {
  return (
    isRecord(value) &&
    (value.role === 'user' || value.role === 'assistant') &&
    typeof value.content === 'string' &&
    (value.context === undefined || typeof value.context === 'string')
  );
}

/**
 * One line of the chat stream. Our own server builds every card from
 * validated data; the browser only guards against version skew.
 */
export function parseChatEvent(value: unknown): ChatStreamEvent | null {
  if (!isRecord(value)) return null;
  switch (value.type) {
    case 'text':
      return typeof value.delta === 'string' ? { type: 'text', delta: value.delta } : null;
    case 'tool':
      return typeof value.label === 'string' &&
        (value.status === 'started' || value.status === 'completed' || value.status === 'failed')
        ? { type: 'tool', label: value.label, status: value.status }
        : null;
    case 'card':
      return isRecord(value.card) && CARD_TYPES.includes(value.card.type as ChatCard['type'])
        ? { type: 'card', card: value.card as ChatCard }
        : null;
    case 'done': {
      const usage = value.usage;
      if (!isTurn(value.turn) || !isRecord(usage)) return null;
      if (typeof usage.used !== 'number' || typeof usage.limit !== 'number') return null;
      return {
        type: 'done',
        turn: value.turn,
        replaceUserMessage:
          typeof value.replaceUserMessage === 'string' ? value.replaceUserMessage : null,
        usage: {
          used: usage.used,
          limit: usage.limit,
          resetsOn: typeof usage.resetsOn === 'string' ? usage.resetsOn : '',
        },
        fallbackModel: value.fallbackModel === true,
      };
    }
    case 'error': {
      const error = parseApiError(value.error);
      return error ? { type: 'error', error } : null;
    }
    default:
      return null;
  }
}

const brokenStream = () =>
  new ApiRequestError(
    {
      code: 'SERVICE_UNAVAILABLE',
      message: 'Die Verbindung wurde unterbrochen. Bitte versuch es noch einmal.',
    },
    0,
  );

/**
 * Sends the conversation and hands each event of the streamed answer to
 * `onEvent`. Rejects with an {@link ApiRequestError} before the first event
 * (e.g. the daily limit) or when the stream breaks.
 */
export async function streamChat(
  messages: readonly ChatTurn[],
  options: { signal: AbortSignal; onEvent: (event: ChatStreamEvent) => void },
): Promise<void> {
  let response: Response;
  try {
    response = await fetch('/api/chat', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', accept: NDJSON_CONTENT_TYPE },
      body: JSON.stringify({ messages }),
      signal: options.signal,
    });
  } catch (error) {
    throw toApiRequestError(error);
  }
  if (!response.ok) throw await errorFromResponse(response);
  if (!response.body) throw brokenStream();

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  let finished = false;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let newline = buffer.indexOf('\n');
      while (newline !== -1) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf('\n');
        if (!line) continue;
        const event = parseChatEvent(JSON.parse(line));
        if (!event) continue;
        if (event.type === 'done' || event.type === 'error') finished = true;
        options.onEvent(event);
      }
    }
  } catch (error) {
    throw toApiRequestError(error);
  } finally {
    reader.cancel().catch(() => undefined);
  }
  if (!finished) throw brokenStream();
}
