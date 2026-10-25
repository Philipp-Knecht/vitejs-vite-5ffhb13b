import {
  CHAT_LIMITS,
  germanDay,
  type ChatCard,
  type ChatJump,
  type ChatStreamEvent,
  type ChatTurn,
  type ChatUsage,
} from '@kaufcheck/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiRequestError } from '../../api/client';
import { streamChat } from './chat-stream';

export interface ChatToolStep {
  label: string;
  status: 'started' | 'completed' | 'failed';
}

export type ChatItem =
  | { id: string; role: 'user'; text: string }
  | {
      id: string;
      role: 'assistant';
      text: string;
      cards: ChatCard[];
      tools: ChatToolStep[];
      status: 'streaming' | 'done' | 'error';
      error?: string;
      fallback?: boolean;
      /** Pages of KaufCheck to do it yourself, from the server. */
      jumps?: ChatJump[];
    }
  /** A form the visitor opened from a suggestion: no message to the server yet. */
  | { id: string; role: 'local'; card: ChatCard }
  /** A hint of the page itself (no message to the server), e.g. where to paste a listing. */
  | { id: string; role: 'hint'; text: string };

interface Stored {
  version: 1;
  items: ChatItem[];
  history: ChatTurn[];
  usage: ChatUsage | null;
}

/** Kept for this tab only and gone when it closes. */
export const CHAT_STORAGE_KEY = 'kaufcheck:chat';
const MAX_ITEMS = 60;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isCard = (value: unknown): value is ChatCard =>
  isRecord(value) && typeof value.type === 'string';

/** Drops what an older version of the page left behind; the chat's error boundary catches the rest. */
function isItem(value: unknown): value is ChatItem {
  if (!isRecord(value) || typeof value.id !== 'string') return false;
  switch (value.role) {
    case 'user':
      return typeof value.text === 'string';
    case 'local':
      return isCard(value.card);
    case 'hint':
      return typeof value.text === 'string';
    case 'assistant':
      return (
        typeof value.text === 'string' &&
        Array.isArray(value.cards) &&
        value.cards.every(isCard) &&
        Array.isArray(value.tools)
      );
    default:
      return false;
  }
}

const isTurn = (value: unknown): value is ChatTurn =>
  isRecord(value) &&
  (value.role === 'user' || value.role === 'assistant') &&
  typeof value.content === 'string';

const isUsage = (value: unknown): value is ChatUsage =>
  isRecord(value) &&
  typeof value.used === 'number' &&
  typeof value.limit === 'number' &&
  typeof value.resetsOn === 'string';

function load(): Stored {
  const empty: Stored = { version: 1, items: [], history: [], usage: null };
  try {
    const raw = window.sessionStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return empty;
    const value = JSON.parse(raw) as unknown;
    if (!isRecord(value) || value.version !== 1) return empty;
    if (!Array.isArray(value.items) || !Array.isArray(value.history)) return empty;
    // An answer cut off by a reload stays cut off.
    const items = value.items
      .filter(isItem)
      .map((item) =>
        item.role === 'assistant' && item.status === 'streaming'
          ? { ...item, status: 'error' as const, error: 'Die Antwort wurde unterbrochen.' }
          : item,
      );
    return {
      version: 1,
      items,
      history: value.history.filter(isTurn),
      // Yesterday's count no longer applies.
      usage:
        isUsage(value.usage) && germanDay(new Date()) < value.usage.resetsOn ? value.usage : null,
    };
  } catch {
    return empty;
  }
}

function save(state: Stored): void {
  try {
    window.sessionStorage.setItem(
      CHAT_STORAGE_KEY,
      JSON.stringify({ ...state, items: state.items.slice(-MAX_ITEMS) }),
    );
  } catch {
    // Not kept – the chat still works.
  }
}

/**
 * The conversation sent to the server: the newest turns within the limits,
 * starting with a message of the visitor.
 */
export function trimHistory(turns: readonly ChatTurn[]): ChatTurn[] {
  let kept = turns.slice(-CHAT_LIMITS.historyMessages);
  const size = (list: readonly ChatTurn[]) =>
    list.reduce((sum, turn) => sum + turn.content.length + (turn.context?.length ?? 0), 0);
  while (kept.length > 1 && (size(kept) > CHAT_LIMITS.historyChars || kept[0]?.role !== 'user'))
    kept = kept.slice(1);
  return kept;
}

let counter = 0;
const nextId = () => `c${Date.now().toString(36)}${(counter += 1)}`;

export function useChat() {
  const [state, setState] = useState<Stored>(load);
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  // Two clicks in one frame must not send twice; `busy` only changes on the next render.
  const sending = useRef(false);

  useEffect(() => save(state), [state]);
  useEffect(() => () => controller.current?.abort(), []);

  const send = useCallback(
    (text: string) => {
      const content = text.trim();
      if (!content || content.length > CHAT_LIMITS.messageChars || busy || sending.current) return;
      sending.current = true;
      const assistantId = nextId();
      const turns = trimHistory([...state.history, { role: 'user', content }]);
      setState((current) => ({
        ...current,
        items: [
          ...current.items,
          { id: nextId(), role: 'user', text: content },
          {
            id: assistantId,
            role: 'assistant',
            text: '',
            cards: [],
            tools: [],
            status: 'streaming',
          },
        ],
      }));
      setBusy(true);

      const update = (change: (item: Extract<ChatItem, { role: 'assistant' }>) => ChatItem) =>
        setState((current) => ({
          ...current,
          items: current.items.map((item) =>
            item.id === assistantId && item.role === 'assistant' ? change(item) : item,
          ),
        }));

      const onEvent = (event: ChatStreamEvent) => {
        switch (event.type) {
          case 'text':
            update((item) => ({ ...item, text: item.text + event.delta }));
            break;
          case 'retract':
            update((item) => ({ ...item, text: item.text.slice(0, event.length) }));
            break;
          case 'tool':
            update((item) => {
              const index = item.tools.findLastIndex(
                (step) => step.label === event.label && step.status === 'started',
              );
              const tools =
                event.status !== 'started' && index !== -1
                  ? item.tools.map((step, i) =>
                      i === index ? { ...step, status: event.status } : step,
                    )
                  : [...item.tools, { label: event.label, status: event.status }];
              return { ...item, tools };
            });
            break;
          case 'card':
            update((item) => ({ ...item, cards: [...item.cards, event.card] }));
            break;
          case 'done':
            setState((current) => ({
              ...current,
              history: [
                ...turns.slice(0, -1),
                { role: 'user', content: event.replaceUserMessage ?? content },
                event.turn,
              ],
              usage: event.usage,
              items: current.items.map((item) =>
                item.id === assistantId && item.role === 'assistant'
                  ? { ...item, status: 'done', fallback: event.fallbackModel, jumps: event.jumps }
                  : item,
              ),
            }));
            break;
          case 'error':
            update((item) => ({ ...item, status: 'error', error: event.error.message }));
            break;
        }
      };

      controller.current?.abort();
      const current = new AbortController();
      controller.current = current;
      streamChat(turns, { signal: current.signal, onEvent })
        .catch((error: unknown) => {
          if (error instanceof ApiRequestError && error.code === 'REQUEST_ABORTED') return;
          const details = error instanceof ApiRequestError ? error.details : undefined;
          if (
            error instanceof ApiRequestError &&
            error.code === 'USAGE_LIMIT_REACHED' &&
            details?.limit !== undefined &&
            details.resetsAt !== undefined
          ) {
            const { limit, resetsAt } = details;
            setState((current) => ({
              ...current,
              usage: { used: details.used ?? limit, limit, resetsOn: resetsAt },
            }));
          }
          update((item) => ({
            ...item,
            status: 'error',
            error:
              error instanceof ApiRequestError
                ? error.message
                : 'Das hat nicht geklappt. Bitte versuch es noch einmal.',
          }));
        })
        .finally(() => {
          if (controller.current !== current) return;
          controller.current = null;
          sending.current = false;
          setBusy(false);
        });
    },
    [busy, state.history],
  );

  /** Shows a hint of the page in the chat, without asking the server. */
  const showHint = useCallback((text: string) => {
    setState((current) => ({
      ...current,
      items: [...current.items, { id: nextId(), role: 'hint', text }],
    }));
  }, []);

  /** Shows a form in the chat without asking the server; returns its id. */
  const showForm = useCallback((card: ChatCard) => {
    const id = nextId();
    setState((current) => ({
      ...current,
      items: [...current.items, { id, role: 'local', card }],
    }));
    return id;
  }, []);

  const reset = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
    sending.current = false;
    setBusy(false);
    setState((current) => ({ version: 1, items: [], history: [], usage: current.usage }));
  }, []);

  return { items: state.items, usage: state.usage, busy, send, showForm, showHint, reset };
}
