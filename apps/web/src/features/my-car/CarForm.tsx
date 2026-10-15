import { FUEL_LABELS, FUEL_TYPES, type FuelType, type OwnedCarInput } from '@kaufcheck/shared';
import { generationYearsLabel, MAKES, modelsOfMake } from '@kaufcheck/catalog';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Button } from '../../components/ui/Button';
import { SelectField, TextField } from '../../components/ui/Field';
import {
  GENERATIONS,
  inputFromForm,
  OTHER_MODEL,
  type CarFormError,
  type CarFormField,
  type CarFormValues,
} from './car';

const MONTHS = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
];

const MAKE_OPTIONS = [...MAKES].sort((a, b) => a.name.localeCompare(b.name, 'de'));

function MonthOptions({ placeholder }: { placeholder: string }) {
  return (
    <>
      <option value="">{placeholder}</option>
      {MONTHS.map((name, index) => (
        <option key={name} value={index + 1}>
          {name}
        </option>
      ))}
    </>
  );
}

/** Add or edit a car. Server errors (e.g. a date in the future) come back as `serverError`. */
export function CarForm({
  initial,
  submitLabel,
  busy,
  serverError,
  onSubmit,
  onCancel,
}: {
  initial: CarFormValues;
  submitLabel: string;
  busy: boolean;
  serverError: CarFormError | null;
  onSubmit: (input: OwnedCarInput) => void;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState(initial);
  const [clientError, setClientError] = useState<CarFormError | null>(null);
  const error = clientError ?? serverError;
  const form = useRef<HTMLFormElement>(null);
  const registrationHint = useId();
  const huHint = useId();
  // A new error moves the focus to its field, so that it is announced.
  // Separate effects: clearing one error must not refocus the other, older one.
  const focusInvalidField = () =>
    form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  useEffect(() => {
    if (clientError?.field) focusInvalidField();
  }, [clientError]);
  useEffect(() => {
    if (serverError?.field && !clientError) focusInvalidField();
    // Only a new server error moves the focus, not a cleared client error.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverError]);
  const set = (key: keyof CarFormValues) => (event: { target: { value: string } }) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  const models = modelsOfMake(values.makeId);
  const generations =
    values.modelId && values.modelId !== OTHER_MODEL ? (GENERATIONS.get(values.modelId) ?? []) : [];
  const errorFor = (field: CarFormField) => (error?.field === field ? error.message : undefined);

  const chooseMake = (event: { target: { value: string } }) =>
    setValues((current) => ({
      ...current,
      makeId: event.target.value,
      modelId: '',
      modelName: '',
      generationId: '',
    }));

  const chooseModel = (event: { target: { value: string } }) => {
    const modelId = event.target.value;
    const model = models.find((item) => item.id === modelId);
    setValues((current) => ({
      ...current,
      modelId,
      modelName: model?.model ?? '',
      generationId: '',
    }));
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = inputFromForm(values, new Date());
    if ('field' in result) {
      setClientError(result);
      return;
    }
    setClientError(null);
    onSubmit(result.input);
  };

  return (
    <form ref={form} className="car-form" onSubmit={submit} noValidate>
      <p className="field__hint">Pflichtangaben: Marke, Modell und Jahr der Erstzulassung.</p>
      <div className="car-form__grid">
        <SelectField
          label="Marke"
          required
          value={values.makeId}
          onChange={chooseMake}
          error={errorFor('makeId')}
        >
          <option value="">Bitte wählen</option>
          {MAKE_OPTIONS.map((make) => (
            <option key={make.id} value={make.id}>
              {make.name}
            </option>
          ))}
        </SelectField>
        {values.makeId && (
          <SelectField
            label="Modell"
            required
            value={values.modelId}
            onChange={chooseModel}
            error={values.modelId === OTHER_MODEL ? undefined : errorFor('modelName')}
          >
            <option value="">Bitte wählen</option>
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.model}
              </option>
            ))}
            <option value={OTHER_MODEL}>Anderes Modell</option>
          </SelectField>
        )}
        {values.modelId === OTHER_MODEL && (
          <TextField
            label="Modellbezeichnung"
            required
            maxLength={60}
            value={values.modelName}
            onChange={set('modelName')}
            error={errorFor('modelName')}
          />
        )}
        {generations.length > 0 && (
          <SelectField
            label="Generation"
            hint="Für die bekannten Schwachstellen; ohne Angabe passend zur Erstzulassung"
            value={values.generationId}
            onChange={set('generationId')}
            error={errorFor('generation')}
          >
            <option value="">Passend zur Erstzulassung</option>
            {generations.map((generation) => (
              <option key={generation.id} value={generation.id}>
                {generation.name} ({generationYearsLabel(generation.years)})
              </option>
            ))}
          </SelectField>
        )}
        <SelectField label="Kraftstoff" value={values.fuel} onChange={set('fuel')}>
          <option value="">Keine Angabe</option>
          {FUEL_TYPES.map((fuel: FuelType) => (
            <option key={fuel} value={fuel}>
              {FUEL_LABELS[fuel]}
            </option>
          ))}
        </SelectField>
      </div>

      <fieldset className="car-form__pair" aria-describedby={registrationHint}>
        <legend>Erstzulassung</legend>
        <p className="field__hint" id={registrationHint}>
          Fahrzeugschein, Feld B
        </p>
        <div className="car-form__pair-fields">
          <SelectField
            label="Monat"
            value={values.registrationMonth}
            onChange={set('registrationMonth')}
          >
            <MonthOptions placeholder="Monat" />
          </SelectField>
          <TextField
            label="Jahr"
            required
            inputMode="numeric"
            maxLength={4}
            value={values.registrationYear}
            onChange={set('registrationYear')}
            error={errorFor('registration')}
          />
        </div>
      </fieldset>

      <fieldset className="car-form__pair" aria-describedby={huHint}>
        <legend>Nächste HU</legend>
        <p className="field__hint" id={huHint}>
          Monat und Jahr auf der Prüfplakette am hinteren Kennzeichen oder im Fahrzeugschein
        </p>
        <div className="car-form__pair-fields">
          <SelectField label="Monat" value={values.huMonth} onChange={set('huMonth')}>
            <MonthOptions placeholder="Monat" />
          </SelectField>
          <TextField
            label="Jahr"
            inputMode="numeric"
            maxLength={4}
            value={values.huYear}
            onChange={set('huYear')}
            error={errorFor('hu')}
          />
        </div>
      </fieldset>

      <div className="car-form__grid">
        <TextField
          label="Kilometerstand"
          inputMode="numeric"
          value={values.mileageKm}
          onChange={set('mileageKm')}
          error={errorFor('mileageKm')}
        />
        <TextField
          label="Name"
          hint="Optional, zum Beispiel „Familienauto“"
          error={errorFor('nickname')}
          maxLength={60}
          value={values.nickname}
          onChange={set('nickname')}
        />
      </div>

      <div>
        {/* Errors without a field (e.g. the plan limit); field errors sit at their field. */}
        <p className="field__error" role="alert">
          {error && !error.field ? error.message : null}
        </p>
        <div className="button-row">
          <Button type="submit" loading={busy}>
            {submitLabel}
          </Button>
          {onCancel && (
            <Button variant="secondary" onClick={onCancel}>
              Abbrechen
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
