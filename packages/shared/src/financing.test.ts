import { describe, expect, it } from 'vitest';
import {
  AVERAGE_LOAN_RATE,
  loan,
  LOAN_LIMITS,
  loanProblem,
  PROPOSAL_DEFAULT_MONTHS,
  PROPOSAL_MONTHS,
} from './financing';

describe('car loan', () => {
  it('computes the rate of an annuity loan from the effective annual rate', () => {
    // 15,000 € over 48 months at 5.9 % effective: about 350 € a month.
    const result = loan({ amount: 15_000, effectiveRatePercent: 5.9, months: 48, balloon: 0 })!;
    expect(result.monthlyRate).toBeGreaterThan(350);
    expect(result.monthlyRate).toBeLessThan(352);
    expect(result.totalPaid).toBeCloseTo(result.monthlyRate * 48, 1);
    expect(result.totalInterest).toBeCloseTo(result.totalPaid - 15_000, 1);
    expect(result.interestPerMonth).toBeCloseTo(result.totalInterest / 48, 1);
  });

  it('pays the final instalment on top of the last rate', () => {
    const plain = loan({ amount: 20_000, effectiveRatePercent: 4, months: 36, balloon: 0 })!;
    const balloon = loan({ amount: 20_000, effectiveRatePercent: 4, months: 36, balloon: 8_000 })!;
    expect(balloon.monthlyRate).toBeLessThan(plain.monthlyRate);
    // A final instalment means more interest in total.
    expect(balloon.totalInterest).toBeGreaterThan(plain.totalInterest);
    expect(balloon.totalPaid).toBeCloseTo(balloon.monthlyRate * 36 + 8_000, 1);
  });

  it('handles 0 % and rejects figures that make no sense', () => {
    expect(loan({ amount: 12_000, effectiveRatePercent: 0, months: 24, balloon: 0 })).toEqual({
      monthlyRate: 500,
      totalPaid: 12_000,
      totalInterest: 0,
      interestPerMonth: 0,
    });
    const problem = (input: Partial<Parameters<typeof loanProblem>[0]>) =>
      loanProblem({ amount: 10_000, effectiveRatePercent: 5, months: 24, balloon: 0, ...input })
        ?.field;
    expect(problem({ amount: 50 })).toBe('amount');
    expect(problem({ effectiveRatePercent: 31 })).toBe('rate');
    expect(problem({ months: 130 })).toBe('months');
    expect(problem({ months: 36.5 })).toBe('months');
    expect(problem({ balloon: 10_000 })).toBe('balloon');
    expect(problem({})).toBeUndefined();
  });
});

describe('the average rate for the example in a check', () => {
  it('is a plausible Bundesbank figure with its month', () => {
    expect(AVERAGE_LOAN_RATE.percent).toBeGreaterThan(LOAN_LIMITS.ratePercent.min);
    expect(AVERAGE_LOAN_RATE.percent).toBeLessThan(LOAN_LIMITS.ratePercent.max);
    expect(AVERAGE_LOAN_RATE.month).toMatch(/^20\d{2}-(0[1-9]|1[0-2])$/);
    expect(AVERAGE_LOAN_RATE.source).toMatch(/^https:\/\/www\.bundesbank\.de\//);
  });

  it('offers terms within the range of the average, over 1 up to 5 years', () => {
    expect(PROPOSAL_MONTHS).toContain(PROPOSAL_DEFAULT_MONTHS);
    for (const months of PROPOSAL_MONTHS) {
      expect(months).toBeGreaterThan(12);
      expect(months).toBeLessThanOrEqual(60);
    }
  });
});
