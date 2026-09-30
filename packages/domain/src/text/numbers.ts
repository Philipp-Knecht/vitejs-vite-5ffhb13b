/**
 * Parsing of German-formatted numbers as they appear in listings
 * ("185.000 km", "12.900,- €", "185 Tkm", "228 kW (310 PS)").
 */

const INTEGER_TOKEN = /(\d{1,3}(?:[.'’ ]\d{3})+|\d+)(?:,(\d{1,2}))?/;

export function parseGermanInteger(input: string): number | null {
  const match = INTEGER_TOKEN.exec(input);
  if (!match?.[1]) return null;
  const integer = Number.parseInt(match[1].replace(/[.'’ ]/g, ''), 10);
  if (!Number.isFinite(integer)) return null;
  const decimals = match[2];
  if (decimals) return Math.round(Number(`${integer}.${decimals}`));
  return integer;
}

const THOUSANDS_KM =
  /(\d{1,4}(?:[.,]\d{1,3})?)\s*(?:tkm|tsd\.?\s*km|tsd\.?|t\.\s*km|tausend(?:\s*km)?|k\s*km|k\b)/i;

export const MAX_PLAUSIBLE_MILEAGE_KM = 2_000_000;

/** Parses a mileage value; supports "185.000 km", "185000", "185 Tkm", "185k". */
export function parseMileageKm(input: string): number | null {
  const thousands = THOUSANDS_KM.exec(input);
  let value: number | null;
  if (thousands?.[1]) {
    const base = Number(thousands[1].replace(',', '.'));
    // "185.000 tkm" would be nonsense; a dot followed by 3 digits is a thousands separator.
    value = /[.,]\d{3}$/.test(thousands[1])
      ? parseGermanInteger(thousands[1])
      : Math.round(base * 1000);
  } else {
    value = parseGermanInteger(input);
  }
  if (value === null || value < 0 || value > MAX_PLAUSIBLE_MILEAGE_KM) return null;
  return value;
}

export interface Power {
  kw: number;
  ps: number;
}

const PS_PER_KW = 1.35962;

export function psToKw(ps: number): number {
  return Math.round(ps / PS_PER_KW);
}

export function kwToPs(kw: number): number {
  return Math.round(kw * PS_PER_KW);
}

/** Parses "310 PS", "228 kW", "228 kW (310 PS)" or a bare number (assumed PS). */
export function parsePower(input: string): Power | null {
  const ps = /(\d{2,4})\s*(?:ps|hp|cv)\b/i.exec(input);
  const kw = /(\d{2,4})\s*kw\b/i.exec(input);
  let result: Power | null = null;
  if (ps?.[1] && kw?.[1]) {
    result = { ps: Number(ps[1]), kw: Number(kw[1]) };
  } else if (ps?.[1]) {
    const value = Number(ps[1]);
    result = { ps: value, kw: psToKw(value) };
  } else if (kw?.[1]) {
    const value = Number(kw[1]);
    result = { ps: kwToPs(value), kw: value };
  } else if (/^\s*\d{2,4}\s*$/.test(input)) {
    const value = Number(input.trim());
    result = { ps: value, kw: psToKw(value) };
  }
  if (!result) return null;
  if (result.ps < 10 || result.ps > 2500) return null;
  return result;
}

export type ParsedPrice =
  | { amountEur: number; kind: 'asking' | 'negotiable' | 'fixed' }
  | { amountEur: 0; kind: 'give_away' };

export const MAX_PLAUSIBLE_PRICE_EUR = 20_000_000;

/**
 * Parses a price text such as "12.900 € VB", "12900€", "Festpreis 8.500 €"
 * or "Zu verschenken". Returns `null` when no amount is stated (e.g. only "VB").
 */
export function parsePrice(input: string): ParsedPrice | null {
  const text = input.toLowerCase();
  if (/zu verschenken|verschenke/.test(text)) return { amountEur: 0, kind: 'give_away' };
  const amount = parseGermanInteger(text.replace(/\b(19|20)\d{2}\b(?!\s*(?:€|eur))/g, ''));
  if (amount === null || amount < 0 || amount > MAX_PLAUSIBLE_PRICE_EUR) return null;
  const kind = /\bvb\b|verhandlungsbasis|verhandelbar/.test(text)
    ? 'negotiable'
    : /festpreis|fixpreis/.test(text)
      ? 'fixed'
      : 'asking';
  return { amountEur: amount, kind };
}
