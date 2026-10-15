import { useSyncExternalStore } from 'react';

/** Caches shared with the service worker (public/sw.js). */
const APP_CACHE = 'kc-app-v1';
const SAVED_CACHE = 'kc-saved-v1';
const SHELL_KEY = '/__kaufcheck-shell';

const analysisKey = (analysisId: string) => `/api/analyses/${analysisId}`;

export const offlineSupported = () =>
  import.meta.env.PROD && 'serviceWorker' in navigator && typeof caches !== 'undefined';

/** Keeps the service worker current once someone has saved a check offline. */
export function updateServiceWorker(): void {
  if (!offlineSupported()) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .getRegistration('/')
      .then((registration) => registration?.update())
      .catch(() => {});
  });
}

async function store(cache: Cache, url: string, key = url): Promise<void> {
  const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  await cache.put(key, response);
}

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

/**
 * Saves a check for use without reception – only on the user's request. It
 * stores the check, the account and settings it is shown with, the app shell
 * and the built files, and registers the service worker that serves them.
 */
export async function saveForOffline(analysisId: string): Promise<void> {
  await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;
  const app = await caches.open(APP_CACHE);
  // Every app page is the same shell; this check's page is one of them.
  await store(app, `/analyse/${analysisId}`, SHELL_KEY);
  for (const asset of loadedAssets()) await store(app, asset);
  const saved = await caches.open(SAVED_CACHE);
  await store(saved, analysisKey(analysisId));
  await store(saved, '/api/me');
  await store(saved, '/api/config');
}

export async function isSavedForOffline(analysisId: string): Promise<boolean> {
  if (!offlineSupported()) return false;
  try {
    return (await caches.match(analysisKey(analysisId), { cacheName: SAVED_CACHE })) !== undefined;
  } catch {
    return false;
  }
}

/** Removes one check; without any saved check, the account copy goes, too. */
export async function removeOfflineCopy(analysisId: string): Promise<void> {
  const saved = await caches.open(SAVED_CACHE);
  await saved.delete(analysisKey(analysisId));
  const left = (await saved.keys()).some((request) =>
    new URL(request.url).pathname.startsWith('/api/analyses/'),
  );
  if (!left) await caches.delete(SAVED_CACHE);
}

/** Deletes all saved checks and account data, e.g. on logout on a shared device. */
export async function clearPrivateOfflineData(): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    await caches.delete(SAVED_CACHE);
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
