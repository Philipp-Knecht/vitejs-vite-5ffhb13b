/**
 * Ads that KaufCheck sells itself (sponsorships): text and an optional image
 * from KaufCheck's own server, linked to the advertiser. Nothing is loaded
 * from the advertiser before a click and no data is handed over.
 */

/** The ad placements: below editorial content or an analysis (see `AdSlot`). */
export const AD_PLACEMENTS = ['result_bottom', 'guide_bottom'] as const;
export type AdPlacement = (typeof AD_PLACEMENTS)[number];

/** An image of our own site: a path to a file, nothing from another host. */
export const SPONSOR_IMAGE_PATTERN = /^\/(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.(?:png|jpe?g|webp)$/;

/** Day in Germany as YYYY-MM-DD: campaigns run from and until German calendar days. */
export function germanDay(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(now);
}

/** Whether a campaign runs on `day` (YYYY-MM-DD); both ends are included. */
export function sponsorAdRuns(ad: { from?: string; until?: string }, day: string): boolean {
  return (!ad.from || ad.from <= day) && (!ad.until || day <= ad.until);
}
