/**
 * 17 characters without I, O and Q (ISO 3779), not part of a longer word or a
 * URL. No lookbehind: Safari supports it only from version 16.4.
 */
const VIN_PATTERN = /(^|[^\p{L}\p{N}_/=?&#])([A-HJ-NPR-Z0-9]{17})(?![\p{L}\p{N}_])/giu;
const VIN_KEYWORD =
  /(?:fin|vin|fahrgestell\S*|identifizierungsnummer|ident-?nr\.?|chassis\S*)\W*$/i;

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

/**
 * Every plausible FIN in a text, upper-cased. Without a digit before the
 * serial number (e.g. WVWZZZAUZFW123456) a FIN needs a keyword such as „FIN:“
 * in front, so that „ERSTZULASSUNG2018“ is not taken for one.
 */
export function findVins(text: string | null | undefined): { vin: string; index: number }[] {
  if (!text) return [];
  const found: { vin: string; index: number }[] = [];
  for (const match of text.matchAll(VIN_PATTERN)) {
    const prefix = match[1] ?? '';
    const token = match[2] ?? '';
    const index = match.index + prefix.length;
    if (!isPlausibleVin(token)) continue;
    const keyword = VIN_KEYWORD.test(text.slice(Math.max(0, index - 40), index));
    if (keyword || /\d/.test(token.slice(0, 11))) found.push({ vin: token.toUpperCase(), index });
  }
  return found;
}

/** The first plausible FIN in a text; `null` if there is none. */
export function findVin(text: string | null | undefined): { vin: string; index: number } | null {
  return findVins(text)[0] ?? null;
}
