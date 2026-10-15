import { useSyncExternalStore } from 'react';

/** Cache of the service worker (public/sw.js) that may hold personal API answers. */
const PRIVATE_CACHE_PREFIX = 'kc-api-';

/** Makes the app installable and keeps opened pages and checks for use without reception. */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error: unknown) => {
      console.warn('Service worker not registered', error);
    });
  });
}

/** Deletes cached account data, e.g. when someone signs out on a shared device. */
export async function clearPrivateOfflineData(): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    for (const name of await caches.keys()) {
      if (name.startsWith(PRIVATE_CACHE_PREFIX)) await caches.delete(name);
    }
  } catch {
    // Storage can be unavailable (private mode); then nothing was cached either.
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
