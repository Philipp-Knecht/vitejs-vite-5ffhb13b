import {
  CAR_LOG_KIND_LABELS,
  CAR_LOG_KINDS,
  QUANTITY_UNITS,
  type CarLogEntryInput,
  type CarLogKind,
} from '@kaufcheck/shared';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { SelectField, TextAreaField, TextField } from '../../components/ui/Field';
import {
  inputFromForm,
  WORKSHOP_KINDS,
  type EntryFormField,
  type EntryFormValues,
} from './entry-form';

export interface EntryFormError {
  field: EntryFormField | null;
  message: string;
}

/** Adds or changes one entry of the cost book. */
export function EntryForm({
  initial,
  today,
  submitLabel,
  busy,
  serverError,
  onSubmit,
  onCancel,
}: {
  initial: EntryFormValues;
  today: string;
  submitLabel: string;
  busy: boolean;
  serverError: EntryFormError | null;
  onSubmit: (input: CarLogEntryInput) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<EntryFormError | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const shown = error ?? serverError;
  const unit = QUANTITY_UNITS[values.kind];

  // A new error moves the focus to its field, or to the message.
  useEffect(() => {
    if (!shown) return;
    const target =
      form.current?.querySelector<HTMLElement>('[aria-invalid="true"]') ??
      form.current?.querySelector<HTMLElement>('[role="alert"]');
    target?.focus();
  }, [shown]);

  const set =
    <K extends keyof EntryFormValues>(key: K) =>
    (value: EntryFormValues[K]) => {
      setError(null);
      setValues((current) => ({ ...current, [key]: value }));
    };
  const errorFor = (field: EntryFormField) => (shown?.field === field ? shown.message : undefined);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = inputFromForm(values, today);
    if ('field' in result) {
      setError({ field: result.field, message: result.message });
      return;
    }
    onSubmit(result.input);
  };

  return (
    <form ref={form} className="car-log__form" onSubmit={submit} noValidate>
      <div className="sale-contract__grid">
        <SelectField
          label="Art"
          value={values.kind}
          onChange={(event) => set('kind')(event.target.value as CarLogKind)}
        >
          {CAR_LOG_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {CAR_LOG_KIND_LABELS[kind]}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Datum"
          type="date"
          max={today}
          value={values.date}
          onChange={(event) => set('date')(event.target.value)}
          error={errorFor('date')}
        />
        <TextField
          label="Kilometerstand"
          hint="Laut Tacho, freiwillig"
          inputMode="numeric"
          maxLength={9}
          value={values.odometerKm}
          onChange={(event) => set('odometerKm')(event.target.value)}
          error={errorFor('odometerKm')}
        />
        <TextField
          label="Betrag in Euro"
          hint="Leer lassen, wenn nichts angefallen ist"
          inputMode="decimal"
          maxLength={14}
          value={values.amount}
          onChange={(event) => set('amount')(event.target.value)}
          error={errorFor('amount')}
        />
        {unit && (
          <TextField
            label={unit === 'l' ? 'Menge in Litern' : 'Geladene kWh'}
            inputMode="decimal"
            maxLength={9}
            value={values.quantity}
            onChange={(event) => set('quantity')(event.target.value)}
            error={errorFor('quantity')}
          />
        )}
        {WORKSHOP_KINDS.has(values.kind) && (
          <TextField
            label="Werkstatt"
            maxLength={100}
            value={values.workshop}
            onChange={(event) => set('workshop')(event.target.value)}
            error={errorFor('workshop')}
          />
        )}
      </div>
      {values.kind === 'fuel' && (
        <label className="consent">
          <input
            type="checkbox"
            className="checkbox"
            checked={values.fullTank}
            onChange={(event) => set('fullTank')(event.target.checked)}
          />
          <span>
            Vollgetankt – nur dann kann KaufCheck den Verbrauch bis zur nächsten vollen Tankung
            berechnen
          </span>
        </label>
      )}
      <TextAreaField
        label={WORKSHOP_KINDS.has(values.kind) ? 'Was wurde gemacht?' : 'Notiz'}
        hint={
          WORKSHOP_KINDS.has(values.kind)
            ? 'Zum Beispiel „Inspektion mit Ölwechsel, Bremsflüssigkeit gewechselt“'
            : undefined
        }
        rows={2}
        maxLength={500}
        value={values.note}
        onChange={(event) => set('note')(event.target.value)}
        error={errorFor('note')}
      />
      <label className="consent">
        <input
          type="checkbox"
          className="checkbox"
          checked={values.invoice}
          onChange={(event) => set('invoice')(event.target.checked)}
        />
        <span>Rechnung oder Beleg liegt vor</span>
      </label>
      {shown && shown.field === null && <Alert tone="error" title={shown.message} />}
      <div className="button-row">
        <Button type="submit" loading={busy}>
          {submitLabel}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Abbrechen
        </Button>
      </div>
    </form>
  );
}
