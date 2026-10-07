import { PLATFORM_NAMES, type ListingPlatform } from '@kaufcheck/shared';
import type { Make } from './makes';
import type { SearchFuel, SearchQuery } from './search-query';
import type { ModelEntry } from './models';

/**
 * Links to the marketplaces' own result pages. KaufCheck never loads these
 * pages: the visitor opens them and searches, sorts and filters there. Each
 * link says which of the visitor's filters it carries over, so nothing is
 * promised that the platform does not receive.
 */
export const SEARCH_FIELDS = [
  'make',
  'model',
  'price',
  'year',
  'km',
  'fuel',
  'transmission',
  'body',
  'location',
] as const;
export type SearchField = (typeof SEARCH_FIELDS)[number];

export const SEARCH_FIELD_LABELS: Record<SearchField, string> = {
  make: 'Marke',
  model: 'Modell',
  price: 'Preis',
  year: 'Erstzulassung',
  km: 'Kilometerstand',
  fuel: 'Kraftstoff',
  transmission: 'Getriebe',
  body: 'Karosserie',
  location: 'Umkreis',
};

/** The filters a search sets, to tell which ones a platform link carries over. */
export function requestedFields(query: SearchQuery): SearchField[] {
  const fields: SearchField[] = [];
  if (query.makeId) fields.push('make');
  if (query.modelId || query.modelText) fields.push('model');
  if (query.priceMin !== null || query.priceMax !== null) fields.push('price');
  if (query.yearMin !== null || query.yearMax !== null) fields.push('year');
  if (query.kmMax !== null) fields.push('km');
  if (query.fuel) fields.push('fuel');
  if (query.transmission) fields.push('transmission');
  if (query.body) fields.push('body');
  if (query.zip) fields.push('location');
  return fields;
}

export type SearchPlatform = ListingPlatform;

export interface PlatformSearchLink {
  platform: SearchPlatform;
  name: string;
  url: string;
  /** Filters of the search that the link passes on. */
  applied: SearchField[];
}

export interface SearchSubject {
  make: Make | null;
  model: ModelEntry | null;
  /** Model as typed when it is not in the catalog. */
  modelText: string | null;
}

/** Order on the results page: largest selection first. */
export const SEARCH_PLATFORMS: readonly SearchPlatform[] = [
  'mobile_de',
  'autoscout24',
  'kleinanzeigen',
  'ebay',
  'autohero',
  'pkw_de',
  'facebook',
];

const FOLD: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss', é: 'e', ë: 'e', š: 's' };

/** "C-Klasse" → "c-klasse", "up!" → "up", "Škoda" → "skoda". */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[äöüßéëš]/g, (char) => FOLD[char] ?? char)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function modelName(subject: SearchSubject): string | null {
  return subject.model?.model ?? subject.modelText;
}

/** Words a person would type into a marketplace search: "VW Golf", "Mercedes C-Klasse". */
function keywords(subject: SearchSubject): string | null {
  const make = subject.make ? (KEYWORD_MAKE[subject.make.id] ?? subject.make.name) : null;
  const words = [make, modelName(subject)].filter((part): part is string => !!part);
  return words.length > 0 ? words.join(' ') : null;
}

const KEYWORD_MAKE: Record<string, string> = {
  vw: 'VW',
  mercedes: 'Mercedes',
  skoda: 'Skoda',
  citroen: 'Citroen',
  'land-rover': 'Land Rover',
  ds: 'DS',
};

const range = (min: number | null, max: number | null): string => `${min ?? ''}:${max ?? ''}`;

const MOBILE_DE_FUEL: Partial<Record<SearchFuel, string>> = {
  petrol: 'PETROL',
  diesel: 'DIESEL',
  electric: 'ELECTRICITY',
  hybrid: 'HYBRID',
  lpg: 'LPG',
  cng: 'CNG',
};

function mobileDe(query: SearchQuery, subject: SearchSubject): PlatformSearchLink {
  const name = PLATFORM_NAMES.mobile_de;
  const make = subject.make;
  const model = modelName(subject);
  if (!make?.mobileDe) {
    // Without mobile.de's make number only its model pages can be linked (no filters).
    const slug = [make?.platformSlug ?? (make ? slugify(make.name) : null), model && slugify(model)]
      .filter(Boolean)
      .join('-');
    return {
      platform: 'mobile_de',
      name,
      url: slug
        ? `https://suchen.mobile.de/auto/${slug}.html`
        : 'https://suchen.mobile.de/fahrzeuge/detailsuche',
      applied: [
        ...(make ? (['make'] as const) : []),
        ...(make && model ? (['model'] as const) : []),
      ],
    };
  }
  const applied: SearchField[] = ['make'];
  const params = new URLSearchParams({ isSearchRequest: 'true', s: 'Car', vc: 'Car' });
  params.set('ms', `${make.mobileDe};;;${model ?? ''}`);
  if (model) applied.push('model');
  if (query.priceMin !== null || query.priceMax !== null) {
    params.set('p', range(query.priceMin, query.priceMax));
    applied.push('price');
  }
  if (query.yearMin !== null || query.yearMax !== null) {
    params.set('fr', range(query.yearMin, query.yearMax));
    applied.push('year');
  }
  if (query.kmMax !== null) {
    params.set('ml', range(null, query.kmMax));
    applied.push('km');
  }
  const fuel = query.fuel ? MOBILE_DE_FUEL[query.fuel] : undefined;
  if (fuel) {
    params.set('ft', fuel);
    applied.push('fuel');
  }
  if (query.transmission) {
    params.set('tr', query.transmission === 'automatic' ? 'AUTOMATIC_GEAR' : 'MANUAL_GEAR');
    applied.push('transmission');
  }
  if (query.zip) {
    params.set('zip', query.zip);
    params.set('zipr', String(query.radiusKm ?? 50));
    applied.push('location');
  }
  params.set('dam', 'false');
  return {
    platform: 'mobile_de',
    name,
    url: `https://suchen.mobile.de/fahrzeuge/search.html?${params.toString()}`,
    applied,
  };
}

const AUTOSCOUT24_FUEL: Partial<Record<SearchFuel, string>> = {
  petrol: 'B',
  diesel: 'D',
  electric: 'E',
};

function autoscout24(query: SearchQuery, subject: SearchSubject): PlatformSearchLink {
  const make = subject.make;
  const applied: SearchField[] = [];
  let path = '/lst';
  if (make) {
    path += `/${make.platformSlug ?? slugify(make.name)}`;
    applied.push('make');
    const model = subject.model;
    const modelSlug = model ? (model.autoscout24 ?? slugify(model.model)) : null;
    if (modelSlug) {
      path += `/${modelSlug}`;
      applied.push('model');
    }
  }
  const params = new URLSearchParams({ atype: 'C', cy: 'D', damaged_listing: 'exclude' });
  if (query.priceMin !== null) params.set('pricefrom', String(query.priceMin));
  if (query.priceMax !== null) params.set('priceto', String(query.priceMax));
  if (query.priceMin !== null || query.priceMax !== null) applied.push('price');
  if (query.yearMin !== null) params.set('fregfrom', String(query.yearMin));
  if (query.yearMax !== null) params.set('fregto', String(query.yearMax));
  if (query.yearMin !== null || query.yearMax !== null) applied.push('year');
  if (query.kmMax !== null) {
    params.set('kmto', String(query.kmMax));
    applied.push('km');
  }
  const fuel = query.fuel ? AUTOSCOUT24_FUEL[query.fuel] : undefined;
  if (fuel) {
    params.set('fuel', fuel);
    applied.push('fuel');
  }
  if (query.transmission) {
    params.set('gear', query.transmission === 'automatic' ? 'A' : 'M');
    applied.push('transmission');
  }
  if (query.zip) {
    params.set('zip', query.zip);
    params.set('zipr', String(query.radiusKm ?? 50));
    applied.push('location');
  }
  params.set('sort', 'standard');
  params.set('desc', '0');
  return {
    platform: 'autoscout24',
    name: PLATFORM_NAMES.autoscout24,
    url: `https://www.autoscout24.de${path}?${params.toString()}`,
    applied,
  };
}

const KLEINANZEIGEN_FUEL: Partial<Record<SearchFuel, string>> = {
  petrol: 'benzin',
  diesel: 'diesel',
  electric: 'elektro',
  hybrid: 'hybrid',
  lpg: 'lpg',
  cng: 'cng',
};

function kleinanzeigen(query: SearchQuery, subject: SearchSubject): PlatformSearchLink {
  const applied: SearchField[] = [];
  const segments = ['s-autos'];
  const makeValue = subject.make?.kleinanzeigen ?? null;
  if (makeValue) segments.push(makeValue);
  if (query.priceMin !== null || query.priceMax !== null) {
    segments.push(`preis:${query.priceMin ?? ''}:${query.priceMax ?? ''}`);
    applied.push('price');
  }
  // The model (and the make where Kleinanzeigen's value is unknown) goes into the search words.
  const words = makeValue ? modelName(subject) : keywords(subject);
  const attributes: string[] = [];
  if (makeValue) {
    attributes.push(`autos.marke_s:${makeValue}`);
    applied.push('make');
  } else if (subject.make) {
    applied.push('make');
  }
  if (words) {
    segments.push(slugify(words));
    if (modelName(subject)) applied.push('model');
  }
  if (query.yearMin !== null || query.yearMax !== null) {
    attributes.push(`autos.ez_i:${query.yearMin ?? ''},${query.yearMax ?? ''}`);
    applied.push('year');
  }
  if (query.kmMax !== null) {
    attributes.push(`autos.km_i:,${query.kmMax}`);
    applied.push('km');
  }
  if (query.transmission) {
    attributes.push(
      `autos.shift_s:${query.transmission === 'automatic' ? 'automatik' : 'manuell'}`,
    );
    applied.push('transmission');
  }
  const fuel = query.fuel ? KLEINANZEIGEN_FUEL[query.fuel] : undefined;
  if (fuel) {
    attributes.push(`autos.fuel_s:${fuel}`);
    applied.push('fuel');
  }
  const category = `${words ? 'k0' : ''}c216${attributes.map((attribute) => `+${attribute}`).join('')}`;
  return {
    platform: 'kleinanzeigen',
    name: PLATFORM_NAMES.kleinanzeigen,
    url: `https://www.kleinanzeigen.de/${segments.join('/')}/${category}`,
    applied: dedupe(applied),
  };
}

function ebay(query: SearchQuery, subject: SearchSubject): PlatformSearchLink {
  const applied: SearchField[] = [];
  const params = new URLSearchParams();
  const words = keywords(subject);
  if (words) {
    params.set('_nkw', words);
    if (subject.make) applied.push('make');
    if (modelName(subject)) applied.push('model');
  }
  if (query.priceMin !== null) params.set('_udlo', String(query.priceMin));
  if (query.priceMax !== null) params.set('_udhi', String(query.priceMax));
  if (query.priceMin !== null || query.priceMax !== null) applied.push('price');
  if (query.zip) {
    params.set('_stpos', query.zip);
    params.set('_sadis', String(query.radiusKm ?? 50));
    applied.push('location');
  }
  const search = params.toString();
  return {
    platform: 'ebay',
    name: PLATFORM_NAMES.ebay,
    url: `https://www.ebay.de/sch/9801/i.html${search ? `?${search}` : ''}`,
    applied,
  };
}

function autohero(subject: SearchSubject): PlatformSearchLink {
  const make = subject.make;
  const model = modelName(subject);
  const slug = make
    ? [make.platformSlug ?? slugify(make.name), model && slugify(model)].filter(Boolean).join('-')
    : null;
  return {
    platform: 'autohero',
    name: PLATFORM_NAMES.autohero,
    url: slug ? `https://www.autohero.com/de/auto/${slug}/` : 'https://www.autohero.com/de/search/',
    applied: [...(make ? (['make'] as const) : []), ...(make && model ? (['model'] as const) : [])],
  };
}

function pkwDe(): PlatformSearchLink {
  return {
    platform: 'pkw_de',
    name: PLATFORM_NAMES.pkw_de,
    url: 'https://suche.pkw.de/fahrzeuge',
    applied: [],
  };
}

function facebook(query: SearchQuery, subject: SearchSubject): PlatformSearchLink {
  const applied: SearchField[] = [];
  const params = new URLSearchParams();
  const words = keywords(subject);
  if (words) {
    params.set('query', words);
    if (subject.make) applied.push('make');
    if (modelName(subject)) applied.push('model');
  }
  if (query.priceMin !== null) params.set('minPrice', String(query.priceMin));
  if (query.priceMax !== null) params.set('maxPrice', String(query.priceMax));
  if (query.priceMin !== null || query.priceMax !== null) applied.push('price');
  if (query.yearMin !== null) params.set('minYear', String(query.yearMin));
  if (query.yearMax !== null) params.set('maxYear', String(query.yearMax));
  if (query.yearMin !== null || query.yearMax !== null) applied.push('year');
  if (query.kmMax !== null) {
    params.set('maxMileage', String(query.kmMax));
    applied.push('km');
  }
  const search = params.toString();
  return {
    platform: 'facebook',
    name: PLATFORM_NAMES.facebook,
    url: `https://www.facebook.com/marketplace/category/vehicles${search ? `?${search}` : ''}`,
    applied,
  };
}

function dedupe<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export function buildPlatformLinks(
  query: SearchQuery,
  subject: SearchSubject,
): PlatformSearchLink[] {
  return [
    mobileDe(query, subject),
    autoscout24(query, subject),
    kleinanzeigen(query, subject),
    ebay(query, subject),
    autohero(subject),
    pkwDe(),
    facebook(query, subject),
  ];
}
