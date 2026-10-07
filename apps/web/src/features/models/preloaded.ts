import type { CarModel } from '@kaufcheck/catalog';
import { createContext, useContext } from 'react';

/**
 * Model data a prerendered model page was built with. The page carries it as
 * JSON, so the browser hydrates the same content without waiting for a load.
 */
export const PreloadedModelContext = createContext<CarModel | null>(null);

export function usePreloadedModel(): CarModel | null {
  return useContext(PreloadedModelContext);
}

export const PAGE_DATA_ID = 'page-data';

/** Reads the data embedded in a prerendered page (browser only). */
export function readPageData(): CarModel | null {
  try {
    const raw = document.getElementById(PAGE_DATA_ID)?.textContent;
    return raw ? (JSON.parse(raw) as CarModel) : null;
  } catch {
    return null;
  }
}
