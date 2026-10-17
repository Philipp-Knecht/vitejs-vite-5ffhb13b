import { loan, loanProblem, type LoanField, type LoanResult } from '@kaufcheck/shared';
import { toDecimal, toNumber } from './numbers';

export interface LoanFormValues {
  amount: string;
  rate: string;
  months: string;
  balloon: string;
}

export interface ParsedLoan {
  /** Error per field: not a number, or a value the loan cannot have. */
  fields: Partial<Record<LoanField, string>>;
  /** Something was typed, but amount, rate or term are still missing. */
  incomplete: boolean;
  /** Only when every field is fine. */
  result: LoanResult | null;
  balloon: number;
}

/** Empty, or only the first keystroke of „,9“. */
const blank = (raw: string) => /^\s*[.,]?\s*$/.test(raw);

/** The loan from the typed figures; an error in any field means no result. */
export function parseLoanForm(values: LoanFormValues): ParsedLoan {
  const fields: Partial<Record<LoanField, string>> = {};
  const read = (field: LoanField, raw: string, parse: (value: string) => number | null) => {
    if (blank(raw)) return null;
    const value = parse(raw);
    if (value === null) fields[field] = 'Bitte gib nur eine Zahl ein.';
    return value;
  };
  const amount = read('amount', values.amount, toNumber);
  const rate = read('rate', values.rate, toDecimal);
  const months = read('months', values.months, toNumber);
  const balloon = read('balloon', values.balloon, toNumber) ?? 0;
  const started = [values.amount, values.rate, values.months, values.balloon].some(
    (raw) => !blank(raw),
  );
  if (amount === null || rate === null || months === null)
    return {
      fields,
      incomplete: started && Object.keys(fields).length === 0,
      result: null,
      balloon,
    };
  const input = { amount, effectiveRatePercent: rate, months, balloon };
  const problem = loanProblem(input);
  if (problem) fields[problem.field] ??= problem.message;
  return {
    fields,
    incomplete: false,
    result: Object.keys(fields).length === 0 ? loan(input) : null,
    balloon,
  };
}
