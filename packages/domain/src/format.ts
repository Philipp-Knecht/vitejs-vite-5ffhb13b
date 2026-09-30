import type { YearMonth } from '@kaufcheck/shared';

/** Non-breaking space keeps numbers and units together. */
export const NBSP = '\u00A0';

const numberFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
const decimalFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });

export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

export function formatDecimal(value: number): string {
  return decimalFormat.format(value);
}

export function formatEuro(value: number): string {
  return `${formatNumber(value)}${NBSP}€`;
}

export function formatKm(value: number): string {
  return `${formatNumber(value)}${NBSP}km`;
}

export function formatPower(kw: number, ps: number): string {
  return `${kw}${NBSP}kW (${ps}${NBSP}PS)`;
}

export function formatYearMonth(value: YearMonth): string {
  return value.month ? `${String(value.month).padStart(2, '0')}/${value.year}` : String(value.year);
}

export function formatIsoDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!match) return isoDate;
  return `${match[3]}.${match[2]}.${match[1]}`;
}

export function plural(count: number, singular: string, pluralForm: string): string {
  return `${formatNumber(count)}${NBSP}${count === 1 ? singular : pluralForm}`;
}

/** "14 Jahre, 4 Monate", "9 Monate", "1 Jahr". */
export function formatMonthsDuration(totalMonths: number): string {
  const months = Math.max(0, Math.round(totalMonths));
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return plural(rest, 'Monat', 'Monate');
  if (rest === 0) return plural(years, 'Jahr', 'Jahre');
  return `${plural(years, 'Jahr', 'Jahre')}, ${plural(rest, 'Monat', 'Monate')}`;
}

/** German list: "A, B und C". */
export function joinGerman(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} und ${items[items.length - 1]}`;
}
