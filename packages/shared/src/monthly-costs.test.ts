import { describe, expect, it } from 'vitest';
import {
  cheapestCar,
  energyGroup,
  monthlyCosts,
  type CarCostFigures,
  type SharedCostAssumptions,
} from './monthly-costs';

const shared: SharedCostAssumptions = {
  kmPerYear: 12_000,
  prices: { petrol: 1.8, electric: 0.4 },
  years: 4,
};

const golf: CarCostFigures = {
  energy: 'petrol',
  consumption: 6,
  taxPerYear: 120,
  insurancePerYear: 600,
  workshopPerYear: 720,
  otherPerYear: null,
  purchasePrice: 15_000,
  resaleValue: 9_000,
};

describe('monthly costs', () => {
  it('adds the parts the buyer gave figures for', () => {
    const costs = monthlyCosts(golf, shared);
    // 12,000 km × 6 l/100 km × 1.80 € = 1,296 € a year.
    expect(costs.parts).toEqual({
      depreciation: 125,
      energy: 108,
      tax: 10,
      insurance: 50,
      workshop: 60,
      other: null,
    });
    expect(costs.totalEur).toBe(353);
    expect(costs.missing).toEqual(['other']);
  });

  it('leaves out what it cannot calculate', () => {
    const costs = monthlyCosts(
      { ...golf, energy: 'diesel', resaleValue: 20_000 },
      { ...shared, years: 0 },
    );
    expect(costs.parts.energy).toBeNull();
    expect(costs.parts.depreciation).toBeNull();
    expect(costs.missing).toEqual(['depreciation', 'energy', 'other']);
  });

  it('names the cheapest car only when the same parts are known', () => {
    const a = monthlyCosts(golf, shared);
    const b = monthlyCosts({ ...golf, consumption: 5 }, shared);
    const c = monthlyCosts({ ...golf, insurancePerYear: null }, shared);
    expect(cheapestCar([a, b])).toBe(1);
    expect(cheapestCar([a, c])).toBeNull();
    expect(cheapestCar([a, a])).toBeNull();
    expect(cheapestCar([a])).toBeNull();
  });

  it('groups fuels by what they cost', () => {
    expect(energyGroup('plugin_hybrid')).toBe('petrol');
    expect(energyGroup('electric')).toBe('electric');
    expect(energyGroup('other')).toBeNull();
    expect(energyGroup(null)).toBeNull();
  });
});
