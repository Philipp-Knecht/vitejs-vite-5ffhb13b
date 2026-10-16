import { useState } from 'react';
import { TextField } from '../../components/ui/Field';
import { parseLoanForm } from './loan-form';

interface LoanValues {
  amount: string;
  rate: string;
  months: string;
  balloon: string;
}

const EMPTY: LoanValues = { amount: '', rate: '', months: '', balloon: '' };

const euros = (value: number, fractions = 0) =>
  value.toLocaleString('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: fractions,
    maximumFractionDigits: fractions,
  });

/**
 * Monthly rate of a car loan from the figures of an offer. KaufCheck has no
 * rates of its own and compares no offers; everything stays in the browser.
 */
export function Financing() {
  const [values, setValues] = useState(EMPTY);
  const set = (key: keyof LoanValues) => (event: { target: { value: string } }) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  const parsed = parseLoanForm(values);
  const result = parsed.result;

  return (
    <div className="tax-calculator">
      <form className="tax-form" onSubmit={(event) => event.preventDefault()} noValidate>
        <TextField
          label="Kreditbetrag in €"
          hint="Nettodarlehensbetrag laut Angebot – meist Kaufpreis minus Anzahlung"
          inputMode="numeric"
          error={parsed.fields.amount}
          value={values.amount}
          onChange={set('amount')}
        />
        <TextField
          label="Effektiver Jahreszins in %"
          hint="Aus dem Angebot von Bank oder Händler, nicht der Sollzins: Nur der effektive Jahreszins enthält alle Pflichtkosten"
          inputMode="decimal"
          error={parsed.fields.rate}
          value={values.rate}
          onChange={set('rate')}
        />
        <TextField
          label="Laufzeit in Monaten"
          inputMode="numeric"
          error={parsed.fields.months}
          value={values.months}
          onChange={set('months')}
        />
        <TextField
          label="Schlussrate in €"
          hint="Optional, bei einer Ballonfinanzierung: am Ende auf einmal fällig"
          inputMode="numeric"
          error={parsed.fields.balloon}
          value={values.balloon}
          onChange={set('balloon')}
        />
      </form>
      <section className="tax-result" aria-labelledby="loan-result-title">
        <h3 id="loan-result-title" className="tax-result__title">
          Finanzierung
        </h3>
        <p className={result ? 'tax-result__amount' : 'tax-result__hint'} aria-live="polite">
          {result ? (
            <>
              <span className="visually-hidden">Monatsrate: </span>
              {euros(result.monthlyRate, 2)} <span>im Monat</span>
            </>
          ) : parsed.incomplete ? (
            'Für die Rate fehlen noch Kreditbetrag, Zins oder Laufzeit.'
          ) : (
            'Trag Kreditbetrag, Zins und Laufzeit ein.'
          )}
        </p>
        {result && (
          <>
            <ul className="tax-result__parts">
              <li>
                <span>Kreditkosten insgesamt (Zinsen und Gebühren)</span>
                <span className="tax-result__value">{euros(result.totalInterest, 2)}</span>
              </li>
              <li>
                <span>Kreditkosten im Schnitt pro Monat</span>
                <span className="tax-result__value">{euros(result.interestPerMonth, 2)}</span>
              </li>
              <li>
                <span>Du zahlst insgesamt</span>
                <span className="tax-result__value">{euros(result.totalPaid, 2)}</span>
              </li>
            </ul>
            {parsed.balloon > 0 && (
              <p className="tax-result__hint">
                Darin ist die Schlussrate von {euros(parsed.balloon)} enthalten. Sie ist am Ende auf
                einmal fällig; finanzierst du sie neu, kommen weitere Zinsen dazu.
              </p>
            )}
            <p className="tax-result__rule">
              Gerechnet mit gleich hohen Monatsraten und dem effektiven Jahreszins. Kosten, die
              nicht darin enthalten sind – etwa eine freiwillige Restschuldversicherung –, kommen
              dazu. Die genauen Raten stehen im Angebot.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
