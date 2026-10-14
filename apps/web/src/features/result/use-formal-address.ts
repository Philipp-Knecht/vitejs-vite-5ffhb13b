import { useSyncExternalStore } from 'react';
import { isBoolean, readJson, writeJson } from '../../lib/storage';
import { FORMAL_ADDRESS_KEY } from './storage-keys';

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The choice made on this page; storage may be unavailable. */
let chosen: boolean | null = null;

const read = () => chosen ?? readJson(FORMAL_ADDRESS_KEY, true, isBoolean);

function setFormalAddress(value: boolean) {
  chosen = value;
  writeJson(FORMAL_ADDRESS_KEY, value);
  for (const listener of listeners) listener();
}

/**
 * „Sie“ or „du“ for messages to the seller, shared by all sections of the
 * result page and remembered in this browser. Without storage the choice
 * still applies until the page is left.
 */
export function useFormalAddress(): [boolean, (value: boolean) => void] {
  const stored = useSyncExternalStore(subscribe, read, () => true);
  return [stored, setFormalAddress];
}
