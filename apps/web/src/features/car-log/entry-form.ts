import {
  parseEuroCents,
  parseQuantity,
  QUANTITY_UNITS,
  type CarLogEntryDto,
  type CarLogEntryInput,
  type CarLogKind,
} from '@kaufcheck/shared';

/** Form state: everything as typed. */
export interface EntryFormValues {
  kind: CarLogKind;
  date: string;
  odometerKm: string;
  amount: string;
  quantity: string;
  fullTank: boolean;
  missedBefore: boolean;
  workshop: string;
  note: string;
  invoice: boolean;
}

export type EntryFormField =
  'kind' | 'date' | 'odometerKm' | 'amount' | 'quantity' | 'workshop' | 'note';

/** Today on this device, as YYYY-MM-DD. */
export function localDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export const emptyEntry = (today: string, kind: CarLogKind = 'fuel'): EntryFormValues => ({
  kind,
  date: today,
  odometerKm: '',
  amount: '',
  quantity: '',
  fullTank: true,
  missedBefore: false,
  workshop: '',
  note: '',
  invoice: false,
});

const decimal = (value: number) =>
  value.toLocaleString('de-DE', { maximumFractionDigits: 2, useGrouping: false });

export function formFromEntry(entry: CarLogEntryDto): EntryFormValues {
  return {
    kind: entry.kind,
    date: entry.date,
    odometerKm: entry.odometerKm === null ? '' : String(entry.odometerKm),
    amount: entry.amountCents === null ? '' : decimal(entry.amountCents / 100),
    quantity: entry.quantity === null ? '' : decimal(entry.quantity),
    fullTank: entry.kind === 'fuel' ? entry.fullTank : true,
    missedBefore: entry.missedBefore,
    workshop: entry.workshop ?? '',
    note: entry.note ?? '',
    invoice: entry.invoice,
  };
}

/** Kinds where a workshop is usual. */
export const WORKSHOP_KINDS: ReadonlySet<CarLogKind> = new Set([
  'service',
  'repair',
  'tyres',
  'inspection',
]);

/** Control characters and direction marks from pasted text go; the server rejects them. */
const withoutControl = (value: string, keepNewline: boolean) =>
  [...value]
    .map((char) => {
      const code = char.charCodeAt(0);
      if ((code >= 0x202a && code <= 0x202e) || (code >= 0x2066 && code <= 0x2069)) return '';
      return (code < 32 && !(keepNewline && char === '\n')) || (code >= 127 && code <= 159)
        ? ' '
        : char;
    })
    .join('');

/** The request body, or the first field to fix. */
export function inputFromForm(
  values: EntryFormValues,
  today: string,
): { input: CarLogEntryInput } | { field: EntryFormField; message: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.date) || values.date < '1950-01-01')
    return { field: 'date', message: 'Bitte gib ein gültiges Datum an.' };
  if (values.date > today) return { field: 'date', message: 'Das Datum liegt in der Zukunft.' };

  let odometerKm: number | null = null;
  if (values.odometerKm.trim()) {
    const compact = values.odometerKm.replace(/[\s.]/g, '');
    odometerKm = /^\d+$/.test(compact) ? Number(compact) : NaN;
    if (!Number.isInteger(odometerKm) || odometerKm > 2_000_000)
      return { field: 'odometerKm', message: 'Bitte gib den Kilometerstand als ganze Zahl an.' };
  }

  let amountCents: number | null = null;
  if (values.amount.trim()) {
    amountCents = parseEuroCents(values.amount);
    if (amountCents === null || amountCents > 100_000_000)
      return { field: 'amount', message: 'Bitte gib den Betrag in Euro an, zum Beispiel 72,45.' };
  }

  const unit = QUANTITY_UNITS[values.kind];
  let quantity: number | null = null;
  if (unit && values.quantity.trim()) {
    quantity = parseQuantity(values.quantity);
    if (quantity === null || quantity > 10_000)
      return {
        field: 'quantity',
        message: `Bitte gib die Menge in ${unit === 'l' ? 'Litern' : 'kWh'} an, höchstens mit zwei Nachkommastellen.`,
      };
  }

  const workshop = withoutControl(values.workshop, false).trim().replace(/\s+/g, ' ');
  if (workshop.length > 100) return { field: 'workshop', message: 'Bitte höchstens 100 Zeichen.' };
  const note = withoutControl(values.note.replace(/\r\n?/g, '\n'), true)
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (note.length > 500) return { field: 'note', message: 'Bitte höchstens 500 Zeichen.' };

  return {
    input: {
      date: values.date,
      kind: values.kind,
      odometerKm,
      amountCents,
      quantity,
      fullTank: values.kind === 'fuel' && values.fullTank,
      missedBefore: values.kind === 'fuel' && values.missedBefore,
      // A workshop typed for another kind is not saved when the kind changes.
      workshop: WORKSHOP_KINDS.has(values.kind) ? workshop || null : null,
      note: note || null,
      invoice: values.invoice,
    },
  };
}

const germanDate = (date: string) => date.split('-').reverse().join('.');

/**
 * Readings and dates that do not fit the other entries or the car: shown as a
 * warning before saving, as a typo would look like tampering in the service
 * history. A swapped odometer can explain them, so they do not block.
 */
export function plausibilityWarnings(
  input: CarLogEntryInput,
  others: readonly CarLogEntryDto[],
  firstRegistration: { year: number; month: number | null },
): string[] {
  const warnings: string[] = [];
  const registration = `${firstRegistration.year}-${String(firstRegistration.month ?? 1).padStart(2, '0')}`;
  if (input.date.slice(0, 7) < registration)
    warnings.push('Das Datum liegt vor der Erstzulassung des Autos.');
  if (input.quantity !== null && input.quantity > 150)
    warnings.push(
      `${input.quantity.toLocaleString('de-DE')} ${input.kind === 'charging' ? 'kWh' : 'Liter'} sind mehr, als in einen Tank oder eine Batterie passt.`,
    );
  if (input.odometerKm !== null) {
    const km = input.odometerKm;
    // Only the neighbouring readings: a confirmed tacho swap further back does not warn again.
    const readings = others
      .filter((entry) => entry.odometerKm !== null)
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
    const before = readings.filter((entry) => entry.date <= input.date).at(-1);
    const after = readings.find((entry) => entry.date > input.date);
    const higherBefore = before && before.odometerKm! > km ? before : undefined;
    const lowerAfter = after && after.odometerKm! < km ? after : undefined;
    if (higherBefore)
      warnings.push(
        `Am ${germanDate(higherBefore.date)} hast du schon ${higherBefore.odometerKm!.toLocaleString('de-DE')} km eingetragen – mehr als jetzt.`,
      );
    else if (lowerAfter)
      warnings.push(
        `Am ${germanDate(lowerAfter.date)} hast du später nur ${lowerAfter.odometerKm!.toLocaleString('de-DE')} km eingetragen.`,
      );
  }
  return warnings;
}

/** The latest reading in the book, as a hint for the next one. */
export function lastReading(entries: readonly CarLogEntryDto[]): CarLogEntryDto | null {
  return entries.reduce<CarLogEntryDto | null>(
    (latest, entry) =>
      entry.odometerKm !== null &&
      (latest === null ||
        entry.date > latest.date ||
        (entry.date === latest.date && entry.odometerKm > latest.odometerKm!))
        ? entry
        : latest,
    null,
  );
}
