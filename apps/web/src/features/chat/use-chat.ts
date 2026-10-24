import {
  CHAT_LIMITS,
  type ChatCard,
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
    }
  /** A form the visitor opened from a suggestion: no message to the server yet. */
  | { id: string; role: 'local'; card: ChatCard };

interface Stored {
  version: 1;
  items: ChatItem[];
  history: ChatTurn[];
  usage: ChatUsage | null;
}

/** Kept for this tab only and gone when it closes. */
const STORAGE_KEY = 'kaufcheck:chat';
const MAX_ITEMS = 60;

function load(): Stored {
  const empty: Stored = { version: 1, items: [], history: [], usage: null };
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const value = JSON.parse(raw) as Partial<Stored>;
    if (value.version !== 1 || !Array.isArray(value.items) || !Array.isArray(value.history))
      return empty;
    // An answer cut off by a reload stays cut off.
    const items = value.items.map((item) =>
      item.role === 'assistant' && item.status === 'streaming'
        ? { ...item, status: 'error' as const, error: 'Die Antwort wurde unterbrochen.' }
        : item,
    );
    return { version: 1, items, history: value.history, usage: value.usage ?? null };
  } catch {
    return empty;
  }
}

function save(state: Stored): void {
  try {
    window.sessionStorage.setItem(
      STORAGE_KEY,
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

  useEffect(() => save(state), [state]);
  useEffect(() => () => controller.current?.abort(), []);

  const send = useCallback(
    (text: string) => {
      const content = text.trim().slice(0, CHAT_LIMITS.messageChars);
      if (!content || busy) return;
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
                  ? { ...item, status: 'done', fallback: event.fallbackModel }
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
          if (controller.current === current) controller.current = null;
          setBusy(false);
        });
    },
    [busy, state.history],
  );

  /** Shows a form in the chat without asking the server. */
  const showForm = useCallback((card: ChatCard) => {
    setState((current) => ({
      ...current,
      items: [...current.items, { id: nextId(), role: 'local', card }],
    }));
  }, []);

  const reset = useCallback(() => {
    controller.current?.abort();
    setBusy(false);
    setState((current) => ({ version: 1, items: [], history: [], usage: current.usage }));
  }, []);

  return { items: state.items, usage: state.usage, busy, send, showForm, reset };
}
