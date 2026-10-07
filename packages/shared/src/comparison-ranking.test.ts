import { describe, expect, it } from 'vitest';
import { rankOffers, type DecisionValues } from './comparison-ranking';

const criterion = (
  key: string,
  prefer: 'min' | 'max',
  values: (number | null)[],
): DecisionValues => ({ key, label: key, prefer, best: `best ${key}`, values });

describe('rankOffers', () => {
  const criteria = [
    criterion('price', 'min', [10000, 12000, 14000]),
    criterion('mileage', 'min', [150000, 90000, 60000]),
    criterion('completeness', 'max', [60, null, 90]),
  ];

  it('orders the offers by the buyer’s weights', () => {
    const cheapFirst = rankOffers(3, criteria, { price: 2, mileage: 0, completeness: 0 });
    expect(cheapFirst.map((offer) => offer.index)).toEqual([0, 1, 2]);
    expect(cheapFirst[0]?.ahead).toEqual(['best price']);

    const fewKilometres = rankOffers(3, criteria, { price: 0, mileage: 2, completeness: 0 });
    expect(fewKilometres.map((offer) => offer.index)).toEqual([2, 1, 0]);
  });

  it('counts unknown values as the worst and says so', () => {
    const result = rankOffers(3, criteria, { price: 0, mileage: 0, completeness: 1 });
    expect(result[0]).toMatchObject({ index: 2, score: 1, ahead: ['best completeness'] });
    expect(result.find((offer) => offer.index === 1)).toMatchObject({
      score: 0,
      unknown: ['completeness'],
    });
  });

  it('ignores criteria without differences and stays neutral without priorities', () => {
    const equal = [criterion('price', 'min', [9000, 9000])];
    expect(rankOffers(2, equal, { price: 2 }).map((offer) => offer.score)).toEqual([0, 0]);
    expect(rankOffers(2, criteria, {}).map((offer) => offer.index)).toEqual([0, 1]);
  });
});
