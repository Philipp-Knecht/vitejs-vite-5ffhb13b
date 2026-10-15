import type { ListingTextValues } from '@kaufcheck/shared';

export interface ListingTextDraft {
  /** The car from „Mein Auto“ the form was prefilled from, or empty. */
  source: string;
  values: ListingTextValues;
}

/**
 * What was typed for the listing, kept in memory only like the purchase
 * contract: it survives a click on a link within the app, but not a reload.
 */
let draft: ListingTextDraft | null = null;

export const readListingTextDraft = (source: string) => (draft?.source === source ? draft : null);

/** The latest listing, whatever it was prefilled from: for the purchase contract. */
export const latestListingTextDraft = () => draft;

export function keepListingTextDraft(next: ListingTextDraft): void {
  draft = next;
}

/** On logout or an account switch, e.g. on a shared device. */
export function clearListingTextDraft(): void {
  draft = null;
}
