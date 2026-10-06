import type { ParsedListing } from '@kaufcheck/domain';
import type { ListingPlatform, ListingSource } from '@kaufcheck/shared';

/** A recognized listing URL (see `recognizeListingUrl`). */
export interface ListingUrl {
  source: ListingPlatform;
  canonicalUrl: string;
  externalId: string;
  categoryId: string | null;
}

export interface RetrievedListing {
  parsed: ParsedListing;
  source: ListingSource;
  urlCategoryId: string | null;
}

/**
 * Retrieves a listing by URL from a source that permits it. Implementations
 * throw `AppError` with SOURCE_NOT_PERMITTED, FETCH_BLOCKED, FETCH_FAILED,
 * LISTING_NOT_FOUND or PARSING_FAILED; the pipeline then offers the text
 * fallback. Future sources (official APIs, browser-assisted import) plug in here.
 */
export interface ListingUrlRetriever {
  readonly mode: 'off' | 'live' | 'fixtures';
  /** Platforms whose listings this retriever may fetch; links to others are only kept for reference. */
  readonly platforms: readonly ListingPlatform[];
  retrieve(url: ListingUrl, signal: AbortSignal): Promise<RetrievedListing>;
}
