const ZERO_WIDTH = /[\u200B-\u200D\u2060\uFEFF]/g;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const SPACE_VARIANTS = /[\u00A0\u2002-\u200A\u202F\u205F\u3000]/g;

/**
 * Normalizes untrusted multi-line text: unifies line breaks and spaces,
 * removes control and zero-width characters, trims lines and collapses
 * runs of blank lines.
 */
export function cleanText(input: string): string {
  return input
    .replace(/\r\n?/g, '\n')
    .replace(ZERO_WIDTH, '')
    .replace(CONTROL_CHARS, '')
    .replace(SPACE_VARIANTS, ' ')
    .replace(/\t/g, ' ')
    .split('\n')
    .map((line) => line.replace(/ {2,}/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Single-line variant of {@link cleanText}: all whitespace collapses to one space. */
export function cleanInline(input: string): string {
  return cleanText(input).replace(/\s+/g, ' ').trim();
}

/** Lower-cased, whitespace-collapsed form used for keyword matching. */
export function normalizeForMatch(input: string): string {
  return cleanInline(input).toLowerCase();
}

/** Folds German umlauts and ß so that "Außenfarbe" and "Aussenfarbe" match. */
export function foldGerman(input: string): string {
  return input
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss');
}

export function wordCount(text: string | null | undefined): number {
  if (!text) return 0;
  const words = text.match(/[\p{L}\p{N}][\p{L}\p{N}'’.-]*/gu);
  return words ? words.length : 0;
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * Returns the sentence (or line) around a match, trimmed to a readable
 * length. Used to show verbatim evidence ("Zitat aus dem Inserat").
 */
export function snippetAround(
  text: string,
  index: number,
  matchLength: number,
  maxLength = 180,
): string {
  const boundary = /[.!?\n]/;
  let start = index;
  while (start > 0 && !boundary.test(text[start - 1] ?? '')) start -= 1;
  let end = index + matchLength;
  while (end < text.length && !boundary.test(text[end] ?? '')) end += 1;
  if (end < text.length && text[end] !== '\n') end += 1;

  let snippet = text.slice(start, end).replace(/\s+/g, ' ').trim();
  if (snippet.length > maxLength) {
    const relative = index - start;
    const from = Math.max(
      0,
      Math.min(relative - Math.floor(maxLength / 3), snippet.length - maxLength),
    );
    snippet = `${from > 0 ? '…' : ''}${snippet.slice(from, from + maxLength).trim()}${
      from + maxLength < snippet.length ? '…' : ''
    }`;
  }
  return snippet;
}

/** Case- and whitespace-insensitive containment check for quote verification. */
export function containsVerbatim(haystack: string, needle: string): boolean {
  const normalize = (value: string) =>
    value
      .toLowerCase()
      .replace(/[„“”"‚‘’'«»]/g, '"')
      .replace(/[–—]/g, '-')
      .replace(/…/g, '...')
      .replace(/\s+/g, ' ')
      .trim();
  const n = normalize(needle)
    .replace(/^\.\.\.|\.\.\.$/g, '')
    .trim();
  if (n.length === 0) return false;
  return normalize(haystack).includes(n);
}

export function uniqueBy<T>(items: readonly T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const k = key(item);
    if (seen.has(k)) continue;
    seen.add(k);
    result.push(item);
  }
  return result;
}
