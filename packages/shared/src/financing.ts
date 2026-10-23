/**
 * Monthly rate of a car loan from the buyer's own figures: the effective
 * annual rate (effektiver Jahreszins) from the offer, the term and an
 * optional final instalment (Schlussrate). KaufCheck compares no offers; the
 * check of a listing shows an example with the Bundesbank's average rate.
 */
export interface LoanInput {
  /** The amount borrowed in euros. */
  amount: number;
  /** Effective annual rate in percent, as in the offer. */
  effectiveRatePercent: number;
  months: number;
  /** Paid with the last month on top of the rate; 0 without. */
  balloon: number;
}

export interface LoanResult {
  /** Euros per month, rounded to cents. */
  monthlyRate: number;
  /** All rates plus the final instalment. */
  totalPaid: number;
  totalInterest: number;
  /** The interest spread over the term: the cost part of the rate. */
  interestPerMonth: number;
}

export const LOAN_LIMITS = {
  amount: { min: 100, max: 10_000_000 },
  ratePercent: { min: 0, max: 30 },
  months: { min: 6, max: 120 },
} as const;

const cents = (value: number) => Math.round(value * 100) / 100;

export type LoanField = 'amount' | 'rate' | 'months' | 'balloon';

/** Why the figures cannot be used, with the field to fix, or null. */
export function loanProblem(input: LoanInput): { field: LoanField; message: string } | null {
  if (input.amount < LOAN_LIMITS.amount.min || input.amount > LOAN_LIMITS.amount.max)
    return { field: 'amount', message: 'Bitte prüfe den Kreditbetrag.' };
  if (
    input.effectiveRatePercent < LOAN_LIMITS.ratePercent.min ||
    input.effectiveRatePercent > LOAN_LIMITS.ratePercent.max
  )
    return {
      field: 'rate',
      message: 'Bitte gib den effektiven Jahreszins in Prozent an, zum Beispiel 5,9.',
    };
  if (
    !Number.isInteger(input.months) ||
    input.months < LOAN_LIMITS.months.min ||
    input.months > LOAN_LIMITS.months.max
  )
    return {
      field: 'months',
      message: 'Bitte gib die Laufzeit in Monaten an, zwischen 6 und 120.',
    };
  if (input.balloon < 0 || input.balloon >= input.amount)
    return { field: 'balloon', message: 'Die Schlussrate muss kleiner als der Kreditbetrag sein.' };
  return null;
}

/**
 * The rate of an annuity loan with monthly payments. The monthly interest
 * follows from the effective annual rate like in the price indication rules
 * (Preisangabenverordnung): (1 + effective rate)^(1/12) − 1.
 */
export function loan(input: LoanInput): LoanResult | null {
  if (loanProblem(input)) return null;
  const { amount, months, balloon } = input;
  const monthly = Math.pow(1 + input.effectiveRatePercent / 100, 1 / 12) - 1;
  const rate =
    monthly === 0
      ? (amount - balloon) / months
      : ((amount - balloon / Math.pow(1 + monthly, months)) * monthly) /
        (1 - Math.pow(1 + monthly, -months));
  const monthlyRate = cents(rate);
  const totalPaid = cents(monthlyRate * months + balloon);
  const totalInterest = cents(Math.max(0, totalPaid - amount));
  return {
    monthlyRate,
    totalPaid,
    totalInterest,
    interestPerMonth: cents(totalInterest / months),
  };
}

/**
 * The average effective annual rate of new consumer loans to households with
 * a fixed rate for over 1 up to 5 years: Deutsche Bundesbank, MFI interest
 * rate statistics, series BBIM1.M.DE.B.A2B.I.R.A.2250.EUR.N (SUD114). It
 * covers interest only, no other costs, and is updated with
 * `npm run loan-rate:update`.
 */
export const AVERAGE_LOAN_RATE = {
  percent: 7.53,
  /** The month of the figure, „YYYY-MM“. */
  month: '2026-08',
  /** The Bundesbank marks the newest month as provisional. */
  provisional: true,
  source:
    'https://www.bundesbank.de/de/statistiken/geld-und-kapitalmaerkte/zinssaetze-und-renditen/konsumentenkredite-an-private-haushalte-ratenkredite-615046',
} as const;

/** Terms within the Bundesbank's range of over 1 up to 5 years. */
export const PROPOSAL_MONTHS = [24, 36, 48, 60] as const;

export const PROPOSAL_DEFAULT_MONTHS = 48;
