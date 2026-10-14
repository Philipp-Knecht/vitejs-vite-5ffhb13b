/** 17 characters without I, O and Q (ISO 3779), not part of a longer word or a URL. */
const VIN_PATTERN = /(?<![\p{L}\p{N}_/=?&#])[A-HJ-NPR-Z0-9]{17}(?![\p{L}\p{N}_])/giu;

/**
 * A FIN as written in papers and listings: one letter case and letters as well
 * as digits; the last four characters are digits (ISO 3779). This rules out
 * part numbers, words run together with numbers, URL ids and masked FINs.
 */
export function isPlausibleVin(token: string): boolean {
  return (
    /^[A-HJ-NPR-Z0-9]{17}$/i.test(token) &&
    (token === token.toUpperCase() || token === token.toLowerCase()) &&
    /[a-z]/i.test(token) &&
    /\d{4}$/.test(token)
  );
}

/** The first plausible FIN in a text, upper-cased; `null` if there is none. */
export function findVin(text: string | null | undefined): { vin: string; index: number } | null {
  if (!text) return null;
  for (const match of text.matchAll(VIN_PATTERN)) {
    if (isPlausibleVin(match[0])) return { vin: match[0].toUpperCase(), index: match.index };
  }
  return null;
}
