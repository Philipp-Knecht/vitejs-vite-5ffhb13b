import type { ListingSource, NormalizedListing } from '@kaufcheck/shared';
import { redactContactData } from '../text/redact';
import { extractDescriptionSignals } from '../vehicle/description-signals';
import { detectCategory, type CategoryDetection } from './detect-category';
import { normalizeListing } from './normalize-listing';
import { hasListingContent, type ParsedListing } from './parsed-listing';

export type PrepareListingResult =
  | { ok: true; listing: NormalizedListing; detection: CategoryDetection }
  | {
      ok: false;
      reason: 'no_content' | 'unsupported_category' | 'unsupported_vehicle_kind';
      detection: CategoryDetection | null;
    };

export interface PrepareListingInput {
  parsed: ParsedListing;
  source: ListingSource;
  /** Category id from the listing URL, if known. */
  urlCategoryId: string | null;
}

function redactParsed(parsed: ParsedListing): ParsedListing {
  return {
    ...parsed,
    title: parsed.title ? redactContactData(parsed.title) : null,
    description: parsed.description ? redactContactData(parsed.description) : null,
    attributes: parsed.attributes.map((attribute) => ({
      label: attribute.label,
      value: redactContactData(attribute.value),
    })),
  };
}

/**
 * Common ingestion step for every source (URL, pasted text, example):
 * redact contact data, detect the category and normalize.
 */
export function prepareListing({
  parsed,
  source,
  urlCategoryId,
}: PrepareListingInput): PrepareListingResult {
  const redacted = redactParsed(parsed);
  if (!hasListingContent(redacted)) return { ok: false, reason: 'no_content', detection: null };

  const signals = extractDescriptionSignals(
    redacted.description,
    redacted.title,
    new Date(source.retrievedAt),
  );
  const detection = detectCategory(redacted, signals, urlCategoryId);
  if (detection.category === null) return { ok: false, reason: 'unsupported_category', detection };
  if (detection.category === 'vehicle' && detection.vehicleKind !== 'car') {
    return { ok: false, reason: 'unsupported_vehicle_kind', detection };
  }

  const listing = normalizeListing({
    parsed: redacted,
    signals,
    source,
    category: detection.category,
  });
  return { ok: true, listing, detection };
}
