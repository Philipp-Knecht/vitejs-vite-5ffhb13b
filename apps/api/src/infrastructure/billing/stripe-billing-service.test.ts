import type Stripe from 'stripe';
import { describe, expect, it } from 'vitest';
import { priceProblem } from './stripe-billing-service';

const monthly = {
  active: true,
  type: 'recurring',
  currency: 'eur',
  billing_scheme: 'per_unit',
  unit_amount: 499,
  tax_behavior: 'inclusive',
  recurring: {
    interval: 'month',
    interval_count: 1,
    usage_type: 'licensed',
    trial_period_days: null,
  },
};
const price = (overrides: Record<string, unknown> = {}) =>
  ({ ...monthly, ...overrides }) as unknown as Stripe.Price;

describe('priceProblem', () => {
  it('accepts a monthly gross price in euros', () => {
    expect(priceProblem(price())).toBeNull();
    expect(priceProblem(price({ tax_behavior: 'unspecified' }))).toBeNull();
    expect(priceProblem(price({ tax_behavior: null }))).toBeNull();
  });

  it.each([
    [{ active: false }, 'price_inactive'],
    [{ type: 'one_time', recurring: null }, 'price_not_recurring'],
    [{ currency: 'usd' }, 'price_not_eur'],
    [{ recurring: { ...monthly.recurring, interval: 'year' } }, 'price_not_monthly'],
    [{ recurring: { ...monthly.recurring, interval_count: 3 } }, 'price_not_monthly'],
    [{ recurring: { ...monthly.recurring, usage_type: 'metered' } }, 'price_metered'],
    [{ recurring: { ...monthly.recurring, trial_period_days: 7 } }, 'price_with_trial'],
    [{ billing_scheme: 'tiered', unit_amount: null }, 'price_without_fixed_amount'],
    [{ tax_behavior: 'exclusive' }, 'price_tax_exclusive'],
  ])('rejects %o', (overrides, problem) => {
    expect(priceProblem(price(overrides))).toBe(problem);
  });
});
