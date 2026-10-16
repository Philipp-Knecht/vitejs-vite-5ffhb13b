import { describe, expect, it } from 'vitest';
import { loan, loanProblem } from './financing';

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
    expect(loanProblem({ amount: 50, effectiveRatePercent: 5, months: 24, balloon: 0 })).toMatch(
      /Kreditbetrag/,
    );
    expect(
      loanProblem({ amount: 10_000, effectiveRatePercent: 31, months: 24, balloon: 0 }),
    ).toMatch(/Jahreszins/);
    expect(
      loanProblem({ amount: 10_000, effectiveRatePercent: 5, months: 130, balloon: 0 }),
    ).toMatch(/Laufzeit/);
    expect(
      loanProblem({ amount: 10_000, effectiveRatePercent: 5, months: 24, balloon: 10_000 }),
    ).toMatch(/Schlussrate/);
  });
});
