import {
  CHAT_FORMS,
  germanDay,
  type ChatCard,
  type ChatJump,
  type ChatTurn,
  type ChatUsage,
} from '@kaufcheck/shared';
import { useSyncExternalStore } from 'react';

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

/** One conversation, as kept on this device. */
export interface StoredChat {
  id: string;
  title: string;
  /** Milliseconds since the epoch of the last message. */
  updatedAt: number;
  items: ChatItem[];
  history: ChatTurn[];
}

interface Store {
  version: 2;
  chats: StoredChat[];
  usage: ChatUsage | null;
}

/** Past conversations stay on this device only (localStorage), never on the server. */
export const CHATS_STORAGE_KEY = 'kaufcheck:chats';
/** The conversation open in this tab: a reload shows it again, a new tab starts a new one. */
const CURRENT_KEY = 'kaufcheck:chat:current';
/** Where an older version kept the one conversation of the tab. */
const LEGACY_KEY = 'kaufcheck:chat';
export const CHAT_RETENTION_DAYS = 30;
export const MAX_CHATS = 20;
const MAX_ITEMS = 60;
const MAX_TITLE = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
/** A card this version can show: a form of an older version (say, the listing form) is dropped. */
const isCard = (value: unknown): value is ChatCard =>
  isRecord(value) &&
  typeof value.type === 'string' &&
  (value.type !== 'form' || (CHAT_FORMS as readonly unknown[]).includes(value.form));

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
        typeof value.text === 'string' && Array.isArray(value.cards) && Array.isArray(value.tools)
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

/** An answer cut off by a reload stays cut off. */
function cleanItems(items: unknown[]): ChatItem[] {
  return items
    .filter(isItem)
    .map((item) =>
      item.role === 'assistant' ? { ...item, cards: item.cards.filter(isCard) } : item,
    )
    .map((item) =>
      item.role === 'assistant' && item.status === 'streaming'
        ? { ...item, status: 'error' as const, error: 'Die Antwort wurde unterbrochen.' }
        : item,
    );
}

function parseChat(value: unknown): StoredChat | null {
  if (!isRecord(value)) return null;
  const { id, title, updatedAt, items, history } = value;
  if (typeof id !== 'string' || typeof title !== 'string' || typeof updatedAt !== 'number')
    return null;
  if (!Array.isArray(items) || !Array.isArray(history)) return null;
  return { id, title, updatedAt, items: cleanItems(items), history: history.filter(isTurn) };
}

const EMPTY: Store = { version: 2, chats: [], usage: null };

/** Older than the retention period, or beyond the newest ones kept: gone. */
function prune(store: Store, now = Date.now()): Store {
  const chats = store.chats
    .filter((chat) => now - chat.updatedAt < CHAT_RETENTION_DAYS * DAY_MS)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_CHATS);
  // Yesterday's count no longer applies.
  const usage = store.usage && germanDay(new Date(now)) < store.usage.resetsOn ? store.usage : null;
  return { version: 2, chats, usage };
}

let cachedRaw: string | null | undefined;
let cachedStore: Store = EMPTY;

function readStore(): Store {
  try {
    const raw = window.localStorage.getItem(CHATS_STORAGE_KEY);
    if (raw === cachedRaw) return cachedStore;
    cachedRaw = raw;
    cachedStore = EMPTY;
    if (!raw) return cachedStore;
    const value = JSON.parse(raw) as unknown;
    if (!isRecord(value) || value.version !== 2 || !Array.isArray(value.chats)) return cachedStore;
    cachedStore = prune({
      version: 2,
      chats: value.chats.map(parseChat).filter((chat) => chat !== null),
      usage: isUsage(value.usage) ? value.usage : null,
    });
    return cachedStore;
  } catch {
    return EMPTY;
  }
}

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

function writeStore(store: Store): void {
  try {
    const pruned = prune(store);
    if (pruned.chats.length === 0 && pruned.usage === null) {
      window.localStorage.removeItem(CHATS_STORAGE_KEY);
    } else {
      window.localStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(pruned));
    }
  } catch {
    // Full or blocked: the open chat still works, it is just not kept.
  }
  notify();
}

/** The first line of the first message, as the name in the list of chats. */
export function chatTitle(items: readonly ChatItem[]): string | null {
  const first = items.find((item) => item.role === 'user');
  if (!first) return null;
  const line =
    first.text
      .split(/\r?\n/)
      .map((part) => part.trim())
      .find((part) => part !== '') ?? '';
  return line.length > MAX_TITLE ? `${line.slice(0, MAX_TITLE - 1).trimEnd()}…` : line;
}

export function loadChat(id: string): StoredChat | null {
  return readStore().chats.find((chat) => chat.id === id) ?? null;
}

/** Keeps a conversation once it has a message; a chat with only forms or hints is not kept. */
export function saveChat(chat: Omit<StoredChat, 'title'>): void {
  const title = chatTitle(chat.items);
  if (title === null) return;
  const store = readStore();
  const kept: StoredChat = { ...chat, title, items: chat.items.slice(-MAX_ITEMS) };
  writeStore({ ...store, chats: [kept, ...store.chats.filter((item) => item.id !== chat.id)] });
}

export function deleteChat(id: string): void {
  const store = readStore();
  writeStore({ ...store, chats: store.chats.filter((chat) => chat.id !== id) });
}

/** Deletes every conversation on this device, e.g. on logout on a shared device. */
export function deleteAllChats(): void {
  try {
    window.localStorage.removeItem(CHATS_STORAGE_KEY);
    window.sessionStorage.removeItem(CURRENT_KEY);
  } catch {
    // ignore
  }
  notify();
}

export function loadUsage(): ChatUsage | null {
  return readStore().usage;
}

export function saveUsage(usage: ChatUsage | null): void {
  const store = readStore();
  if (JSON.stringify(store.usage) === JSON.stringify(usage)) return;
  writeStore({ ...store, usage });
}

export function currentChatId(): string | null {
  try {
    // What an older version kept for the tab only stays there: it was promised to go with it.
    window.sessionStorage.removeItem(LEGACY_KEY);
    return window.sessionStorage.getItem(CURRENT_KEY);
  } catch {
    return null;
  }
}

export function setCurrentChatId(id: string): void {
  try {
    window.sessionStorage.setItem(CURRENT_KEY, id);
  } catch {
    // ignore
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab changed the chats (a new message, deleted, logged out).
  const onStorage = (event: StorageEvent) => {
    if (event.key === CHATS_STORAGE_KEY || event.key === null) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

const NO_CHATS: StoredChat[] = [];

/** The kept conversations, newest first; empty while prerendering. */
export function useStoredChats(): StoredChat[] {
  return useSyncExternalStore(
    subscribe,
    () => readStore().chats,
    () => NO_CHATS,
  );
}
