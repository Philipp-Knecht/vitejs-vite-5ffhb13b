import { useState } from 'react';
import { TextField } from '../../components/ui/Field';
import { toNumber } from './numbers';

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

/**
 * Rough running costs from the buyer's own figures: tax (from the calculator
 * above), energy, insurance and a reserve for workshop costs. KaufCheck has no
 * price data of its own, so nothing is prefilled with assumed values.
 */
export function RunningCosts({
  taxAnnualEur,
  electric,
}: {
  /** Annual Kfz-Steuer from the calculator; `null` while it is unknown. */
  taxAnnualEur: number | null;
  electric: boolean;
}) {
  const [values, setValues] = useState(EMPTY);
  const set = (key: keyof CostValues) => (event: { target: { value: string } }) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  const km = toNumber(values.kmPerYear);
  const consumption = toNumber(values.consumption);
  const price = toNumber(values.price);
  const energy =
    km !== null && consumption !== null && price !== null ? (km / 100) * consumption * price : null;
  const insurance = toNumber(values.insurance);
  const maintenance = toNumber(values.maintenance);

  const parts = [
    { label: 'Kfz-Steuer', value: taxAnnualEur },
    { label: electric ? 'Strom' : 'Kraftstoff', value: energy },
    { label: 'Versicherung', value: insurance },
    { label: 'Werkstatt und Wartung', value: maintenance },
  ];
  const known = parts.filter(
    (part): part is { label: string; value: number } => part.value !== null,
  );
  const missing = parts.filter((part) => part.value === null).map((part) => part.label);
  const total = known.reduce((sum, part) => sum + part.value, 0);

  return (
    <div className="tax-calculator">
      <form className="tax-form" onSubmit={(event) => event.preventDefault()} noValidate>
        <TextField
          label="Fahrleistung in km pro Jahr"
          inputMode="numeric"
          value={values.kmPerYear}
          onChange={set('kmPerYear')}
        />
        <TextField
          label={electric ? 'Verbrauch in kWh je 100 km' : 'Verbrauch in Litern je 100 km'}
          hint="Laut Inserat oder Hersteller; im Alltag meist etwas mehr"
          inputMode="decimal"
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
          value={values.price}
          onChange={set('price')}
        />
        <TextField
          label="Versicherung in € pro Jahr"
          hint="Angebot deines Versicherers – abhängig von Typklasse, Region und Schadenfreiheitsklasse"
          inputMode="numeric"
          value={values.insurance}
          onChange={set('insurance')}
        />
        <TextField
          label="Werkstatt und Wartung in € pro Jahr"
          hint="Deine Annahme, z. B. aus Inspektionsrechnungen und Reifen; ältere Autos brauchen mehr Rücklage"
          inputMode="numeric"
          value={values.maintenance}
          onChange={set('maintenance')}
        />
      </form>
      <section className="tax-result" aria-labelledby="costs-result-title">
        <h3 id="costs-result-title" className="tax-result__title">
          Laufende Kosten
        </h3>
        <div aria-live="polite">
          {known.length === 0 ? (
            <p className="tax-result__hint">Trag deine Werte ein.</p>
          ) : (
            <>
              <p className="tax-result__amount">
                rund {euros(total / 12)} <span>im Monat</span>
              </p>
              <p className="tax-result__monthly">
                {euros(total)} im Jahr
                {km ? `, ${euros(total / km, 2)} je km` : ''}
              </p>
              <ul className="tax-result__parts">
                {known.map((part) => (
                  <li key={part.label}>
                    <span>{part.label}</span>
                    <span className="tax-result__value">{euros(part.value)}</span>
                  </li>
                ))}
              </ul>
              {missing.length > 0 && (
                <p className="tax-result__hint">Noch nicht eingerechnet: {missing.join(', ')}.</p>
              )}
              <p className="tax-result__rule">
                Ohne Wertverlust, Parken und Pflege – der Wertverlust ist oft der größte Posten.
              </p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
