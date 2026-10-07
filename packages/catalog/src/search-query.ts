import { BODY_TYPES, type BodyType } from './types';

/**
 * A car search as KaufCheck keeps it in its own URL (`/auto-finden?marke=vw&modell=vw-golf&…`).
 * The platform links are built from it; nothing is ever sent to a marketplace by KaufCheck.
 */
export const SEARCH_FUELS = [
  'petrol',
  'diesel',
  'electric',
  'hybrid',
  'plugin_hybrid',
  'lpg',
  'cng',
] as const;
export type SearchFuel = (typeof SEARCH_FUELS)[number];

export const SEARCH_FUEL_LABELS: Record<SearchFuel, string> = {
  petrol: 'Benzin',
  diesel: 'Diesel',
  electric: 'Elektro',
  hybrid: 'Hybrid',
  plugin_hybrid: 'Plug-in-Hybrid',
  lpg: 'Autogas (LPG)',
  cng: 'Erdgas (CNG)',
};

export const SEARCH_TRANSMISSIONS = ['manual', 'automatic'] as const;
export type SearchTransmission = (typeof SEARCH_TRANSMISSIONS)[number];

export const SEARCH_TRANSMISSION_LABELS: Record<SearchTransmission, string> = {
  manual: 'Schaltgetriebe',
  automatic: 'Automatik',
};

export const SEARCH_RADII = [10, 25, 50, 100, 200] as const;

export interface SearchQuery {
  makeId: string | null;
  /** Catalog model id ("vw-golf"). */
  modelId: string | null;
  /** Free model text when the model is not in the catalog. */
  modelText: string | null;
  priceMin: number | null;
  priceMax: number | null;
  yearMin: number | null;
  yearMax: number | null;
  kmMax: number | null;
  fuel: SearchFuel | null;
  transmission: SearchTransmission | null;
  body: BodyType | null;
  zip: string | null;
  radiusKm: number | null;
}

export const EMPTY_SEARCH: SearchQuery = {
  makeId: null,
  modelId: null,
  modelText: null,
  priceMin: null,
  priceMax: null,
  yearMin: null,
  yearMax: null,
  kmMax: null,
  fuel: null,
  transmission: null,
  body: null,
  zip: null,
  radiusKm: null,
};

/** German parameter names and values, so shared search links read naturally. */
const PARAMS = {
  make: 'marke',
  model: 'modell',
  priceMin: 'preis_ab',
  priceMax: 'preis_bis',
  yearMin: 'ez_ab',
  yearMax: 'ez_bis',
  kmMax: 'km_bis',
  fuel: 'kraftstoff',
  transmission: 'getriebe',
  body: 'karosserie',
  zip: 'plz',
  radius: 'umkreis',
} as const;

const FUEL_SLUGS: Record<SearchFuel, string> = {
  petrol: 'benzin',
  diesel: 'diesel',
  electric: 'elektro',
  hybrid: 'hybrid',
  plugin_hybrid: 'plug-in-hybrid',
  lpg: 'autogas',
  cng: 'erdgas',
};
const TRANSMISSION_SLUGS: Record<SearchTransmission, string> = {
  manual: 'schaltgetriebe',
  automatic: 'automatik',
};

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_PRICE = 2_000_000;
const MAX_KM = 1_000_000;
const MIN_YEAR = 1950;

function integer(value: string | null, min: number, max: number): number | null {
  if (value === null || !/^\d{1,9}$/.test(value.trim())) return null;
  const number = Number(value.trim());
  return number >= min && number <= max ? number : null;
}

function reverse<T extends string>(map: Record<T, string>, value: string | null): T | null {
  if (!value) return null;
  const entry = (Object.entries(map) as [T, string][]).find(([, slug]) => slug === value);
  return entry ? entry[0] : null;
}

/** Free text as typed, trimmed to something that can safely go into links. */
export function cleanModelText(value: string | null | undefined): string | null {
  const text = (value ?? '')
    .replace(/[^\p{L}\p{N} .!+-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
  return text.length > 0 ? text : null;
}

/**
 * Reads a search from URL parameters. Unknown or invalid values are dropped,
 * never passed on. `isModelId` tells catalog ids from free model text.
 */
export function parseSearchParams(
  params: URLSearchParams,
  isModelId: (id: string) => boolean,
  now: Date = new Date(),
): SearchQuery {
  const maxYear = now.getFullYear() + 1;
  const make = params.get(PARAMS.make)?.trim().toLowerCase() ?? null;
  const model = params.get(PARAMS.model)?.trim() ?? null;
  const modelIsId = model !== null && SLUG.test(model) && isModelId(model);
  const zip = params.get(PARAMS.zip)?.trim() ?? null;
  const radius = integer(params.get(PARAMS.radius), 1, 500);
  const body = params.get(PARAMS.body);
  let yearMin = integer(params.get(PARAMS.yearMin), MIN_YEAR, maxYear);
  let yearMax = integer(params.get(PARAMS.yearMax), MIN_YEAR, maxYear);
  if (yearMin !== null && yearMax !== null && yearMin > yearMax)
    [yearMin, yearMax] = [yearMax, yearMin];
  let priceMin = integer(params.get(PARAMS.priceMin), 0, MAX_PRICE);
  let priceMax = integer(params.get(PARAMS.priceMax), 0, MAX_PRICE);
  if (priceMin !== null && priceMax !== null && priceMin > priceMax)
    [priceMin, priceMax] = [priceMax, priceMin];
  return {
    makeId: make && SLUG.test(make) ? make : null,
    modelId: modelIsId ? model : null,
    modelText: modelIsId ? null : cleanModelText(model),
    priceMin,
    priceMax,
    yearMin,
    yearMax,
    kmMax: integer(params.get(PARAMS.kmMax), 0, MAX_KM),
    fuel: reverse(FUEL_SLUGS, params.get(PARAMS.fuel)),
    transmission: reverse(TRANSMISSION_SLUGS, params.get(PARAMS.transmission)),
    body: body && (BODY_TYPES as readonly string[]).includes(body) ? (body as BodyType) : null,
    zip: zip && /^\d{5}$/.test(zip) ? zip : null,
    radiusKm: radius === null ? null : (SEARCH_RADII.find((r) => r >= radius) ?? 200),
  };
}

export function toSearchParams(query: SearchQuery): URLSearchParams {
  const params = new URLSearchParams();
  const set = (key: string, value: string | number | null) => {
    if (value !== null && value !== '') params.set(key, String(value));
  };
  set(PARAMS.make, query.makeId);
  set(PARAMS.model, query.modelId ?? query.modelText);
  set(PARAMS.priceMin, query.priceMin);
  set(PARAMS.priceMax, query.priceMax);
  set(PARAMS.yearMin, query.yearMin);
  set(PARAMS.yearMax, query.yearMax);
  set(PARAMS.kmMax, query.kmMax);
  set(PARAMS.fuel, query.fuel ? FUEL_SLUGS[query.fuel] : null);
  set(PARAMS.transmission, query.transmission ? TRANSMISSION_SLUGS[query.transmission] : null);
  set(PARAMS.body, query.body);
  set(PARAMS.zip, query.zip);
  set(PARAMS.radius, query.zip ? query.radiusKm : null);
  return params;
}

export function isEmptySearch(query: SearchQuery): boolean {
  return Object.values(query).every((value) => value === null);
}
