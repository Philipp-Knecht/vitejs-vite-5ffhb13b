import { CHAT_LIMITS, type ChatCard, type ChatStreamEvent, type ChatTurn } from '@kaufcheck/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiRequestError } from '../../api/client';
import { streamChat } from './chat-stream';
import {
  currentChatId,
  loadChat,
  loadUsage,
  pruneStoredChats,
  saveChat,
  saveUsage,
  setCurrentChatId,
  useStoredChats,
  type ChatItem,
  type StoredUsage,
} from './chat-store';

export type { ChatItem, ChatToolStep } from './chat-store';

interface Conversation {
  id: string;
  items: ChatItem[];
  history: ChatTurn[];
  /** When this tab last wrote or read it: a newer copy from another tab is taken over. */
  updatedAt: number;
}

/** What screen readers hear when another conversation shows. */
export interface ChatNotice {
  id: string;
  text: string;
  /** Deleted in another tab or by logging out there: what is typed stays. */
  external: boolean;
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
  updatedAt: 0,
});

const storedConversation = (id: string): Conversation | null => {
  const stored = loadChat(id);
  return (
    stored && {
      id: stored.id,
      items: stored.items,
      history: stored.history,
      updatedAt: stored.updatedAt,
    }
  );
};

/** The conversation of this tab, or a new one. */
function loadCurrent(): Conversation {
  const id = currentChatId();
  return (id && storedConversation(id)) || newConversation();
}

const streaming = (items: readonly ChatItem[]) =>
  items.some((item) => item.role === 'assistant' && item.status === 'streaming');

/** Shows another tab's newer copy of the open conversation. */
function takeOver(set: (next: Conversation) => void, next: Conversation): void {
  set(next);
}

/**
 * The conversation of the start page. `plan` is the visitor's plan once known: the daily
 * count kept on the device only applies to the plan it was counted for, so a count used up
 * without an account does not block after signing up or buying Pro.
 */
export function useChat(plan: string | null) {
  const [conversation, setConversation] = useState<Conversation>(loadCurrent);
  const [usage, setUsage] = useState<StoredUsage | null>(loadUsage);
  const [notice, setNotice] = useState<ChatNotice | null>(null);
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  // Two clicks in one frame must not send twice; `busy` only changes on the next render.
  const sending = useRef(false);
  // What is already on the device: opening a chat does not make it the newest.
  const saved = useRef<{ conversation: Conversation; count: number }>({
    conversation,
    count: conversation.items.length,
  });
  // Kept on the device once (so gone from there means deleted), and when this tab last
  // wrote or read it (so a newer copy is another tab's).
  const kept = useRef(conversation.updatedAt > 0);
  const stamp = useRef(conversation.updatedAt);
  const chats = useStoredChats();

  useEffect(() => setCurrentChatId(conversation.id), [conversation.id]);
  useEffect(() => pruneStoredChats(), []);

  useEffect(() => {
    if (conversation === saved.current.conversation) return;
    // While an answer streams in, only a new message is written – not every word.
    if (streaming(conversation.items) && conversation.items.length === saved.current.count) return;
    saved.current = { conversation, count: conversation.items.length };
    const updatedAt = Date.now();
    if (saveChat({ ...conversation, updatedAt }, kept.current)) {
      kept.current = true;
      stamp.current = updatedAt;
    }
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
    (next: Conversation, text: string | null, external = false) => {
      stop();
      saved.current = { conversation: next, count: next.items.length };
      kept.current = next.updatedAt > 0;
      stamp.current = next.updatedAt;
      setConversation(next);
      setNotice(text === null ? null : { id: next.id, text, external });
    },
    [stop],
  );

  const reset = useCallback(() => show(newConversation(), 'Neuer Chat.'), [show]);

  /** Opens a conversation kept on this device. */
  const open = useCallback(
    (id: string) => {
      const stored = storedConversation(id);
      if (stored) show(stored, `Chat „${loadChat(id)?.title ?? ''}“ geöffnet.`);
    },
    [show],
  );

  // Deleted here or in another tab (or by logging out there): the chat starts over. Written
  // by another tab that has it open too: its newer copy is taken over.
  useEffect(() => {
    // Read afresh: this tab may have saved it a moment ago, after `chats` was read.
    const stored = loadChat(conversation.id);
    if (!stored) {
      if (kept.current) show(newConversation(), 'Dieser Chat wurde gelöscht. Neuer Chat.', true);
      return;
    }
    if (!busy && stored.updatedAt > stamp.current) {
      const next = storedConversation(stored.id);
      if (next) {
        saved.current = { conversation: next, count: next.items.length };
        stamp.current = next.updatedAt;
        takeOver(setConversation, next);
      }
    }
  }, [chats, conversation.id, busy, show]);

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
            setUsage({ ...event.usage, plan: plan ?? '' });
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
            setUsage({ used: details.used ?? limit, limit, resetsOn: resetsAt, plan: plan ?? '' });
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
    [busy, conversation.id, conversation.history, plan],
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
    // A count for another plan (before signing up, before Pro) no longer applies.
    usage: usage && plan !== null && usage.plan === plan ? usage : null,
    notice: notice?.id === conversation.id ? notice : null,
    busy,
    send,
    showForm,
    showHint,
    reset,
    open,
  };
}

export type Chat = ReturnType<typeof useChat>;
