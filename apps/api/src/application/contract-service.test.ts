import { describe, expect, it } from 'vitest';
import { addMonth, referenceNumber, withdrawalRefund } from './contract-service';

describe('addMonth', () => {
  it('keeps the day of the month and clamps it to shorter months', () => {
    expect(addMonth(new Date('2026-10-01T12:00:00Z')).toISOString()).toBe(
      '2026-11-01T12:00:00.000Z',
    );
    expect(addMonth(new Date('2027-01-31T08:00:00Z')).toISOString()).toBe(
      '2027-02-28T08:00:00.000Z',
    );
    expect(addMonth(new Date('2028-01-31T08:00:00Z')).toISOString()).toBe(
      '2028-02-29T08:00:00.000Z',
    );
    expect(addMonth(new Date('2026-12-15T00:00:00Z')).toISOString()).toBe(
      '2027-01-15T00:00:00.000Z',
    );
  });
});

describe('withdrawalRefund', () => {
  it('keeps the share of the month up to the withdrawal, rounded in the consumer’s favour', () => {
    const concluded = new Date('2026-11-01T00:00:00Z');
    // 3 of 30 days used.
    expect(withdrawalRefund(499, concluded, new Date('2026-11-04T00:00:00Z'))).toEqual({
      paidCents: 499,
      keptCents: 49,
      days: 3,
      periodDays: 30,
    });
    expect(withdrawalRefund(499, concluded, concluded).keptCents).toBe(0);
    expect(withdrawalRefund(499, concluded, new Date('2026-10-01T00:00:00Z')).keptCents).toBe(0);
  });
});

describe('referenceNumber', () => {
  it('uses unambiguous characters', () => {
    for (let index = 0; index < 50; index += 1) {
      expect(referenceNumber('KC')).toMatch(/^KC-[2-9A-HJ-NP-Z]{8}$/);
    }
    expect(referenceNumber('KC-K', 6)).toMatch(/^KC-K-[2-9A-HJ-NP-Z]{6}$/);
  });
});
