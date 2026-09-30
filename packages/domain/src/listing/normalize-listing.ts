import {
  SELLER_TYPES,
  type ListingCategory,
  type ListingSource,
  type Location,
  type NormalizedListing,
  type Price,
  type SellerType,
} from '@kaufcheck/shared';
import { parseGermanDate } from '../text/dates';
import { parsePrice } from '../text/numbers';
import { redactContactData } from '../text/redact';
import { cleanInline, cleanText, truncate } from '../text/text';
import type { DescriptionSignals } from '../vehicle/description-signals';
import { normalizeVehicle } from '../vehicle/normalize-vehicle';
import type { ParsedListing } from './parsed-listing';

export const MAX_DESCRIPTION_LENGTH = 12_000;
const MAX_ATTRIBUTES = 60;

export interface NormalizeListingInput {
  parsed: ParsedListing;
  signals: DescriptionSignals;
  source: ListingSource;
  category: ListingCategory;
}

function normalizePrice(parsed: ParsedListing, signals: DescriptionSignals): Price | null {
  if (parsed.priceText) {
    const price = parsePrice(parsed.priceText);
    if (price)
      return { amountEur: price.amountEur, kind: price.kind, raw: cleanInline(parsed.priceText) };
  }
  // A price stated only in the description is still a listing fact.
  const mention = signals.priceMentions[0];
  if (mention) {
    const price = parsePrice(mention.quote);
    return {
      amountEur: mention.amountEur,
      kind: price?.kind === 'negotiable' || price?.kind === 'fixed' ? price.kind : 'asking',
      raw: mention.quote,
    };
  }
  return null;
}

const LOCATION = /^(\d{5})?\s*([^-–]+?)?(?:\s+[-–]\s+(.+))?$/;

function normalizeLocation(text: string | null): Location | null {
  if (!text) return null;
  const raw = truncate(cleanInline(text), 120);
  const match = LOCATION.exec(raw);
  const postalCode = match?.[1] ?? null;
  const city = match?.[2]?.trim() || null;
  const district = match?.[3]?.trim() || null;
  if (!postalCode && !city) return null;
  return { postalCode, city, district, raw };
}

function normalizeSellerType(text: string | null): SellerType | null {
  if (!text) return null;
  const value = text.toLowerCase();
  if (/gewerb|händler|haendler/.test(value)) return 'commercial';
  if (/privat/.test(value)) return 'private';
  return null;
}

export function normalizeListing({
  parsed,
  signals,
  source,
  category,
}: NormalizeListingInput): NormalizedListing {
  const reference = new Date(source.retrievedAt);
  const description = parsed.description
    ? truncate(redactContactData(cleanText(parsed.description)), MAX_DESCRIPTION_LENGTH)
    : null;
  const title = parsed.title ? truncate(redactContactData(cleanInline(parsed.title)), 200) : null;

  const sellerType = normalizeSellerType(parsed.sellerTypeText);
  const redactedParsed: ParsedListing = { ...parsed, title, description };

  return {
    category,
    source,
    status: parsed.status,
    title,
    price: normalizePrice(parsed, signals),
    location: normalizeLocation(parsed.locationText),
    seller: {
      type:
        sellerType && (SELLER_TYPES as readonly string[]).includes(sellerType) ? sellerType : null,
      memberSince: parsed.memberSinceText
        ? parseGermanDate(parsed.memberSinceText, reference)
        : null,
    },
    postedAt: parsed.postedAtText ? parseGermanDate(parsed.postedAtText, reference) : null,
    description,
    images: parsed.images,
    attributes: parsed.attributes.slice(0, MAX_ATTRIBUTES).map((attribute) => ({
      label: truncate(cleanInline(attribute.label), 60),
      value: truncate(redactContactData(cleanInline(attribute.value)), 200),
    })),
    vehicle: category === 'vehicle' ? normalizeVehicle(redactedParsed, signals, reference) : null,
  };
}
