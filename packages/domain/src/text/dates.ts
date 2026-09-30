import type { YearMonth } from '@kaufcheck/shared';

const MONTHS: Record<string, number> = {
  januar: 1,
  jan: 1,
  jaenner: 1,
  jänner: 1,
  februar: 2,
  feb: 2,
  märz: 3,
  maerz: 3,
  mär: 3,
  mrz: 3,
  april: 4,
  apr: 4,
  mai: 5,
  juni: 6,
  jun: 6,
  juli: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  oktober: 10,
  okt: 10,
  november: 11,
  nov: 11,
  dezember: 12,
  dez: 12,
};

const MIN_YEAR = 1900;

function plausibleYear(year: number, reference: Date, maxYearsAhead: number): boolean {
  return year >= MIN_YEAR && year <= reference.getFullYear() + maxYearsAhead;
}

function expandTwoDigitYear(value: number, reference: Date, maxYearsAhead: number): number {
  const candidate = 2000 + value;
  return candidate <= reference.getFullYear() + maxYearsAhead ? candidate : 1900 + value;
}

/**
 * Parses month/year values: "Mai 2012", "05/2012", "5/12", "05.2012",
 * "2012-05" or "2012". `maxYearsAhead` bounds plausible future years
 * (HU dates lie in the future, registrations normally do not).
 */
export function parseYearMonth(
  input: string,
  reference: Date,
  maxYearsAhead = 4,
): YearMonth | null {
  const text = input.trim().toLowerCase();

  const named = /([a-zäöü]{3,9})\.?\s*(\d{4})/.exec(text);
  if (named?.[1] && named[2]) {
    const month = MONTHS[named[1]];
    const year = Number(named[2]);
    if (month && plausibleYear(year, reference, maxYearsAhead)) return { year, month };
  }

  const isoLike = /\b(\d{4})[-/.](\d{1,2})\b/.exec(text);
  if (isoLike?.[1] && isoLike[2]) {
    const year = Number(isoLike[1]);
    const month = Number(isoLike[2]);
    if (month >= 1 && month <= 12 && plausibleYear(year, reference, maxYearsAhead)) {
      return { year, month };
    }
  }

  const monthYear = /\b(\d{1,2})\s*[/.-]\s*(\d{4}|\d{2})\b/.exec(text);
  if (monthYear?.[1] && monthYear[2]) {
    const month = Number(monthYear[1]);
    let year = Number(monthYear[2]);
    if (monthYear[2].length === 2) year = expandTwoDigitYear(year, reference, maxYearsAhead);
    if (month >= 1 && month <= 12 && plausibleYear(year, reference, maxYearsAhead)) {
      return { year, month };
    }
  }

  const yearOnly = /\b(19\d{2}|20\d{2})\b/.exec(text);
  if (yearOnly?.[1]) {
    const year = Number(yearOnly[1]);
    if (plausibleYear(year, reference, maxYearsAhead)) return { year, month: null };
  }

  return null;
}

function toIsoDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

/** Parses "28.09.2026", "Heute, 14:30" or "Gestern" into an ISO date (YYYY-MM-DD). */
export function parseGermanDate(input: string, reference: Date): string | null {
  const text = input.trim().toLowerCase();
  if (text.startsWith('heute')) return reference.toISOString().slice(0, 10);
  if (text.startsWith('gestern')) {
    return new Date(reference.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }
  const match = /\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/.exec(text);
  if (!match?.[1] || !match[2] || !match[3]) return null;
  const year = Number(match[3]);
  if (!plausibleYear(year, reference, 1)) return null;
  return toIsoDate(year, Number(match[2]), Number(match[1]));
}

/**
 * Whole months from a month/year to a reference date. A missing month is
 * treated as mid-year, which is why callers label such ages as approximate.
 */
export function monthsSince(from: YearMonth, reference: Date): number {
  const month = from.month ?? 7;
  return (reference.getFullYear() - from.year) * 12 + (reference.getMonth() + 1 - month);
}

/**
 * Months from the reference date until the end of the given month.
 * HU validity runs until the end of the stated month.
 */
export function monthsUntil(to: YearMonth, reference: Date): number {
  const month = to.month ?? 12;
  return (to.year - reference.getFullYear()) * 12 + (month - (reference.getMonth() + 1));
}

export function compareYearMonth(a: YearMonth, b: YearMonth): number {
  return a.year !== b.year ? a.year - b.year : (a.month ?? 0) - (b.month ?? 0);
}
