import type { ListingAttribute, ListingImage } from '@kaufcheck/shared';

/**
 * Raw extraction result of a listing, before normalization. All values are
 * strings exactly as found; nothing is inferred at this stage.
 */
export interface ParsedListing {
  title: string | null;
  priceText: string | null;
  locationText: string | null;
  postedAtText: string | null;
  sellerTypeText: string | null;
  memberSinceText: string | null;
  attributes: ListingAttribute[];
  equipment: string[];
  description: string | null;
  images: ListingImage[];
  externalId: string | null;
  /** Category names found on the page (breadcrumb) or given by the source. */
  categoryHints: string[];
  status: 'active' | 'reserved' | 'deleted' | null;
}

export function emptyParsedListing(): ParsedListing {
  return {
    title: null,
    priceText: null,
    locationText: null,
    postedAtText: null,
    sellerTypeText: null,
    memberSinceText: null,
    attributes: [],
    equipment: [],
    description: null,
    images: [],
    externalId: null,
    categoryHints: [],
    status: null,
  };
}

/** True when the parse produced anything that looks like listing content. */
export function hasListingContent(parsed: ParsedListing): boolean {
  return Boolean(
    parsed.title || parsed.priceText || parsed.attributes.length > 0 || parsed.description,
  );
}

/** Removes status prefixes Kleinanzeigen puts in front of titles ("Reserviert • …"). */
export function stripTitleMarkers(title: string): {
  title: string;
  status: ParsedListing['status'];
} {
  let status: ParsedListing['status'] = null;
  let result = title.trim();
  const marker = /^(reserviert|gelöscht)\s*[•·|-]\s*/i;
  let match = marker.exec(result);
  while (match?.[1]) {
    status = match[1].toLowerCase() === 'reserviert' ? 'reserved' : 'deleted';
    result = result.slice(match[0].length);
    match = marker.exec(result);
  }
  return { title: result.trim(), status };
}
