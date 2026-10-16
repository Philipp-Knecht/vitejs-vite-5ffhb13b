import { loan, loanProblem } from '@kaufcheck/shared';
import { useState } from 'react';
import { TextField } from '../../components/ui/Field';
import { toDecimal, toNumber } from './numbers';

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

/** Empty, or only the first keystroke of „,9“. */
const blank = (raw: string) => /^\s*[.,]?\s*$/.test(raw);

/**
 * Monthly rate of a car loan from the figures of an offer. KaufCheck has no
 * rates of its own and compares no offers; everything stays in the browser.
 */
export function Financing() {
  const [values, setValues] = useState(EMPTY);
  const set = (key: keyof LoanValues) => (event: { target: { value: string } }) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  const read = (raw: string, parse: (value: string) => number | null) =>
    blank(raw) ? null : parse(raw);
  const amount = read(values.amount, toNumber);
  const rate = read(values.rate, toDecimal);
  const months = read(values.months, toNumber);
  const balloon = read(values.balloon, toNumber);
  const invalid = (raw: string, value: number | null) =>
    !blank(raw) && value === null ? 'Bitte gib nur eine Zahl ein.' : undefined;

  const complete = amount !== null && rate !== null && months !== null;
  const input = complete
    ? { amount, effectiveRatePercent: rate, months, balloon: balloon ?? 0 }
    : null;
  const problem = input ? loanProblem(input) : null;
  const result = input && !problem ? loan(input) : null;

  return (
    <div className="tax-calculator">
      <form className="tax-form" onSubmit={(event) => event.preventDefault()} noValidate>
        <TextField
          label="Kreditbetrag in €"
          hint="Kaufpreis minus Anzahlung"
          inputMode="numeric"
          error={invalid(values.amount, amount)}
          value={values.amount}
          onChange={set('amount')}
        />
        <TextField
          label="Effektiver Jahreszins in %"
          hint="Aus dem Angebot von Bank oder Händler; er muss dort angegeben sein"
          inputMode="decimal"
          error={invalid(values.rate, rate)}
          value={values.rate}
          onChange={set('rate')}
        />
        <TextField
          label="Laufzeit in Monaten"
          inputMode="numeric"
          error={invalid(values.months, months)}
          value={values.months}
          onChange={set('months')}
        />
        <TextField
          label="Schlussrate in €"
          hint="Optional, bei einer Ballonfinanzierung: am Ende auf einmal fällig"
          inputMode="numeric"
          error={invalid(values.balloon, balloon)}
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
          ) : (
            (problem ?? 'Trag Kreditbetrag, Zins und Laufzeit ein.')
          )}
        </p>
        {result && input && (
          <>
            <ul className="tax-result__parts">
              <li>
                <span>Zinsen insgesamt</span>
                <span className="tax-result__value">{euros(result.totalInterest, 2)}</span>
              </li>
              <li>
                <span>Zinsen im Schnitt pro Monat</span>
                <span className="tax-result__value">{euros(result.interestPerMonth, 2)}</span>
              </li>
              <li>
                <span>Du zahlst insgesamt</span>
                <span className="tax-result__value">{euros(result.totalPaid, 2)}</span>
              </li>
            </ul>
            {input.balloon > 0 && (
              <p className="tax-result__hint">
                Dazu kommt am Ende die Schlussrate von {euros(input.balloon)} – auf einmal, oder du
                finanzierst sie neu.
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
