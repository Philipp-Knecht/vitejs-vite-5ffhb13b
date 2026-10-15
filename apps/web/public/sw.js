/**
 * KaufCheck service worker: shows a saved check without reception, e.g. in a
 * garage during an inspection.
 *
 * This worker stores nothing by itself. Only when the user taps „Offline
 * verfügbar machen“ does the page put the check, the app shell and the files
 * it needs into the caches below (apps/web/src/lib/offline.ts; TDDDG § 25
 * Abs. 2 Nr. 2: only for the function the user asked for). The worker serves
 * them when the network fails. It refreshes stored check data when it is
 * loaded online again, but never adds entries and never touches the app
 * files: the page stores shell and files of one build together, in a cache
 * named after that build, so that they always fit each other.
 *
 * The server sends check data with `no-store` so that no HTTP cache keeps it
 * unasked; this copy is the user's explicit choice and is deleted on login,
 * logout, account deletion and with „Offline-Kopie löschen“.
 *
 * Cache names are shared with offline.ts. Renaming SAVED deletes the users'
 * saved checks (see `activate`) – migrate them instead.
 */
const APP_PREFIX = 'kc-app-'; // + build id: shell and built files – no personal data
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
        if (name.startsWith('kc-') && !name.startsWith(APP_PREFIX) && name !== SAVED) {
          await caches.delete(name);
        }
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
    event.respondWith(fromNetworkOr(event, request, SHELL_KEY, false));
  } else if (url.pathname.startsWith('/assets/')) {
    event.respondWith(asset(request, url.pathname));
  } else if (API_PATHS.some((pattern) => pattern.test(url.pathname))) {
    event.respondWith(fromNetworkOr(event, request, url.pathname, true));
  }
});

/** The stored app (shell and files of one build), if any. */
async function appCache() {
  const name = (await caches.keys()).find((key) => key.startsWith(APP_PREFIX));
  return name ? caches.open(name) : null;
}

/** Looks up without creating a cache as a side effect. */
async function storedCopy(key, isData) {
  if (isData) {
    return (await caches.has(SAVED)) ? caches.match(key, { cacheName: SAVED }) : undefined;
  }
  return (await appCache())?.match(key);
}

/**
 * Network first. Without an answer – offline, or nothing after a few seconds
 * of weak reception – the stored copy is used if there is one. Stored check
 * data is refreshed with a newer answer.
 */
async function fromNetworkOr(event, request, key, isData) {
  const stored = await storedCopy(key, isData);
  const network = fetch(request);
  if (!stored) return network;
  if (isData) {
    // Registered right away: after respondWith has settled, waitUntil would throw.
    event.waitUntil(network.then((response) => refresh(key, response.clone())).catch(() => {}));
  }
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

async function refresh(key, response) {
  try {
    if (!response.ok || response.type !== 'basic' || response.redirected) return;
    // Deleted in the meantime (logout, „Offline-Kopie löschen“): do not bring it back.
    if (!(await caches.has(SAVED))) return;
    const cache = await caches.open(SAVED);
    const before = await cache.match(key);
    if (!before) return;
    // Signed out elsewhere (e.g. the session expired) or another account: the copies go, too.
    if (key === '/api/me') {
      const was = await before.json();
      const now = await response.clone().json();
      if (was?.user && was.user.id !== now?.user?.id) {
        await caches.delete(SAVED);
        return;
      }
    }
    await cache.put(key, response);
  } catch {
    // A failed refresh keeps the older copy.
  }
}

/** Built files carry a hash in their name and never change. */
async function asset(request, key) {
  const stored = await (await appCache())?.match(key);
  return stored ?? fetch(request);
}
