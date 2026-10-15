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

/** Control characters from pasted text become spaces; the server rejects them. */
const withoutControl = (value: string, keepNewline: boolean) =>
  [...value]
    .map((char) => {
      const code = char.charCodeAt(0);
      return (code < 32 && !(keepNewline && char === '\n')) || code === 127 ? ' ' : char;
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
      workshop: workshop || null,
      note: note || null,
      invoice: values.invoice,
    },
  };
}
