import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/**
 * False while the server renders and while the browser hydrates a prerendered
 * page, true afterwards. Lets prerendered pages show URL-dependent content
 * (search parameters, stored preferences) without a hydration mismatch.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
