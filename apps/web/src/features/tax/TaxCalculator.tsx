import {
  vehicleTax,
  type TaxDrive,
  type TaxEmissionClass,
  type VehicleTaxField,
  type VehicleTaxResult,
} from '@kaufcheck/shared';
import { engineTaxDrive, type EngineRecord } from '@kaufcheck/catalog/engines';
import { useState } from 'react';
import { SelectField, TextField } from '../../components/ui/Field';
import type { TaxFormValues } from './form';
import { toNumber } from './numbers';
import { EnginePicker } from './EnginePicker';
import {
  engineKey,
  enginesOfYear,
  engineValues,
  engineYear,
  findIndexModel,
  NO_PICK,
  useEngineIndex,
  useModelEngines,
  type EnginePick,
} from './engines';
import { RunningCosts, type ConsumptionSuggestion } from './RunningCosts';

const DRIVES: readonly { value: TaxDrive; label: string }[] = [
  { value: 'petrol', label: 'Benzin, auch Hybrid, Autogas (LPG) oder Erdgas (CNG)' },
  { value: 'diesel', label: 'Diesel, auch Diesel-Hybrid' },
  { value: 'electric', label: 'Elektro, auch Brennstoffzelle (Wasserstoff)' },
];

const EMISSION_CLASSES: readonly { value: TaxEmissionClass; label: string }[] = [
  { value: 'euro3', label: 'Euro 3 oder besser – auch Euro 4/II, Euro 4/III, D3, D4, „3 L“' },
  { value: 'euro2', label: 'Euro 2 – auch Euro 3/II oder Euro 3/III (ohne D4)' },
  { value: 'euro1', label: 'Euro 1 – auch Euro 2/II, Euro 2/III und „E 2“ ohne „3 L“' },
  {
    value: 'ozoneExempt',
    label:
      'nicht schadstoffarm, ozonbefreit (Schlüsselnummer 17, 19, 20, 23, 24 oder 10/15 mit G-Kat-Nachrüstung)',
  },
  { value: 'older', label: 'älter oder unbekannt (höchster Satz)' },
];

const FIELD_LABELS: Record<VehicleTaxField, string> = {
  firstRegistration: 'Erstzulassung',
  displacementCcm: 'Hubraum',
  co2GPerKm: 'CO₂-Wert',
  emissionClass: 'Schadstoffklasse',
  grossWeightKg: 'zulässiges Gesamtgewicht',
};

const euros = (value: number, fractions = 0) =>
  value.toLocaleString('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: fractions,
    maximumFractionDigits: fractions,
  });
const day = (iso: string) => iso.split('-').reverse().join('.');

const BINDING = 'Verbindlich ist der Steuerbescheid des Hauptzollamts.';

function todayIso(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function Result({ result }: { result: VehicleTaxResult }) {
  if (result.kind === 'invalid') {
    return <p className="tax-result__hint">Bitte prüfe die markierte Angabe.</p>;
  }
  if (result.kind === 'missing') {
    return (
      <p className="tax-result__hint">
        {result.note ? `${result.note} ` : ''}
        Noch nötig: {result.fields.map((field) => FIELD_LABELS[field]).join(', ')}.
      </p>
    );
  }
  if (result.kind === 'exempt') {
    return (
      <>
        <p className="tax-result__amount">0 € – steuerfrei bis {day(result.until)}</p>
        <p>
          {result.afterwardsEur === null
            ? 'Danach richtet sich die Steuer nach dem zulässigen Gesamtgewicht.'
            : `Danach voraussichtlich ${euros(result.afterwardsEur)} im Jahr.`}
        </p>
        <p className="tax-result__rule">
          {result.rule} {BINDING}
        </p>
      </>
    );
  }
  return (
    <>
      <p className="tax-result__amount">
        voraussichtlich {euros(result.annualEur)} <span>im Jahr</span>
      </p>
      <p className="tax-result__monthly">
        das sind rund {euros(result.annualEur / 12, 2)} im Monat
      </p>
      <ul className="tax-result__parts">
        {result.parts.map((part) => (
          <li key={part.label}>
            <span>{part.label}</span>
            <span className="tax-result__value">{euros(part.amountEur, 2)}</span>
          </li>
        ))}
      </ul>
      <p className="tax-result__rule">
        {result.rule} Der Jahresbetrag wird auf volle Euro abgerundet (§ 11 Abs. 5 KraftStG).{' '}
        {BINDING}
      </p>
    </>
  );
}

/**
 * Kfz-Steuer from the values in the vehicle registration certificate. Computed
 * in the browser after the Kraftfahrzeugsteuergesetz; nothing is sent.
 */
export function TaxCalculator({
  initial,
  listingRegistration = null,
  listingModel = null,
}: {
  initial: TaxFormValues;
  /** First registration as the listing states it (month/year), as a hint for the date. */
  listingRegistration?: string | null;
  /** Make and model (id or name) and power from a check, to preselect the engine. */
  listingModel?: { makeId: string; model: string; kw: number | null } | null;
}) {
  const [values, setValues] = useState(initial);
  const set = (key: keyof TaxFormValues) => (event: { target: { value: string } }) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  const index = useEngineIndex();
  const [pick, setPick] = useState<EnginePick>(NO_PICK);
  const engines = useModelEngines(pick.modelId);
  const [suggestion, setSuggestion] = useState<ConsumptionSuggestion | null>(null);
  const applyEngine = (engine: EngineRecord | null, firstRegistration: string) => {
    if (!engine || !index.data) {
      setSuggestion(null);
      return;
    }
    const engineFields = engineValues(engine, firstRegistration, index.data);
    setValues((current) => ({
      ...current,
      drive: engineFields.drive,
      displacementCcm: engineFields.displacementCcm,
      co2GPerKm: engineFields.co2GPerKm,
    }));
    setSuggestion(engineFields.consumption);
  };
  const choose = (next: EnginePick, engine: EngineRecord | null) => {
    setPick(next);
    applyEngine(engine, values.firstRegistration);
  };

  // A check names the model: it is preselected once the index is there, and the engine once
  // there is a single one with the listed power in the year of the first registration.
  const [pending, setPending] = useState(listingModel);
  if (pending && index.data && !pick.modelId) {
    const found = findIndexModel(index.data, pending.makeId, pending.model);
    if (found) setPick({ ...found, engineKey: '' });
    if (!found || pending.kw === null) setPending(null);
  }
  if (pending && pick.modelId && engines.data && values.firstRegistration) {
    setPending(null);
    const year = engineYear(engines.data.engines, values.firstRegistration);
    const matching =
      year === null
        ? []
        : enginesOfYear(engines.data.engines, year).filter((engine) => engine.kw === pending.kw);
    const fitting = matching.filter(
      (engine) => !values.drive || engineTaxDrive(engine.fuel) === values.drive,
    );
    if (fitting.length === 1) {
      setPick({ ...pick, engineKey: engineKey(fitting[0]!) });
      applyEngine(fitting[0]!, values.firstRegistration);
    }
  }

  const before2009 = values.firstRegistration !== '' && values.firstRegistration < '2009-07-01';
  const electric = values.drive === 'electric';
  const ready = values.firstRegistration !== '' && values.drive !== '';
  const today = todayIso();
  const result = ready
    ? vehicleTax(
        {
          firstRegistration: values.firstRegistration,
          drive: values.drive as TaxDrive,
          displacementCcm: toNumber(values.displacementCcm),
          co2GPerKm: toNumber(values.co2GPerKm),
          emissionClass: values.emissionClass || null,
          grossWeightKg: toNumber(values.grossWeightKg),
        },
        today,
      )
    : null;
  const errorFor = (field: VehicleTaxField) =>
    result?.kind === 'invalid' && result.field === field ? result.message : undefined;

  // An exemption that ends within a year: the running costs use the tax afterwards.
  const nextYear = `${Number(today.slice(0, 4)) + 1}${today.slice(4)}`;
  const endsSoon = result?.kind === 'exempt' && result.until < nextYear;
  const taxAnnualEur =
    result?.kind === 'amount'
      ? result.annualEur
      : result?.kind === 'exempt'
        ? endsSoon
          ? result.afterwardsEur
          : 0
        : null;
  let taxNote: string | null = null;
  if (result?.kind === 'exempt') {
    const until = `Kfz-Steuer: steuerfrei bis ${day(result.until)}`;
    if (result.afterwardsEur === null) {
      taxNote = `${until}, danach richtet sie sich nach dem zulässigen Gesamtgewicht – gib es oben an, dann ist sie eingerechnet.`;
    } else if (endsSoon) {
      taxNote = `${until}; eingerechnet sind schon die ${euros(result.afterwardsEur)} im Jahr danach.`;
    } else {
      taxNote = `${until}, danach voraussichtlich ${euros(result.afterwardsEur)} im Jahr.`;
    }
  }

  return (
    <>
      <div className="tax-calculator">
        <form className="tax-form" onSubmit={(event) => event.preventDefault()} noValidate>
          <TextField
            label="Erstzulassung"
            type="date"
            hint={
              listingRegistration
                ? `Laut Inserat ${listingRegistration} – den Tag findest du im Fahrzeugschein, Feld B`
                : 'Fahrzeugschein, Feld B'
            }
            error={errorFor('firstRegistration')}
            value={values.firstRegistration}
            onChange={set('firstRegistration')}
          />
          <EnginePicker
            index={index.data}
            engines={engines.data?.engines}
            firstRegistration={values.firstRegistration}
            value={pick}
            onChange={choose}
          />
          <SelectField label="Antrieb" value={values.drive} onChange={set('drive')}>
            <option value="">Bitte wählen</option>
            {DRIVES.map((drive) => (
              <option key={drive.value} value={drive.value}>
                {drive.label}
              </option>
            ))}
          </SelectField>
          {electric ? (
            <TextField
              label="Zulässiges Gesamtgewicht in kg"
              hint="Fahrzeugschein, Feld F.2 – nur nötig, wenn die Steuerbefreiung endet"
              inputMode="numeric"
              error={errorFor('grossWeightKg')}
              value={values.grossWeightKg}
              onChange={set('grossWeightKg')}
            />
          ) : (
            <>
              <TextField
                label="Hubraum in cm³"
                hint="Fahrzeugschein, Feld P.1"
                inputMode="numeric"
                error={errorFor('displacementCcm')}
                value={values.displacementCcm}
                onChange={set('displacementCcm')}
              />
              <TextField
                label="CO₂-Wert in g/km"
                hint={
                  before2009
                    ? 'Fahrzeugschein, Feld V.7 – bei Erstzulassung vor Juli 2009 nur für Autos ab 05.11.2008 nötig'
                    : 'Fahrzeugschein, Feld V.7'
                }
                inputMode="numeric"
                error={errorFor('co2GPerKm')}
                value={values.co2GPerKm}
                onChange={set('co2GPerKm')}
              />
              {before2009 && (
                <SelectField
                  label="Schadstoffklasse"
                  hint="Fahrzeugschein, Feld 14 und Schlüsselnummer 14.1 (alter Fahrzeugschein: letzte zwei Ziffern im Feld „zu 1“). „/II“ und „/III“ stehen für schwere Pkw über 2,5 t – die Auswahl nennt, wie sie zählen."
                  value={values.emissionClass}
                  onChange={set('emissionClass')}
                >
                  <option value="">Bitte wählen</option>
                  {EMISSION_CLASSES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </SelectField>
              )}
            </>
          )}
        </form>
        <section className="tax-result" aria-labelledby="tax-result-title">
          <h3 id="tax-result-title" className="tax-result__title">
            Kfz-Steuer
          </h3>
          <div aria-live="polite">
            {result ? (
              <Result result={result} />
            ) : (
              <p className="tax-result__hint">Gib Erstzulassung und Antrieb an.</p>
            )}
          </div>
        </section>
      </div>
      <p>
        Fehlt dir ein Wert, frag den Verkäufer nach einem Foto des Fahrzeugscheins – darauf stehen
        alle Angaben.
      </p>
      <h2 id="unterhalt">Laufende Kosten überschlagen</h2>
      <p>
        Mit deiner Fahrleistung, dem Verbrauch und deinen Preisen rechnest du grob aus, was das Auto
        im Monat kostet. Die Kfz-Steuer von oben ist schon eingerechnet.
      </p>
      <RunningCosts
        taxAnnualEur={taxAnnualEur}
        taxNote={taxNote}
        electric={electric}
        suggestion={suggestion}
      />
    </>
  );
}
