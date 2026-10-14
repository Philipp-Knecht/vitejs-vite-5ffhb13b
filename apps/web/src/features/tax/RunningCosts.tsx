import { useState } from 'react';
import { TextField } from '../../components/ui/Field';
import { toDecimal, toNumber } from './numbers';

interface CostValues {
  kmPerYear: string;
  consumption: string;
  price: string;
  insurance: string;
  maintenance: string;
}

const EMPTY: CostValues = {
  kmPerYear: '',
  consumption: '',
  price: '',
  insurance: '',
  maintenance: '',
};

const euros = (value: number, fractions = 0) =>
  value.toLocaleString('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: fractions,
    maximumFractionDigits: fractions,
  });

interface Parsed {
  value: number | null;
  error?: string;
}

/** A typed value checked against a plausible upper limit; empty means „not given“. */
function parse(
  raw: string,
  read: (value: string) => number | null,
  max: number,
  tooHigh: string,
): Parsed {
  if (raw.trim() === '') return { value: null };
  const value = read(raw);
  if (value === null) return { value: null, error: 'Bitte nur eine Zahl eingeben.' };
  if (value > max) return { value: null, error: tooHigh };
  return { value };
}

/**
 * Rough running costs from the buyer's own figures: tax (from the calculator
 * above), energy, insurance and a reserve for workshop costs. KaufCheck has no
 * price data of its own, so nothing is prefilled with assumed values.
 */
export function RunningCosts({
  taxAnnualEur,
  taxNote = null,
  electric,
}: {
  /** Annual Kfz-Steuer from the calculator; `null` while it is unknown. */
  taxAnnualEur: number | null;
  /** E.g. when a tax exemption ends. */
  taxNote?: string | null;
  electric: boolean;
}) {
  const [values, setValues] = useState(EMPTY);
  const set = (key: keyof CostValues) => (event: { target: { value: string } }) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));
  // Consumption and price change their unit with the drive, so they start empty again.
  const [unitsElectric, setUnitsElectric] = useState(electric);
  if (unitsElectric !== electric) {
    setUnitsElectric(electric);
    setValues((current) => ({ ...current, consumption: '', price: '' }));
  }

  const km = parse(values.kmPerYear, toNumber, 300_000, 'Bitte prüfe die Fahrleistung.');
  const consumption = parse(
    values.consumption,
    toDecimal,
    electric ? 100 : 50,
    'Bitte prüfe den Verbrauch.',
  );
  const price = parse(
    values.price,
    toDecimal,
    electric ? 2 : 5,
    electric
      ? 'Bitte prüfe den Preis je kWh, z. B. 0,35.'
      : 'Bitte prüfe den Preis je Liter, z. B. 1,79.',
  );
  const insurance = parse(values.insurance, toNumber, 100_000, 'Bitte prüfe den Jahresbeitrag.');
  const maintenance = parse(values.maintenance, toNumber, 100_000, 'Bitte prüfe den Betrag.');
  const energy =
    km.value !== null && consumption.value !== null && price.value !== null
      ? (km.value / 100) * consumption.value * price.value
      : null;

  const parts = [
    { label: 'Kfz-Steuer', value: taxAnnualEur },
    { label: electric ? 'Strom' : 'Kraftstoff', value: energy },
    { label: 'Versicherung', value: insurance.value },
    { label: 'Werkstatt und Wartung', value: maintenance.value },
  ];
  const known = parts.filter(
    (part): part is { label: string; value: number } => part.value !== null,
  );
  const missing = parts.filter((part) => part.value === null).map((part) => part.label);
  const total = known.reduce((sum, part) => sum + part.value, 0);
  // The tax alone is no estimate of the running costs.
  const started = energy !== null || insurance.value !== null || maintenance.value !== null;

  return (
    <div className="tax-calculator">
      <form className="tax-form" onSubmit={(event) => event.preventDefault()} noValidate>
        <TextField
          label="Fahrleistung in km pro Jahr"
          inputMode="numeric"
          error={km.error}
          value={values.kmPerYear}
          onChange={set('kmPerYear')}
        />
        <TextField
          label={electric ? 'Verbrauch in kWh je 100 km' : 'Verbrauch in Litern je 100 km'}
          hint={
            electric
              ? 'Laut Inserat oder Hersteller; im Alltag meist etwas mehr, dazu kommen Ladeverluste'
              : 'Laut Inserat oder Hersteller; im Alltag meist etwas mehr'
          }
          inputMode="decimal"
          error={consumption.error}
          value={values.consumption}
          onChange={set('consumption')}
        />
        <TextField
          label={electric ? 'Strompreis in € je kWh' : 'Kraftstoffpreis in € je Liter'}
          hint={
            electric
              ? 'Dein Haushaltsstrom- oder Ladetarif'
              : 'Aktueller Preis an der Tankstelle oder in einer Spritpreis-App'
          }
          inputMode="decimal"
          error={price.error}
          value={values.price}
          onChange={set('price')}
        />
        <TextField
          label="Versicherung in € pro Jahr"
          hint="Angebot deines Versicherers – abhängig von Typklasse, Region und Schadenfreiheitsklasse"
          inputMode="decimal"
          error={insurance.error}
          value={values.insurance}
          onChange={set('insurance')}
        />
        <TextField
          label="Werkstatt und Wartung in € pro Jahr"
          hint="Deine Annahme für Inspektion, Reifen, HU/AU und Reparaturen; ältere Autos brauchen mehr Rücklage"
          inputMode="decimal"
          error={maintenance.error}
          value={values.maintenance}
          onChange={set('maintenance')}
        />
      </form>
      <section className="tax-result" aria-labelledby="costs-result-title">
        <h3 id="costs-result-title" className="tax-result__title">
          Laufende Kosten
        </h3>
        <p className={started ? 'tax-result__amount' : 'tax-result__hint'} aria-live="polite">
          {started ? (
            <>
              rund {euros(total / 12)} <span>im Monat</span>
            </>
          ) : (
            'Trag deine Werte ein.'
          )}
        </p>
        {started && (
          <>
            <p className="tax-result__monthly">
              {euros(total)} im Jahr
              {km.value ? `, ${euros(total / km.value, 2)} je km` : ''}
            </p>
            <ul className="tax-result__parts">
              {known.map((part) => (
                <li key={part.label}>
                  <span>{part.label}</span>
                  <span className="tax-result__value">{euros(part.value)}</span>
                </li>
              ))}
            </ul>
            {taxNote && <p className="tax-result__hint">{taxNote}</p>}
            {missing.length > 0 && (
              <p className="tax-result__hint">Noch nicht eingerechnet: {missing.join(', ')}.</p>
            )}
            <p className="tax-result__rule">
              Ohne Wertverlust, Stellplatz, Parken und Pflege. Bei jüngeren Autos ist der
              Wertverlust oft der größte Posten.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
