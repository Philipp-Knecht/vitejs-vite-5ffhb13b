import { PLATFORM_NAMES, recognizeListingUrl } from '@kaufcheck/shared';

/** The marketplace a stored listing link belongs to, e.g. "mobile.de"; null if unknown. */
export function listingPlatformName(url: string | null | undefined): string | null {
  if (!url) return null;
  const recognition = recognizeListingUrl(url);
  return recognition.ok ? PLATFORM_NAMES[recognition.source] : null;
}
