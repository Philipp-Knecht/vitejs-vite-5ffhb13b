import {
  AVERAGE_LOAN_RATE,
  financingProposal,
  PROPOSAL_DEFAULT_MONTHS,
  PROPOSAL_MONTHS,
} from '@kaufcheck/shared';
import { useId, useState } from 'react';
import { Link } from 'react-router';
import { SelectField, TextField } from '../../components/ui/Field';
import { euros } from '../tax/euros';
import { LoanFigures } from '../tax/Financing';
import { toDecimal, toNumber } from '../tax/numbers';

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

/** Empty, or only the first keystroke of „,9“. */
const blank = (raw: string) => /^\s*[.,]?\s*$/.test(raw);

const NUMBER_ONLY = 'Bitte gib nur eine Zahl ein.';

/**
 * A loan for the asking price as an example: the down payment and term are
 * the buyer's, the rate is the Bundesbank's average until they type their own.
 * No offer and no comparison of offers; everything stays in the browser.
 */
export function FinancingProposal({
  priceEur,
  negotiable,
}: {
  priceEur: number;
  /** Verhandlungsbasis: the final price may be lower. */
  negotiable: boolean;
}) {
  const titleId = useId();
  const [downPayment, setDownPayment] = useState('');
  const [months, setMonths] = useState(String(PROPOSAL_DEFAULT_MONTHS));
  const [rate, setRate] = useState(rateText(AVERAGE_LOAN_RATE.percent));

  const down = blank(downPayment) ? 0 : toNumber(downPayment);
  const ratePercent = blank(rate) ? null : toDecimal(rate);
  const proposal =
    down === null || ratePercent === null
      ? null
      : financingProposal({
          priceEur,
          downPaymentEur: down,
          months: Number(months),
          ratePercent,
        });
  const downError =
    down === null
      ? NUMBER_ONLY
      : proposal?.kind === 'noLoan'
        ? proposal.covered
          ? 'Die Anzahlung deckt den ganzen Preis, dafür brauchst du keinen Kredit.'
          : 'Für den Rest unter 100 € rechnet KaufCheck keinen Kredit.'
        : undefined;
  const rateError =
    !blank(rate) && ratePercent === null
      ? NUMBER_ONLY
      : proposal?.kind === 'invalid' && proposal.field === 'rate'
        ? proposal.message
        : undefined;
  const loan = proposal?.kind === 'loan' ? proposal : null;
  const average = ratePercent === AVERAGE_LOAN_RATE.percent;
  const amountText = (value: number) => euros(value, Number.isInteger(value) ? 0 : 2);

  return (
    <div className="financing-proposal">
      <h3 className="market__title">Finanzierung: ein Rechenbeispiel</h3>
      <div className="tax-calculator">
        <form className="tax-form" onSubmit={(event) => event.preventDefault()} noValidate>
          <TextField
            label="Anzahlung in €"
            hint={`Wird vom Preis${negotiable ? ' (VB)' : ''} ${euros(priceEur)} abgezogen; leer lassen ohne Anzahlung`}
            inputMode="decimal"
            error={downError}
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
            hint="Vorbelegt mit dem Durchschnitt; hast du ein Angebot, trag dessen effektiven Jahreszins ein"
            inputMode="decimal"
            error={rateError}
            value={rate}
            onChange={(event) => setRate(event.target.value)}
          />
        </form>
        <section className="tax-result" aria-labelledby={titleId}>
          <h4 id={titleId} className="tax-result__title">
            Monatsrate
          </h4>
          <p className={loan ? 'tax-result__amount' : 'tax-result__hint'} aria-live="polite">
            {loan ? (
              <>
                <span className="visually-hidden">Monatsrate: </span>
                {euros(loan.result.monthlyRate, 2)} <span>im Monat</span>
              </>
            ) : downError || rateError ? (
              'Bitte prüfe die markierten Angaben.'
            ) : (
              'Für die Rate fehlt noch der Zins.'
            )}
          </p>
          {loan && (
            <>
              <ul className="tax-result__parts">
                <li>
                  <span>Kreditbetrag</span>
                  <span className="tax-result__value">{amountText(loan.amount)}</span>
                </li>
              </ul>
              <LoanFigures result={loan.result} />
            </>
          )}
          <p className="tax-result__rule">
            {average ? 'Gerechnet mit dem' : 'Zum Vergleich: der'} Durchschnitt aller neuen
            Ratenkredite deutscher Banken an Privatleute im {monthText(AVERAGE_LOAN_RATE.month)}:{' '}
            {rateText(AVERAGE_LOAN_RATE.percent)} % effektiver Jahreszins einschließlich Kosten
            {AVERAGE_LOAN_RATE.provisional ? ' (vorläufiger Wert)' : ''}, laut{' '}
            <a href={AVERAGE_LOAN_RATE.source} target="_blank" rel="noopener noreferrer">
              Deutscher Bundesbank
            </a>
            . Kein Angebot: Dein Zins hängt von Bank, Bonität, Betrag und Laufzeit ab und kann
            deutlich höher oder niedriger sein.
            {negotiable && ' Der Preis ist Verhandlungsbasis, der Kaufpreis kann niedriger sein.'}
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
