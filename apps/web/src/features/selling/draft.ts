import type { ListingTextValues } from '@kaufcheck/shared';

export interface ListingTextDraft {
  /** The car from „Mein Auto“ the form was prefilled from, or empty. */
  source: string;
  values: ListingTextValues;
  /** The text was created (Pro): it is shown again after a link within the app. */
  created: boolean;
  /** Counts the changes, so that the contract knows when the listing changed. */
  revision: number;
}

/**
 * What was typed for the listing, kept in memory only like the purchase
 * contract: it survives a click on a link within the app, but not a reload.
 */
let draft: ListingTextDraft | null = null;
let revision = 0;
/** The listing last taken over into the purchase contract. */
let applied: { source: string; revision: number; values: ListingTextValues } | null = null;

export const readListingTextDraft = (source: string) => (draft?.source === source ? draft : null);

/** The latest listing, whatever it was prefilled from: for the purchase contract. */
export const latestListingTextDraft = () => draft;

export function keepListingTextDraft(next: Omit<ListingTextDraft, 'revision'>): void {
  const changed =
    draft === null ||
    draft.source !== next.source ||
    JSON.stringify(draft.values) !== JSON.stringify(next.values);
  if (changed) revision += 1;
  draft = { ...next, revision };
}

/** True when the listing changed since it was last taken over into the contract. */
export const listingChangedSinceContract = (current: ListingTextDraft) =>
  current.revision !== applied?.revision;

/** What the contract of the same car last took over from the listing, or null. */
export const listingInContract = (current: ListingTextDraft) =>
  applied?.source === current.source ? applied.values : null;

export function markListingInContract(current: ListingTextDraft): void {
  applied = { source: current.source, revision: current.revision, values: current.values };
}

/** On logout or an account switch, e.g. on a shared device. */
export function clearListingTextDraft(): void {
  draft = null;
  applied = null;
}
