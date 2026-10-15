/**
 * KaufCheck service worker: shows a saved check without reception, e.g. in a
 * garage during an inspection.
 *
 * This worker stores nothing by itself. Only when the user taps „Offline
 * verfügbar machen“ does the page put the check, the app shell
 * and the files it needs into the caches below (apps/web/src/lib/offline.ts;
 * TDDDG § 25 Abs. 2 Nr. 2: only for the function the user asked for). The
 * worker serves them when the network fails and refreshes stored entries
 * when they are loaded online again – it never adds new ones.
 *
 * The server sends check data with `no-store` so that no HTTP cache keeps it
 * unasked; this copy is the user's explicit choice and is deleted on login,
 * logout, account deletion and with „Offline-Kopie löschen“.
 */
const APP = 'kc-app-v1'; // shell and built files – no personal data
const SAVED = 'kc-saved-v1'; // saved checks, account and settings – personal
const SHELL_KEY = '/__kaufcheck-shell';
/** Weak reception: after this, a stored copy is used instead of waiting longer. */
const NETWORK_TIMEOUT_MS = 4000;

const API_PATHS = [/^\/api\/analyses\/[0-9a-f-]{36}$/i, /^\/api\/me$/, /^\/api\/config$/];

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name.startsWith('kc-') && name !== APP && name !== SAVED) await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    // Every app page is the same shell; prerendered pages are not stored.
    event.respondWith(fromNetworkOr(event, request, APP, SHELL_KEY));
  } else if (url.pathname.startsWith('/assets/')) {
    event.respondWith(asset(request, url.pathname));
  } else if (API_PATHS.some((pattern) => pattern.test(url.pathname))) {
    event.respondWith(fromNetworkOr(event, request, SAVED, url.pathname));
  }
});

/**
 * Network first. Without an answer – offline, or nothing after a few seconds
 * of weak reception – the stored copy is used if there is one. A stored copy
 * is refreshed with a newer answer.
 */
async function fromNetworkOr(event, request, cacheName, key) {
  const cache = await caches.open(cacheName);
  const stored = await cache.match(key);
  const network = fetch(request).then((response) => {
    if (stored && response.ok && response.type === 'basic' && !response.redirected) {
      event.waitUntil(refresh(cache, key, response.clone()));
    }
    return response;
  });
  if (!stored) return network;
  // A late network error must not go unhandled once the stored copy was used.
  network.catch(() => {});
  const timeout = new Promise((resolve) => {
    setTimeout(() => resolve(null), NETWORK_TIMEOUT_MS);
  });
  try {
    return (await Promise.race([network, timeout])) ?? stored;
  } catch {
    return stored;
  }
}

async function refresh(cache, key, response) {
  try {
    // Only the shell replaces the shell, never a prerendered page.
    if (key === SHELL_KEY && response.headers.get('x-kaufcheck-shell') !== '1') return;
    // Signed out elsewhere (e.g. the session expired) or another account: the copies go, too.
    if (key === '/api/me') {
      const before = await (await cache.match(key))?.json();
      const now = await response.clone().json();
      if (before?.user && before.user.id !== now?.user?.id) {
        await caches.delete(SAVED);
        return;
      }
    }
    // Deleted in the meantime (logout, „Offline-Kopie löschen“): do not bring it back.
    if (!(await cache.match(key))) return;
    await cache.put(key, response);
  } catch {
    // A failed refresh keeps the older copy.
  }
}

/** Built files carry a hash in their name and never change. */
async function asset(request, key) {
  const stored = await caches.match(key, { cacheName: APP });
  return stored ?? fetch(request);
}
