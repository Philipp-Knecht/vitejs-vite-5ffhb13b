import {
  AVERAGE_LOAN_RATE,
  LOAN_LIMITS,
  PROPOSAL_DEFAULT_MONTHS,
  PROPOSAL_MONTHS,
} from '@kaufcheck/shared';
import { useState } from 'react';
import { Link } from 'react-router';
import { SelectField, TextField } from '../../components/ui/Field';
import { euros } from '../tax/euros';
import { LoanFigures } from '../tax/Financing';
import { parseLoanForm } from '../tax/loan-form';
import { toNumber } from '../tax/numbers';

const MONTH_NAMES = [
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

/** „August 2026“ from „2026-08“. */
const monthText = (month: string) =>
  `${MONTH_NAMES[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;

const rateText = (percent: number) =>
  percent.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * A loan for the asking price as an example: the down payment and term are
 * the buyer's, the rate is the Bundesbank's average until they type their own.
 * No offer and no comparison of offers; everything stays in the browser.
 */
export function FinancingProposal({ priceEur }: { priceEur: number }) {
  const [downPayment, setDownPayment] = useState('');
  const [months, setMonths] = useState(String(PROPOSAL_DEFAULT_MONTHS));
  const [rate, setRate] = useState(rateText(AVERAGE_LOAN_RATE.percent));

  const down = downPayment.trim() ? toNumber(downPayment) : 0;
  const amount = down === null ? null : priceEur - down;
  const noLoan = amount !== null && amount < LOAN_LIMITS.amount.min;
  const parsed =
    amount === null || noLoan
      ? null
      : parseLoanForm({ amount: String(amount), rate, months, balloon: '' });
  const result = parsed?.result ?? null;
  const average = rate.trim() === rateText(AVERAGE_LOAN_RATE.percent);

  return (
    <div className="financing-proposal">
      <h3 className="market__title">Finanzierung: ein Rechenbeispiel</h3>
      <div className="tax-calculator">
        <form className="tax-form" onSubmit={(event) => event.preventDefault()} noValidate>
          <TextField
            label="Anzahlung in €"
            hint={`Vom Preis ${euros(priceEur)} ab; leer lassen ohne Anzahlung`}
            inputMode="numeric"
            error={
              down === null
                ? 'Bitte gib nur eine Zahl ein.'
                : noLoan
                  ? 'Mit dieser Anzahlung brauchst du keinen Kredit.'
                  : undefined
            }
            value={downPayment}
            onChange={(event) => setDownPayment(event.target.value)}
          />
          <SelectField
            label="Laufzeit"
            value={months}
            onChange={(event) => setMonths(event.target.value)}
          >
            {PROPOSAL_MONTHS.map((count) => (
              <option key={count} value={count}>
                {count} Monate
              </option>
            ))}
          </SelectField>
          <TextField
            label="Effektiver Jahreszins in %"
            hint="Vorbelegt mit dem Durchschnitt; hast du ein Angebot, trag dessen Zins ein"
            inputMode="decimal"
            error={parsed?.fields.rate}
            value={rate}
            onChange={(event) => setRate(event.target.value)}
          />
        </form>
        <section className="tax-result" aria-labelledby="proposal-result-title">
          <h4 id="proposal-result-title" className="tax-result__title">
            Monatsrate
          </h4>
          <p className={result ? 'tax-result__amount' : 'tax-result__hint'} aria-live="polite">
            {result ? (
              <>
                <span className="visually-hidden">Monatsrate: </span>
                {euros(result.monthlyRate, 2)} <span>im Monat</span>
              </>
            ) : parsed?.incomplete || !rate.trim() ? (
              'Für die Rate fehlt noch der Zins.'
            ) : (
              'Bitte prüfe die markierten Angaben.'
            )}
          </p>
          {result && amount !== null && (
            <>
              <ul className="tax-result__parts">
                <li>
                  <span>Kreditbetrag</span>
                  <span className="tax-result__value">{euros(amount)}</span>
                </li>
              </ul>
              <LoanFigures result={result} />
            </>
          )}
          <p className="tax-result__rule">
            {average ? 'Gerechnet mit dem' : 'Zum Vergleich: der'} Durchschnitt aller neuen
            Ratenkredite an Privatleute mit 1 bis 5 Jahren Zinsbindung im{' '}
            {monthText(AVERAGE_LOAN_RATE.month)}: {rateText(AVERAGE_LOAN_RATE.percent)} % effektiv
            {AVERAGE_LOAN_RATE.provisional ? ' (vorläufiger Wert)' : ''}, laut{' '}
            <a href={AVERAGE_LOAN_RATE.source} target="_blank" rel="noopener noreferrer">
              Deutscher Bundesbank
            </a>
            . Kein Angebot: Dein Zins hängt von Bank, Bonität und Laufzeit ab, Gebühren sind im
            Durchschnitt nicht enthalten.
          </p>
          <p className="tax-result__rule">
            Mit Schlussrate oder eigenem Kreditbetrag rechnen:{' '}
            <Link to="/kfz-steuer-rechner#finanzierung">Finanzierungsrechner</Link>
          </p>
        </section>
      </div>
    </div>
  );
}
