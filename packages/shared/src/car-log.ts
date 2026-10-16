/**
 * Kostenbuch and self-kept service history for a car in „Mein Auto“ (Pro).
 * Entries are what the owner enters; KaufCheck confirms nothing.
 */

export const CAR_LOG_KINDS = [
  'fuel',
  'charging',
  'service',
  'repair',
  'tyres',
  'inspection',
  'insurance',
  'tax',
  'parking',
  'care',
  'other',
] as const;
export type CarLogKind = (typeof CAR_LOG_KINDS)[number];

export const CAR_LOG_KIND_LABELS: Record<CarLogKind, string> = {
  fuel: 'Tanken',
  charging: 'Laden',
  service: 'Inspektion und Wartung',
  repair: 'Reparatur',
  tyres: 'Reifen',
  inspection: 'HU/AU',
  insurance: 'Versicherung',
  tax: 'Kfz-Steuer',
  parking: 'Parken und Maut',
  care: 'Pflege und Wäsche',
  other: 'Sonstiges',
};

/** Entries that belong into the service history. */
export const SERVICE_LOG_KINDS: ReadonlySet<CarLogKind> = new Set([
  'service',
  'repair',
  'tyres',
  'inspection',
]);

/** Entries with a quantity: litres or kilowatt hours. */
export const QUANTITY_UNITS: Partial<Record<CarLogKind, 'l' | 'kWh'>> = {
  fuel: 'l',
  charging: 'kWh',
};

/** Entries per car; far beyond years of weekly fill-ups. */
export const CAR_LOG_MAX_ENTRIES = 2000;

export interface CarLogEntryLike {
  /** YYYY-MM-DD. */
  date: string;
  kind: CarLogKind;
  odometerKm: number | null;
  amountCents: number | null;
  /** Litres or kWh. */
  quantity: number | null;
  /** Filled up to the brim: only then the consumption can be calculated. */
  fullTank: boolean;
  /** A fill-up before this one was not entered: the interval up to here is unknown. */
  missedBefore: boolean;
  /** Orders entries of the same day as they were entered. */
  createdAt?: string;
}

export interface CarLogSummary {
  /** Costs within the last 12 months, by kind (only kinds with costs). */
  byKind: { kind: CarLogKind; cents: number }[];
  /** All costs within the last 12 months. */
  yearCents: number;
  /** Months the costs cover, from the first cost within the window: at most twelve, 0 without costs. */
  months: number;
  /** Kilometres between the lowest and highest reading within the last 12 months. */
  yearKm: number | null;
  /** Costs per km – only when the readings span at least half a year, else misleading. */
  centsPerKm: number | null;
  /** Average consumption in l/100 km between full fill-ups, over all entries. */
  fuelPer100Km: number | null;
  /** Fuel costs per 100 km over the same intervals, where every fill-up has an amount. */
  fuelCentsPer100Km: number | null;
  /** Intervals between full fill-ups the consumption is based on. */
  fuelIntervals: number;
}

const dayIndex = (date: string) => {
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year!, month! - 1, day) / 86_400_000;
};

/** The date a year before `today` (YYYY-MM-DD), as the start of the 12-month window. */
export function yearBefore(today: string): string {
  const [year, month, day] = today.split('-').map(Number);
  const date = new Date(Date.UTC(year! - 1, month! - 1, day));
  // 29 February becomes 1 March in a year without it – one day more is fine.
  return date.toISOString().slice(0, 10);
}

/** Readings must span this many days before costs per km are shown. */
const MIN_DAYS_FOR_COST_PER_KM = 180;
/** Longer than any tank range: an interval this long hides a typo or a missed fill-up. */
const MAX_INTERVAL_KM = 2500;
/** Consumption outside this range (l/100 km) is no real figure but a typo. */
const PLAUSIBLE_CONSUMPTION: readonly [number, number] = [1, 40];

/**
 * Consumption from full fill-ups: everything filled after one full fill-up up
 * to and including the next one, divided by the distance between them, as
 * Fuelio and Drivvo do. Partial fill-ups in between count. A fill-up without
 * litres or after a missed one makes the interval up to it unknown; filled
 * up fully with a reading, it starts the next one.
 */
function fuelConsumption(entries: readonly CarLogEntryLike[]) {
  const fills = entries
    .filter((entry) => entry.kind === 'fuel')
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (a.createdAt && b.createdAt ? a.createdAt.localeCompare(b.createdAt) : 0) ||
        (a.odometerKm ?? Number.MAX_SAFE_INTEGER) - (b.odometerKm ?? Number.MAX_SAFE_INTEGER),
    );
  let litres = 0;
  let distance = 0;
  let intervals = 0;
  let costCents = 0;
  let costDistance = 0;
  let lastFullKm: number | null = null;
  let pendingLitres = 0;
  let pendingCents: number | null = 0;
  for (const fill of fills) {
    const restart = fill.missedBefore || fill.quantity === null;
    if (!restart) {
      pendingLitres += fill.quantity!;
      pendingCents =
        pendingCents === null || fill.amountCents === null ? null : pendingCents + fill.amountCents;
      if (!fill.fullTank) continue;
    }
    if (
      !restart &&
      lastFullKm !== null &&
      fill.odometerKm !== null &&
      fill.odometerKm > lastFullKm &&
      fill.odometerKm - lastFullKm <= MAX_INTERVAL_KM
    ) {
      const km = fill.odometerKm - lastFullKm;
      litres += pendingLitres;
      distance += km;
      intervals += 1;
      if (pendingCents !== null) {
        costCents += pendingCents;
        costDistance += km;
      }
    }
    lastFullKm = fill.fullTank ? fill.odometerKm : null;
    pendingLitres = 0;
    pendingCents = 0;
  }
  const per100Km = distance > 0 ? Math.round((litres / distance) * 1000) / 10 : null;
  const plausible =
    per100Km !== null &&
    per100Km >= PLAUSIBLE_CONSUMPTION[0] &&
    per100Km <= PLAUSIBLE_CONSUMPTION[1];
  return {
    per100Km: plausible ? per100Km : null,
    centsPer100Km:
      plausible && costDistance > 0 ? Math.round((costCents / costDistance) * 100) : null,
    intervals: plausible ? intervals : 0,
  };
}

/** Figures for the cost book; `today` is the owner's date (YYYY-MM-DD). */
export function carLogSummary(entries: readonly CarLogEntryLike[], today: string): CarLogSummary {
  const from = yearBefore(today);
  const recent = entries.filter((entry) => entry.date > from && entry.date <= today);
  const totals = new Map<CarLogKind, number>();
  let firstCost: string | null = null;
  for (const entry of recent)
    if (entry.amountCents) {
      totals.set(entry.kind, (totals.get(entry.kind) ?? 0) + entry.amountCents);
      if (firstCost === null || entry.date < firstCost) firstCost = entry.date;
    }
  const byKind = [...totals.entries()]
    .map(([kind, cents]) => ({ kind, cents }))
    .sort((a, b) => b.cents - a.cents);
  const yearCents = byKind.reduce((sum, item) => sum + item.cents, 0);

  // Whole months since the first cost within the window, at least one and at most twelve;
  // an old service entered later does not stretch the period.
  const months =
    firstCost === null
      ? 0
      : Math.min(12, Math.max(1, Math.ceil((dayIndex(today) - dayIndex(firstCost) + 1) / 30.4375)));

  const readings = recent.filter(
    (entry): entry is CarLogEntryLike & { odometerKm: number } => entry.odometerKm !== null,
  );
  const kms = readings.map((entry) => entry.odometerKm);
  const yearKm = kms.length >= 2 ? Math.max(...kms) - Math.min(...kms) || null : null;
  const dates = readings.map((entry) => dayIndex(entry.date));
  const span = dates.length >= 2 ? Math.max(...dates) - Math.min(...dates) : 0;
  const centsPerKm =
    yearKm !== null && span >= MIN_DAYS_FOR_COST_PER_KM && yearCents > 0
      ? Math.round(yearCents / yearKm)
      : null;

  const fuel = fuelConsumption(entries);
  return {
    byKind,
    yearCents,
    months,
    yearKm,
    centsPerKm,
    fuelPer100Km: fuel.per100Km,
    fuelCentsPer100Km: fuel.centsPer100Km,
    fuelIntervals: fuel.intervals,
  };
}

const csvCell = (value: string) => {
  // Formula characters at the start would run in a spreadsheet (CSV injection).
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[";\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
};

export interface CarLogCsvEntry extends CarLogEntryLike {
  workshop: string | null;
  note: string | null;
  invoice: boolean;
}

/** All entries as CSV for a spreadsheet in German format (semicolon, decimal comma). */
export function carLogCsv(entries: readonly CarLogCsvEntry[]): string {
  const decimal = (value: number) => String(value).replace('.', ',');
  const euros = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');
  const rows = [
    [
      'Datum',
      'Art',
      'Kilometerstand',
      'Betrag in Euro',
      'Menge',
      'Einheit',
      'Vollgetankt',
      'Vorige Tankung fehlt',
      'Werkstatt',
      'Notiz',
      'Rechnung vorhanden',
    ],
    ...[...entries]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((entry) => [
        entry.date,
        CAR_LOG_KIND_LABELS[entry.kind],
        entry.odometerKm === null ? '' : String(entry.odometerKm),
        entry.amountCents === null ? '' : euros(entry.amountCents),
        entry.quantity === null ? '' : decimal(entry.quantity),
        QUANTITY_UNITS[entry.kind] ?? '',
        entry.kind === 'fuel' ? (entry.fullTank ? 'ja' : 'nein') : '',
        entry.kind === 'fuel' && entry.missedBefore ? 'ja' : '',
        entry.workshop ?? '',
        entry.note ?? '',
        entry.invoice ? 'ja' : 'nein',
      ]),
  ];
  // A byte order mark lets spreadsheets read the umlauts as UTF-8.
  return `\ufeff${rows.map((row) => row.map(csvCell).join(';')).join('\r\n')}\r\n`;
}

/**
 * An amount in euros as typed in Germany – „72,45“, „1.234,50“, „1234“ – or
 * „72.45“; returns cents, or null when it is not an amount.
 */
export function parseEuroCents(value: string): number | null {
  const text = value
    .trim()
    .replace(/\s*(€|eur|euro)$/i, '')
    .replace(/[\s\u00a0\u202f]/g, '');
  let normalized: string;
  if (/^\d{1,3}(\.\d{3})*(,\d{1,2})?$/.test(text) || /^\d+(,\d{1,2})?$/.test(text))
    normalized = text.replaceAll('.', '').replace(',', '.');
  else if (/^\d+\.\d{1,2}$/.test(text)) normalized = text;
  else return null;
  const cents = Math.round(Number(normalized) * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

/** A quantity with up to two decimals, „41,4“ or „41.4“; null when it is none. */
export function parseQuantity(value: string): number | null {
  const text = value.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const number = Number(text);
  return number > 0 ? number : null;
}
