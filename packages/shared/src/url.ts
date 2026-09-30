/**
 * Recognition of supported listing URLs.
 *
 * This is the single definition of which links KaufCheck accepts. The web app
 * uses it for instant feedback; the API uses it as the authoritative gate
 * before anything is fetched (host allowlist = first SSRF defence layer).
 */

export const KLEINANZEIGEN_CANONICAL_HOST = 'www.kleinanzeigen.de';

/** Hosts accepted as input. Legacy eBay-Kleinanzeigen hosts are normalized. */
const KLEINANZEIGEN_HOSTS: ReadonlySet<string> = new Set([
  'www.kleinanzeigen.de',
  'kleinanzeigen.de',
  'm.kleinanzeigen.de',
  'www.ebay-kleinanzeigen.de',
  'ebay-kleinanzeigen.de',
  'm.ebay-kleinanzeigen.de',
]);

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
      source: 'kleinanzeigen';
      canonicalUrl: string;
      externalId: string;
      categoryId: string | null;
    }
  | { ok: false; reason: ListingUrlRejection; host?: string };

const URL_IN_TEXT = /https?:\/\/[^\s<>"'`]+/i;
const BARE_HOST_START = /^(?:(?:www|m)\.)?(?:ebay-)?kleinanzeigen\.de\//i;
const TRAILING_PUNCTUATION = /[.,;:!?)\]}>»“”'"]+$/;
const LISTING_PATH = /^\/s-anzeige\/(?:([^/]{1,300})\/)?(\d{6,12})(?:-(\d{1,6})-(\d{1,6}))?\/?$/;

/**
 * Accepts either a bare URL or a text that contains one (e.g. the text the
 * Kleinanzeigen app produces when sharing a listing).
 */
export function recognizeListingUrl(input: string): ListingUrlRecognition {
  const trimmed = input.trim();
  if (trimmed.length === 0) return { ok: false, reason: 'empty' };
  if (trimmed.length > MAX_URL_INPUT_LENGTH) return { ok: false, reason: 'too_long' };

  let candidate: string;
  const embedded = URL_IN_TEXT.exec(trimmed);
  if (embedded) {
    candidate = embedded[0];
  } else if (BARE_HOST_START.test(trimmed) && !/\s/.test(trimmed)) {
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
  if (!KLEINANZEIGEN_HOSTS.has(host)) {
    return { ok: false, reason: 'unsupported_host', host };
  }

  const match = LISTING_PATH.exec(url.pathname);
  if (!match) return { ok: false, reason: 'not_a_listing', host };

  const [, rawSlug, externalId, categoryId, locationId] = match;
  if (!externalId) return { ok: false, reason: 'not_a_listing', host };

  const slug = rawSlug && /^[a-z0-9._~%-]+$/i.test(rawSlug) ? rawSlug.toLowerCase() : null;
  const suffix = categoryId && locationId ? `-${categoryId}-${locationId}` : '';
  const path = `/s-anzeige/${slug ? `${slug}/` : ''}${externalId}${suffix}`;

  return {
    ok: true,
    source: 'kleinanzeigen',
    canonicalUrl: `https://${KLEINANZEIGEN_CANONICAL_HOST}${path}`,
    externalId,
    categoryId: categoryId ?? null,
  };
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
