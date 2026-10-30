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
import {
  currentChatId,
  loadChat,
  loadUsage,
  saveChat,
  saveUsage,
  setCurrentChatId,
  useStoredChats,
  type ChatItem,
} from './chat-store';

export type { ChatItem, ChatToolStep } from './chat-store';

interface Conversation {
  id: string;
  items: ChatItem[];
  history: ChatTurn[];
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
const newConversation = (): Conversation => ({
  id: `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
  items: [],
  history: [],
});

/** The conversation of this tab, or a new one. */
function loadCurrent(): Conversation {
  const id = currentChatId();
  const stored = id ? loadChat(id) : null;
  return stored
    ? { id: stored.id, items: stored.items, history: stored.history }
    : newConversation();
}

const streaming = (items: readonly ChatItem[]) =>
  items.some((item) => item.role === 'assistant' && item.status === 'streaming');

export function useChat() {
  const [conversation, setConversation] = useState<Conversation>(loadCurrent);
  const [usage, setUsage] = useState<ChatUsage | null>(loadUsage);
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  // Two clicks in one frame must not send twice; `busy` only changes on the next render.
  const sending = useRef(false);
  // What is already on the device: opening a chat does not make it the newest.
  const saved = useRef<{ conversation: Conversation; count: number }>({
    conversation,
    count: conversation.items.length,
  });
  const chats = useStoredChats();
  const kept = useRef(false);

  useEffect(() => setCurrentChatId(conversation.id), [conversation.id]);

  useEffect(() => {
    if (conversation === saved.current.conversation) return;
    // While an answer streams in, only a new message is written – not every word.
    if (streaming(conversation.items) && conversation.items.length === saved.current.count) return;
    saved.current = { conversation, count: conversation.items.length };
    saveChat({ ...conversation, updatedAt: Date.now() });
  }, [conversation]);

  useEffect(() => saveUsage(usage), [usage]);

  const stop = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
    sending.current = false;
    setBusy(false);
  }, []);

  useEffect(() => () => controller.current?.abort(), []);

  const show = useCallback(
    (next: Conversation) => {
      stop();
      saved.current = { conversation: next, count: next.items.length };
      kept.current = false;
      setConversation(next);
    },
    [stop],
  );

  const reset = useCallback(() => show(newConversation()), [show]);

  /** Opens a conversation kept on this device. */
  const open = useCallback(
    (id: string) => {
      const stored = loadChat(id);
      if (stored) show({ id: stored.id, items: stored.items, history: stored.history });
    },
    [show],
  );

  // Deleted here or in another tab (or logged out there): the chat starts over.
  const present = chats.some((chat) => chat.id === conversation.id);
  useEffect(() => {
    if (present) kept.current = true;
    else if (kept.current) reset();
  }, [present, reset]);

  const send = useCallback(
    (text: string) => {
      const content = text.trim();
      if (!content || content.length > CHAT_LIMITS.messageChars || busy || sending.current) return;
      sending.current = true;
      const chatId = conversation.id;
      const assistantId = nextId();
      const turns = trimHistory([...conversation.history, { role: 'user', content }]);
      setConversation((current) => ({
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

      /** Changes this conversation only: another one may be open by now. */
      const change = (apply: (current: Conversation) => Conversation) =>
        setConversation((current) => (current.id === chatId ? apply(current) : current));
      const update = (edit: (item: Extract<ChatItem, { role: 'assistant' }>) => ChatItem) =>
        change((current) => ({
          ...current,
          items: current.items.map((item) =>
            item.id === assistantId && item.role === 'assistant' ? edit(item) : item,
          ),
        }));

      const onEvent = (event: ChatStreamEvent) => {
        switch (event.type) {
          case 'text':
            update((item) => ({ ...item, text: item.text + event.delta }));
            break;
          case 'jump':
            update((item) =>
              item.jumps?.some((jump) => jump.href === event.jump.href) ||
              (item.jumps?.length ?? 0) >= 3
                ? item
                : { ...item, jumps: [...(item.jumps ?? []), event.jump] },
            );
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
            setUsage(event.usage);
            change((current) => ({
              ...current,
              history: [
                ...turns.slice(0, -1),
                { role: 'user', content: event.replaceUserMessage ?? content },
                event.turn,
              ],
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
            setUsage({ used: details.used ?? limit, limit, resetsOn: resetsAt });
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
    [busy, conversation.id, conversation.history],
  );

  /** Shows a hint of the page in the chat, without asking the server. */
  const showHint = useCallback((text: string) => {
    setConversation((current) => ({
      ...current,
      items: [...current.items, { id: nextId(), role: 'hint', text }],
    }));
  }, []);

  /** Shows a form in the chat without asking the server; returns its id. */
  const showForm = useCallback((card: ChatCard) => {
    const id = nextId();
    setConversation((current) => ({
      ...current,
      items: [...current.items, { id, role: 'local', card }],
    }));
    return id;
  }, []);

  return {
    id: conversation.id,
    items: conversation.items,
    usage,
    busy,
    send,
    showForm,
    showHint,
    reset,
    open,
  };
}

export type Chat = ReturnType<typeof useChat>;
