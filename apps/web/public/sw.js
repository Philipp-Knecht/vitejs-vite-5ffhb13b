/**
 * KaufCheck service worker: makes the app installable and keeps the last
 * opened pages and checks available without reception – e.g. in a garage
 * during an inspection.
 *
 * - Pages are always loaded from the network first; the cache is only used
 *   offline, so nobody sees an outdated version while online.
 * - Built files (/assets/…) carry a hash in their name and never change.
 * - Of the API, only what is needed to show an opened check again is kept.
 *   It may be personal; the app deletes this cache on login, logout and
 *   account deletion (see apps/web/src/lib/offline.ts).
 */
const PAGES = 'kc-pages-v1';
const ASSETS = 'kc-assets-v1';
const API = 'kc-api-v1';
const MAX_ENTRIES = { [PAGES]: 40, [ASSETS]: 150, [API]: 40 };
/** The empty app shell, for app pages that were never opened before. */
const SHELL_KEY = '/__kaufcheck-shell';

const OFFLINE_API = [/^\/api\/analyses\/[0-9a-f-]{36}$/i, /^\/api\/me$/, /^\/api\/config$/];

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const current = new Set(Object.keys(MAX_ENTRIES));
      for (const name of await caches.keys()) {
        if (name.startsWith('kc-') && !current.has(name)) await caches.delete(name);
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
    event.respondWith(page(request));
  } else if (url.pathname.startsWith('/assets/')) {
    event.respondWith(asset(request));
  } else if (OFFLINE_API.some((pattern) => pattern.test(url.pathname))) {
    event.respondWith(networkFirst(request, API));
  }
});

async function trim(cache, max) {
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - max))) await cache.delete(key);
}

async function store(cacheName, key, response) {
  const cache = await caches.open(cacheName);
  await cache.put(key, response);
  await trim(cache, MAX_ENTRIES[cacheName]);
}

/** Network first; a successful same-origin answer is kept for offline use. */
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') {
      await store(cacheName, request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request, { cacheName, ignoreVary: true });
    if (cached) return cached;
    throw error;
  }
}

async function page(request) {
  try {
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') {
      await store(PAGES, request, response.clone());
      if (response.headers.get('x-kaufcheck-shell') === '1') {
        await store(PAGES, SHELL_KEY, response.clone());
      }
    }
    return response;
  } catch (error) {
    const cached =
      (await caches.match(request, { cacheName: PAGES, ignoreSearch: true })) ??
      (await caches.match(SHELL_KEY, { cacheName: PAGES }));
    if (cached) return cached;
    throw error;
  }
}

/** Hashed files never change: from the cache when there, else from the network. */
async function asset(request) {
  const cached = await caches.match(request, { cacheName: ASSETS });
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.type === 'basic') await store(ASSETS, request, response.clone());
  return response;
}
