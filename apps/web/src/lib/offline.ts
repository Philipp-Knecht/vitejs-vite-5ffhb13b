import { useSyncExternalStore } from 'react';

/** Caches shared with the service worker (public/sw.js). */
const APP_PREFIX = 'kc-app-';
const SAVED_CACHE = 'kc-saved-v1';
const SHELL_KEY = '/__kaufcheck-shell';

const ANALYSIS_PATH = /^\/api\/analyses\/([0-9a-f-]{36})$/i;
const analysisKey = (analysisId: string) => `/api/analyses/${analysisId}`;

export const offlineSupported = () =>
  import.meta.env.PROD && 'serviceWorker' in navigator && typeof caches !== 'undefined';

/** The page was loaded before a new version went live; its files no longer fit the server's. */
export class OutdatedPageError extends Error {}

/** Keeps the service worker current once someone has saved a check offline. */
export function updateServiceWorker(): void {
  if (!offlineSupported()) return;
  // Room for every file this page loads, so that a save finds them all (default: 250 entries).
  performance.setResourceTimingBufferSize(2000);
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .getRegistration('/')
      .then((registration) => registration?.update())
      .catch(() => {});
  });
}

/** The entry script names the build: its file name carries the build's hash. */
function entryScript(root: ParentNode): string | null {
  const src = root
    .querySelector<HTMLScriptElement>('script[type="module"][src]')
    ?.getAttribute('src');
  return src ? new URL(src, window.location.origin).pathname : null;
}

const buildCacheName = (entry: string) =>
  `${APP_PREFIX}${entry.replace(/^.*\//, '').replace(/\.js$/, '')}`;

/** The built files this page has loaded – what it needs to start again offline. */
function loadedAssets(): string[] {
  const urls = new Set<string>();
  for (const element of document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>(
    'script[src], link[href]',
  )) {
    urls.add('src' in element && element.src ? element.src : (element as HTMLLinkElement).href);
  }
  for (const entry of performance.getEntriesByType('resource')) urls.add(entry.name);
  return [...urls]
    .map((url) => new URL(url, window.location.origin))
    .filter((url) => url.origin === window.location.origin && url.pathname.startsWith('/assets/'))
    .map((url) => url.pathname);
}

/** A save gives up instead of spinning for minutes with weak reception. */
const LOAD_TIMEOUT_MS = 30_000;

async function load(url: string, init?: RequestInit): Promise<Response> {
  const signal =
    typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(LOAD_TIMEOUT_MS) : undefined;
  const response = await fetch(url, { credentials: 'same-origin', signal, ...init });
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response;
}

async function appCacheNames(): Promise<string[]> {
  return (await caches.keys()).filter((name) => name.startsWith(APP_PREFIX));
}

/**
 * Stores the app shell and this page's built files in one cache per build, so
 * that they always fit together, and removes older builds.
 */
async function storeApp(analysisId: string): Promise<void> {
  const current = entryScript(document);
  // Every app page is the same shell; this check's page is one of them.
  const shell = await load(`/analyse/${analysisId}`, { cache: 'no-store' });
  // Set by the server on the app shell only, never on a prerendered page (apps/api web.ts).
  if (shell.headers.get('x-kaufcheck-shell') !== '1') throw new Error('No app shell');
  // Stored as received, with its headers (including the Content-Security-Policy).
  const copy = shell.clone();
  const html = await shell.text();
  const entry = entryScript(new DOMParser().parseFromString(html, 'text/html'));
  if (!current || entry !== current) throw new OutdatedPageError();

  const name = buildCacheName(current);
  const existed = (await appCacheNames()).includes(name);
  const app = await caches.open(name);
  try {
    await app.put(SHELL_KEY, copy);
    for (const asset of loadedAssets()) {
      if (!(await app.match(asset))) await app.put(asset, await load(asset));
    }
  } catch (error) {
    if (!existed) await caches.delete(name);
    throw error;
  }
  for (const other of await appCacheNames()) if (other !== name) await caches.delete(other);
}

/**
 * Saves a check for use without reception – only on the user's request. It
 * stores the check, the account and settings it is shown with, the app shell
 * and the built files, and registers the service worker that serves them.
 */
export async function saveForOffline(analysisId: string): Promise<void> {
  try {
    await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
    await storeApp(analysisId);
    // Everything is loaded before anything is written, so that a failed save leaves nothing half done.
    const [analysis, me, config] = await Promise.all(
      [analysisKey(analysisId), '/api/me', '/api/config'].map((url) =>
        load(url, { cache: 'no-store' }),
      ),
    );
    const saved = await caches.open(SAVED_CACHE);
    await saved.put('/api/me', me!);
    await saved.put('/api/config', config!);
    // The check last: it marks the copy as complete.
    await saved.put(analysisKey(analysisId), analysis!);
  } catch (error) {
    // A first save that failed leaves no files and no service worker behind.
    if (!(await hasSavedChecks())) await removeAll().catch(() => {});
    throw error;
  }
}

async function hasSavedChecks(): Promise<boolean> {
  if (!(await caches.has(SAVED_CACHE))) return false;
  const saved = await caches.open(SAVED_CACHE);
  return (await saved.keys()).some((request) => ANALYSIS_PATH.test(new URL(request.url).pathname));
}

/**
 * Brings the stored app up to date when a saved check is opened online after
 * a new version went live, so that the copy keeps working offline.
 */
export async function refreshOfflineApp(analysisId: string): Promise<void> {
  const current = entryScript(document);
  if (!current || !navigator.onLine) return;
  if ((await appCacheNames()).includes(buildCacheName(current))) return;
  try {
    await storeApp(analysisId);
  } catch {
    // The older copy stays; it still fits its own files.
  }
}

export async function isSavedForOffline(analysisId: string): Promise<boolean> {
  if (!offlineSupported()) return false;
  try {
    if (!(await caches.has(SAVED_CACHE))) return false;
    return (await caches.match(analysisKey(analysisId), { cacheName: SAVED_CACHE })) !== undefined;
  } catch {
    return false;
  }
}

export interface OfflineCheck {
  id: string;
  title: string;
}

/** The checks saved in this browser, for finding them without reception. */
export async function savedOfflineChecks(): Promise<OfflineCheck[]> {
  if (!offlineSupported() || !(await caches.has(SAVED_CACHE))) return [];
  const saved = await caches.open(SAVED_CACHE);
  const checks: OfflineCheck[] = [];
  for (const request of await saved.keys()) {
    const id = ANALYSIS_PATH.exec(new URL(request.url).pathname)?.[1];
    if (!id) continue;
    let title = 'Gespeicherte Prüfung';
    try {
      const dto = (await (await saved.match(request))?.json()) as {
        analysis?: { vehicleSummary?: { title?: string } | null };
        listing?: { title?: string | null };
      };
      title = dto.analysis?.vehicleSummary?.title ?? dto.listing?.title ?? title;
    } catch {
      // Keeps the general title.
    }
    checks.push({ id, title });
  }
  return checks;
}

/** Removes everything offline: saved checks, account data, app files and the service worker. */
async function removeAll(): Promise<void> {
  await caches.delete(SAVED_CACHE);
  for (const name of await appCacheNames()) await caches.delete(name);
  await (await navigator.serviceWorker.getRegistration('/'))?.unregister();
}

/** Removes one check; without any saved check, everything else goes, too. */
export async function removeOfflineCopy(analysisId: string): Promise<void> {
  await (await caches.open(SAVED_CACHE)).delete(analysisKey(analysisId));
  if (!(await hasSavedChecks())) await removeAll();
}

/** Deletes all offline data, e.g. on logout on a shared device. */
export async function clearPrivateOfflineData(): Promise<void> {
  if (typeof caches === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    await removeAll();
  } catch {
    // Storage can be unavailable (private mode); then nothing was saved either.
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/** Whether the browser has a connection; prerendered pages assume it has. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}
