/**
 * Recognition of listing URLs from the supported marketplaces.
 *
 * This is the single definition of which links KaufCheck accepts. The web app
 * uses it for instant feedback; the API uses it as the authoritative gate
 * before anything is fetched (host allowlist = first SSRF defence layer).
 * Recognizing a link does not mean KaufCheck may retrieve it: most platforms
 * only allow visitors to copy the listing text themselves, so their links are
 * kept for reference only (the server decides which platforms it retrieves).
 */

export const LISTING_PLATFORMS = [
  'kleinanzeigen',
  'mobile_de',
  'autoscout24',
  'ebay',
  'autohero',
  'pkw_de',
  'facebook',
] as const;
export type ListingPlatform = (typeof LISTING_PLATFORMS)[number];

/** Names as the platforms write them; used only to describe where a listing comes from. */
export const PLATFORM_NAMES: Record<ListingPlatform, string> = {
  kleinanzeigen: 'Kleinanzeigen',
  mobile_de: 'mobile.de',
  autoscout24: 'AutoScout24',
  ebay: 'eBay',
  autohero: 'Autohero',
  pkw_de: 'pkw.de',
  facebook: 'Facebook Marketplace',
};

export const KLEINANZEIGEN_CANONICAL_HOST = 'www.kleinanzeigen.de';

export const MAX_URL_INPUT_LENGTH = 2048;

/** Kleinanzeigen category id for "Autos". */
export const KLEINANZEIGEN_CARS_CATEGORY_ID = '216';

export type ListingUrlRejection =
  | 'empty'
  | 'too_long'
  | 'not_a_url'
  | 'invalid_protocol'
  | 'credentials_not_allowed'
  | 'port_not_allowed'
  | 'unsupported_host'
  | 'not_a_listing';

export type ListingUrlRecognition =
  | {
      ok: true;
      source: ListingPlatform;
      canonicalUrl: string;
      externalId: string;
      categoryId: string | null;
    }
  | {
      ok: false;
      reason: ListingUrlRejection;
      host?: string;
      /** Set when the host belongs to a known platform but the link is not a single listing. */
      source?: ListingPlatform;
    };

interface ListingMatch {
  canonicalUrl: string;
  externalId: string;
  categoryId: string | null;
}

interface PlatformDefinition {
  matchesHost(host: string): boolean;
  /** The listing behind a link to this platform, or null if it is not a single listing. */
  match(url: URL, host: string): ListingMatch | null;
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

/** Legacy eBay-Kleinanzeigen hosts are normalized to the current one. */
const KLEINANZEIGEN_HOSTS: ReadonlySet<string> = new Set([
  'www.kleinanzeigen.de',
  'kleinanzeigen.de',
  'm.kleinanzeigen.de',
  'www.ebay-kleinanzeigen.de',
  'ebay-kleinanzeigen.de',
  'm.ebay-kleinanzeigen.de',
]);
const KLEINANZEIGEN_PATH =
  /^\/s-anzeige\/(?:([^/]{1,300})\/)?(\d{6,12})(?:-(\d{1,6})-(\d{1,6}))?\/?$/;

const MOBILE_DE_HOSTS: ReadonlySet<string> = new Set([
  'suchen.mobile.de',
  'm.mobile.de',
  'www.mobile.de',
  'mobile.de',
]);
const MOBILE_DE_SEO_PATH = /^\/auto-inserat\/(?:[^/]{1,300}\/)?(\d{6,12})\.html$/i;

const AUTOSCOUT24_HOST = /^(?:www\.|m\.)?autoscout24\.(de|at|ch|com|it|fr|nl|be|es|lu)$/;
const AUTOSCOUT24_PATH = new RegExp(`^/angebote/((?:[a-z0-9-]{0,300}-)?(${UUID}))/?$`, 'i');

const EBAY_HOST = /^(?:www\.|m\.)?ebay\.(de|at|ch|com|co\.uk|fr|it|es|nl|be)$/;
const EBAY_PATH = /^\/itm\/(?:[^/]{1,300}\/)?(\d{9,15})\/?$/;

const AUTOHERO_HOSTS: ReadonlySet<string> = new Set(['www.autohero.com', 'autohero.com']);
const AUTOHERO_PATH = new RegExp(`^/(de|at)/([a-z0-9-]{1,200})/id/(${UUID})/?$`, 'i');

/** Listings live in the search app on suche.pkw.de; the other hosts are the magazine and seller pages. */
const PKW_DE_SEARCH_HOST = 'suche.pkw.de';
const PKW_DE_HOSTS: ReadonlySet<string> = new Set([PKW_DE_SEARCH_HOST, 'www.pkw.de', 'pkw.de']);
const PKW_DE_PATH = /^\/fahrzeuge\/(?:details|financing)\/([a-z0-9_-]{4,64})(?:\/exposeView)?\/?$/i;

const FACEBOOK_HOSTS: ReadonlySet<string> = new Set([
  'www.facebook.com',
  'facebook.com',
  'm.facebook.com',
  'web.facebook.com',
]);
const FACEBOOK_PATH = /^\/marketplace\/item\/(\d{6,20})\/?$/;

const PLATFORMS: Record<ListingPlatform, PlatformDefinition> = {
  kleinanzeigen: {
    matchesHost: (host) => KLEINANZEIGEN_HOSTS.has(host),
    match(url) {
      const match = KLEINANZEIGEN_PATH.exec(url.pathname);
      if (!match) return null;
      const [, rawSlug, externalId, categoryId, locationId] = match;
      if (!externalId) return null;
      const slug = rawSlug && /^[a-z0-9._~%-]+$/i.test(rawSlug) ? rawSlug.toLowerCase() : null;
      const suffix = categoryId && locationId ? `-${categoryId}-${locationId}` : '';
      const path = `/s-anzeige/${slug ? `${slug}/` : ''}${externalId}${suffix}`;
      return {
        canonicalUrl: `https://${KLEINANZEIGEN_CANONICAL_HOST}${path}`,
        externalId,
        categoryId: categoryId ?? null,
      };
    },
  },
  mobile_de: {
    matchesHost: (host) => MOBILE_DE_HOSTS.has(host),
    match(url) {
      const id =
        url.pathname === '/fahrzeuge/details.html'
          ? url.searchParams.get('id')
          : (MOBILE_DE_SEO_PATH.exec(url.pathname)?.[1] ?? null);
      const externalId = id && /^\d{6,12}$/.test(id) ? id : null;
      if (!externalId) return null;
      return {
        canonicalUrl: `https://suchen.mobile.de/fahrzeuge/details.html?id=${externalId}`,
        externalId,
        categoryId: null,
      };
    },
  },
  autoscout24: {
    matchesHost: (host) => AUTOSCOUT24_HOST.test(host),
    match(url, host) {
      const match = AUTOSCOUT24_PATH.exec(url.pathname);
      const tld = AUTOSCOUT24_HOST.exec(host)?.[1];
      if (!match?.[1] || !match[2] || !tld) return null;
      return {
        canonicalUrl: `https://www.autoscout24.${tld}/angebote/${match[1].toLowerCase()}`,
        externalId: match[2].toLowerCase(),
        categoryId: null,
      };
    },
  },
  ebay: {
    matchesHost: (host) => EBAY_HOST.test(host),
    match(url, host) {
      const externalId = EBAY_PATH.exec(url.pathname)?.[1];
      const tld = EBAY_HOST.exec(host)?.[1];
      if (!externalId || !tld) return null;
      return {
        canonicalUrl: `https://www.ebay.${tld}/itm/${externalId}`,
        externalId,
        categoryId: null,
      };
    },
  },
  autohero: {
    matchesHost: (host) => AUTOHERO_HOSTS.has(host),
    match(url) {
      const match = AUTOHERO_PATH.exec(url.pathname);
      if (!match?.[1] || !match[2] || !match[3]) return null;
      const externalId = match[3].toLowerCase();
      return {
        canonicalUrl: `https://www.autohero.com/${match[1].toLowerCase()}/${match[2].toLowerCase()}/id/${externalId}/`,
        externalId,
        categoryId: null,
      };
    },
  },
  pkw_de: {
    matchesHost: (host) => PKW_DE_HOSTS.has(host),
    match(url, host) {
      const externalId = host === PKW_DE_SEARCH_HOST ? PKW_DE_PATH.exec(url.pathname)?.[1] : null;
      if (!externalId) return null;
      return {
        canonicalUrl: `https://${PKW_DE_SEARCH_HOST}/fahrzeuge/details/${externalId}`,
        externalId,
        categoryId: null,
      };
    },
  },
  facebook: {
    matchesHost: (host) => FACEBOOK_HOSTS.has(host),
    match(url) {
      const externalId = FACEBOOK_PATH.exec(url.pathname)?.[1];
      if (!externalId) return null;
      return {
        canonicalUrl: `https://www.facebook.com/marketplace/item/${externalId}/`,
        externalId,
        categoryId: null,
      };
    },
  },
};

export function platformForHost(host: string): ListingPlatform | null {
  const normalized = host.toLowerCase().replace(/\.$/, '');
  return LISTING_PLATFORMS.find((platform) => PLATFORMS[platform].matchesHost(normalized)) ?? null;
}

const URL_IN_TEXT = /https?:\/\/[^\s<>"'`]+/i;
const BARE_HOST = /^([a-z0-9-]+(?:\.[a-z0-9-]+)+)\//i;
const TRAILING_PUNCTUATION = /[.,;:!?)\]}>»“”'"]+$/;

/**
 * Accepts either a bare URL or a text that contains one (e.g. the text a
 * marketplace app produces when sharing a listing).
 */
export function recognizeListingUrl(input: string): ListingUrlRecognition {
  const trimmed = input.trim();
  if (trimmed.length === 0) return { ok: false, reason: 'empty' };
  if (trimmed.length > MAX_URL_INPUT_LENGTH) return { ok: false, reason: 'too_long' };

  let candidate: string;
  const embedded = URL_IN_TEXT.exec(trimmed);
  const bareHost = BARE_HOST.exec(trimmed)?.[1];
  if (embedded) {
    candidate = embedded[0];
  } else if (bareHost && platformForHost(bareHost) && !/\s/.test(trimmed)) {
    candidate = `https://${trimmed}`;
  } else if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) && !/\s/.test(trimmed)) {
    // Some other scheme, e.g. javascript: or file:
    return { ok: false, reason: 'invalid_protocol' };
  } else {
    return { ok: false, reason: 'not_a_url' };
  }
  candidate = candidate.replace(TRAILING_PUNCTUATION, '');

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return { ok: false, reason: 'not_a_url' };
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, reason: 'invalid_protocol' };
  }
  if (url.username !== '' || url.password !== '') {
    return { ok: false, reason: 'credentials_not_allowed' };
  }
  if (url.port !== '') {
    return { ok: false, reason: 'port_not_allowed' };
  }

  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  const source = platformForHost(host);
  if (!source) return { ok: false, reason: 'unsupported_host', host };

  const match = PLATFORMS[source].match(url, host);
  if (!match) return { ok: false, reason: 'not_a_listing', host, source };
  return { ok: true, source, ...match };
}

/**
 * Image hosts from which listing photos may be displayed. Must stay in sync
 * with the `img-src` Content-Security-Policy of the API server.
 */
export const LISTING_IMAGE_HOSTS: readonly string[] = ['img.kleinanzeigen.de', 'i.ebayimg.com'];

export function isAllowedImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.username === '' &&
      url.password === '' &&
      url.port === '' &&
      LISTING_IMAGE_HOSTS.includes(url.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
}
