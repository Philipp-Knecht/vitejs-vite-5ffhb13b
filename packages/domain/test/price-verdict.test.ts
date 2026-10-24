import { MIN_COMPARABLE_VISITORS, MIN_COMPARABLES } from '@kaufcheck/shared';
import { describe, expect, it } from 'vitest';
import {
  assessMarket,
  decimalRegistration,
  expectedPrice,
  NO_PRICE_MESSAGE,
  priceVerdict,
  type MarketComparable,
  type PricePoint,
} from '../src/index';
import { analyze, listingFromText, pasted } from './helpers';

/** Offers that lose 10 % a year and 3 % per 10,000 km, with a fixed small wobble. */
function offers(count: number, base = 20_000): PricePoint[] {
  return Array.from({ length: count }, (_, i) => {
    const registration = 2014 + (i % 5);
    const mileageKm = 80_000 + ((i * 7) % 9) * 5_000;
    const wobble = [1, 1.04, 0.97, 1.02, 0.99, 1.03, 0.96][i % 7]!;
    const priceEur = Math.round(
      base *
        Math.exp(0.1 * (registration - 2016) - (0.03 * (mileageKm - 100_000)) / 10_000) *
        wobble,
    );
    return { priceEur, registration, mileageKm };
  });
}

describe('expectedPrice', () => {
  it('adjusts to the age and mileage of the car with enough offers', () => {
    const result = expectedPrice(offers(30), { registration: 2016, mileageKm: 100_000 }, 8);
    expect(result?.method).toBe('age_mileage');
    // 20,000 € is the price of a 2016 car with 100,000 km before the wobble.
    expect(result?.expectedEur).toBeGreaterThan(19_400);
    expect(result?.expectedEur).toBeLessThan(20_600);
    expect(result!.lowEur).toBeLessThan(result!.expectedEur);
    expect(result!.highEur).toBeGreaterThan(result!.expectedEur);
  });

  it('finds the same price for an older car with fewer kilometres as the line says', () => {
    const result = expectedPrice(offers(30), { registration: 2014, mileageKm: 80_000 }, 8);
    const line = 20_000 * Math.exp(-0.2 + 0.06);
    expect(Math.abs(result!.expectedEur - line) / line).toBeLessThan(0.04);
  });

  it('drops placeholders and typos before they bend the result', () => {
    const clean = expectedPrice(offers(30), { registration: 2016, mileageKm: 100_000 }, 8)!;
    const noisy = expectedPrice(
      [
        ...offers(30),
        { priceEur: 1, registration: 2016, mileageKm: 100_000 },
        { priceEur: 199_999, registration: 2016, mileageKm: 100_000 },
        { priceEur: 2_000, registration: 2016, mileageKm: 100_000 },
      ],
      { registration: 2016, mileageKm: 100_000 },
      8,
    )!;
    expect(noisy.sampleSize).toBe(30);
    expect(noisy.expectedEur).toBe(clean.expectedEur);
  });

  it('uses the median with few offers or when age and mileage are unknown', () => {
    const few = expectedPrice(offers(10), { registration: 2016, mileageKm: 100_000 }, 8);
    expect(few?.method).toBe('median');
    const unknown = expectedPrice(offers(30), { registration: null, mileageKm: null }, 8);
    expect(unknown?.method).toBe('median');
    expect(unknown?.expectedEur).toBe(unknown?.medianEur);
  });

  it('falls back when the offers say newer cars are cheaper', () => {
    const odd = offers(30).map((point) => ({
      ...point,
      priceEur: Math.round(30_000 - (point.registration! - 2014) * 2_000),
      mileageKm: 100_000,
    }));
    const result = expectedPrice(odd, { registration: 2016, mileageKm: 100_000 }, 8);
    expect(result?.method).toBe('median');
  });

  it('never goes beyond the prices of the offers', () => {
    const result = expectedPrice(offers(30), { registration: 2030, mileageKm: 1_000 }, 8)!;
    expect(result.expectedEur).toBeLessThanOrEqual(Math.max(...offers(30).map((p) => p.priceEur)));
  });

  it('keeps offers with the same price apart from a few others', () => {
    const prices = [5000, 5000, 5000, 5000, 5000, 5000, 4800, 5100, 5200];
    const result = expectedPrice(
      prices.map((priceEur) => ({ priceEur, registration: null, mileageKm: null })),
      { registration: null, mileageKm: null },
      8,
    );
    expect(result?.sampleSize).toBe(9);
  });

  it('gives nothing below the minimum', () => {
    expect(expectedPrice(offers(7), { registration: 2016, mileageKm: 100_000 }, 8)).toBeNull();
  });
});

describe('assessMarket', () => {
  const comparables = [11000, 12000, 13000, 14000, 15000, 16000, 17000, 18000].map((priceEur) => ({
    priceEur,
  }));
  const market = { comparables, criteria: 'Test', source: 'Test' };

  it('rates a price within the middle half of the offers as fair', () => {
    expect(assessMarket(13_000, market)).toMatchObject({
      verdict: 'fair',
      deviationPercent: -10.3,
    });
    expect(assessMarket(12_500, market)).toMatchObject({ verdict: 'good' });
    expect(assessMarket(17_000, market)).toMatchObject({ verdict: 'high' });
  });

  it('needs offers from several visitors, among those it uses', () => {
    const from = (owners: number) => ({
      ...market,
      comparables: comparables.map((comparable, i) => ({ ...comparable, owner: `v${i % owners}` })),
    });
    expect(assessMarket(13_000, from(MIN_COMPARABLE_VISITORS - 1))).toMatchObject({
      status: 'insufficient_data',
      reason: 'few_comparables',
    });
    expect(assessMarket(13_000, from(MIN_COMPARABLE_VISITORS)).status).toBe('available');
    // Five visitors, but the outliers dropped are the only offers of two of them.
    const lopsided = {
      ...market,
      comparables: [
        ...[14900, 15000, 15100].flatMap((priceEur) =>
          ['a', 'b', 'c'].map((owner) => ({ priceEur, owner })),
        ),
        { priceEur: 9_000, owner: 'd' },
        { priceEur: 9_500, owner: 'e' },
      ],
    };
    expect(assessMarket(12_000, lopsided).status).toBe('insufficient_data');
  });

  it('calls a price within the middle half never unusually low', () => {
    const wide = {
      ...market,
      comparables: [5000, 6000, 7000, 8000, 10000, 12000, 13000, 14000, 15000].map((priceEur) => ({
        priceEur,
      })),
    };
    expect(assessMarket(7_000, wide)).toMatchObject({ verdict: 'fair', unusuallyLow: false });
  });

  it('takes a valuation only when it is a price', () => {
    const valuation = (expectedEur: number, lowEur: number | null = null) =>
      assessMarket(12_000, { ...market, valuation: { expectedEur, lowEur, highEur: null } });
    expect(valuation(10_000.4, 0)).toMatchObject({
      method: 'valuation',
      expectedEur: 10_000,
      typicalLowEur: 10_000,
    });
    expect(valuation(0)).toMatchObject({ status: 'insufficient_data' });
  });
});

describe('priceVerdict', () => {
  it('uses fixed limits', () => {
    expect(priceVerdict(-15)).toBe('very_good');
    expect(priceVerdict(-14.9)).toBe('good');
    expect(priceVerdict(-5)).toBe('good');
    expect(priceVerdict(-4.9)).toBe('fair');
    expect(priceVerdict(4.9)).toBe('fair');
    expect(priceVerdict(5)).toBe('increased');
    expect(priceVerdict(14.9)).toBe('increased');
    expect(priceVerdict(15)).toBe('high');
  });

  it('takes the middle of the year when the month is unknown', () => {
    expect(decimalRegistration(2016, null)).toBeCloseTo(2016.458, 3);
    expect(decimalRegistration(2016, 1)).toBe(2016);
  });
});

describe('price advice', () => {
  const details = {
    Marke: 'VW',
    Modell: 'Golf',
    Erstzulassung: '06/2016',
    Kilometerstand: '100.000 km',
  };
  /**
   * Comparables for a 2016 car with 100,000 km at 9,000 € × `factor` (the
   * listing, from June 2016, is a little younger: about 4 % more).
   */
  const market = (factor: number) => ({
    comparables: offers(30, 9_000 * factor).map((point): MarketComparable => ({ ...point })),
    criteria: 'VW Golf',
    source: 'Test',
  });
  const advise = async (factor: number, description = '', extra: Record<string, string> = {}) =>
    (await analyze(listingFromText(pasted({ ...details, ...extra }, description)), market(factor)))
      .priceContext;

  it('says to look at the car at a fair price', async () => {
    const price = await advise(1 / 1.04);
    expect(price.market).toMatchObject({
      status: 'available',
      method: 'age_mileage',
      verdict: 'fair',
    });
    expect(price.advice).toMatchObject({
      action: 'inspect',
      title: 'Fairer Preis – ansehen lohnt sich',
    });
  });

  it('names a target price when the price is increased, and says to look further when high', async () => {
    const increased = await advise(1 / 1.15);
    expect(increased.market).toMatchObject({ verdict: 'increased' });
    expect(increased.advice?.action).toBe('negotiate');
    expect(increased.advice?.targetPriceEur).toBeGreaterThan(7_900);
    expect(increased.advice?.targetPriceEur).toBeLessThan(8_500);
    expect(increased.advice!.targetPriceEur! % 100).toBe(0);

    const high = await advise(1 / 1.3);
    expect(high.market).toMatchObject({ verdict: 'high' });
    expect(high.advice?.action).toBe('search_on');
  });

  it('asks for the reason when the price is unusually low', async () => {
    const price = await advise(1.6);
    expect(price.market).toMatchObject({ verdict: 'very_good', unusuallyLow: true });
    expect(price.advice).toMatchObject({
      action: 'caution',
      title: 'Auffällig günstig – Grund klären',
    });
  });

  it('puts warning signs of a scam before the price', async () => {
    const price = await advise(1.2, 'Zahlung nur per Vorkasse, Versand per Spedition möglich.');
    expect(price.advice?.action).toBe('caution');
    expect(price.advice?.title).toBe('Erst die Warnzeichen klären');
  });

  it('does not compare a damaged car with intact ones', async () => {
    const price = await advise(1, '', { Fahrzeugzustand: 'Beschädigt' });
    expect(price.market).toMatchObject({ status: 'insufficient_data', reason: 'not_comparable' });
    expect(price.advice).toMatchObject({
      action: 'compare',
      title: 'Kein Preisvergleich bei Schäden',
    });
    const engine = await advise(1.2, 'Motorschaden, springt aber an.');
    expect(engine.market).toMatchObject({
      reason: 'not_comparable',
      message:
        'Die Beschreibung nennt „Motorschaden“. Mit intakten Autos lässt sich der Preis nicht vergleichen.',
    });
    expect((await advise(1.2, 'Fahrzeug ist nicht fahrbereit.')).market).toMatchObject({
      reason: 'not_comparable',
    });
    for (const description of [
      'Motorschaden, TÜV neu.',
      'Motorschaden, Reifen und Bremsen neu.',
      'Motor defekt, Auto steht seit Monaten.',
      'Getriebe ist defekt.',
      'Das Auto fährt nicht.',
      'Schweller durchgerostet.',
      'Kupplung defekt, nicht fahrbereit.',
      'Turbo defekt, fährt nicht.',
      'Zylinderkopfdichtung defekt, springt nicht an.',
      'Ölverlust, fährt nicht mehr.',
      'Auto fährt nicht\nTÜV bis 2027',
      'Fährt nicht - Batterie leer?',
      'TÜV neu, Bremsen erneuert, Motorschaden.',
      'Motorschaden, Zahnriemen wurde 2023 gewechselt.',
    ])
      expect((await advise(1.2, description)).market, description).toMatchObject({
        reason: 'not_comparable',
      });
    // Negated, repaired, or wear: the comparison stays.
    for (const description of [
      'Zylinderkopfdichtung wurde 2024 erneuert.',
      'Ölverlust wurde behoben.',
      'Kupplung muss neu gemacht werden.',
      'Leichter Ölverlust, kein Motorschaden.',
      'Kein Motorschaden, aber leichter Ölverlust am Ventildeckel.',
      'Kupplung rutscht, fährt nicht mehr gut.',
      'Motorschaden, Motor wurde komplett überholt.',
      'Hatte einen Motorschaden, Austauschmotor eingebaut.',
      'Motorschaden wurde repariert.',
      'Weder Unfall noch Motorschaden.',
      'Rostloch im Schweller wurde geschweißt.',
      'Motorschaden bei 120.000 km, Motor wurde getauscht.',
      'Neuer Motor nach Motorschaden.',
      'Motor nach Motorschaden komplett überholt.',
    ])
      expect((await advise(1 / 1.04, description)).market.status, description).toBe('available');
  });

  it('keeps two kinds of damage named side by side', async () => {
    const result = await analyze(
      listingFromText(pasted(details, 'Ölverlust, fährt nicht mehr. Motor defekt.')),
      market(1),
    );
    const ids = result.observations.map((o) => o.id);
    expect(ids).toEqual(expect.arrayContaining(['damage_engine', 'damage_roadworthiness']));
    expect(ids.filter((id) => id === 'damage_general')).toEqual([]);
    for (const description of [
      'Zylinderkopfdichtung defekt.',
      'Kupplung defekt, Getriebe defekt.',
    ]) {
      const single = await analyze(listingFromText(pasted(details, description)), market(1));
      expect(
        single.observations.map((o) => o.id),
        description,
      ).not.toContain('damage_mentioned');
    }
  });

  it('warns more about a costly defect than about scratches', async () => {
    const light = await advise(1 / 1.04, 'Kleine Kratzer an der Stoßstange.');
    expect(light.advice?.text).toContain('Das Inserat nennt Mängel');
    const costly = await advise(1 / 1.04, 'Die Motorkontrollleuchte leuchtet.');
    expect(costly.advice?.text).toContain('Mangel, der teuer werden kann');
  });

  it('asks for what the listing leaves out', async () => {
    const price = (
      await analyze(
        listingFromText(
          pasted(
            { Marke: 'VW', Modell: 'Golf', Kraftstoffart: 'Benzin', Getriebe: 'Manuell' },
            '',
            'VW Golf 1.4 TSI',
          ),
        ),
        market(1),
      )
    ).priceContext;
    expect(price.market).toMatchObject({ reason: 'missing_basics' });
    expect(price.market.message).toBe(
      'KaufCheck hat im Inserat diese Angaben nicht gefunden: Erstzulassung und Kilometerstand.',
    );
    expect(price.advice?.title).toBe('Für den Preisvergleich fehlen Angaben');
  });

  it('points to the marketplaces without enough offers', async () => {
    const price = (await analyze(listingFromText(pasted(details)), null)).priceContext;
    expect(price.market).toMatchObject({ status: 'insufficient_data', reason: 'few_comparables' });
    expect(price.advice?.action).toBe('compare');
    expect(MIN_COMPARABLES).toBe(8);
  });

  it('gives no advice without a price', async () => {
    const text = pasted(details).replace('9.000 €', 'Preis auf Anfrage');
    const price = (await analyze(listingFromText(text), market(1))).priceContext;
    expect(price.market).toMatchObject({ reason: 'no_price', message: NO_PRICE_MESSAGE });
    expect(price.advice).toBeUndefined();
  });
});
