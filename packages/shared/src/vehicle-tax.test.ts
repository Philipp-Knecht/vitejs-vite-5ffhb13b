import { describe, expect, it } from 'vitest';
import { electricCarTaxEur, vehicleTax, type VehicleTaxInput } from './vehicle-tax';

const TODAY = '2026-10-14';
const car = (input: Partial<VehicleTaxInput>): VehicleTaxInput => ({
  firstRegistration: '2018-03-01',
  drive: 'petrol',
  displacementCcm: 1395,
  co2GPerKm: 120,
  emissionClass: null,
  grossWeightKg: null,
  ...input,
});
const annual = (input: Partial<VehicleTaxInput>) => {
  const result = vehicleTax(car(input), TODAY);
  if (result.kind !== 'amount') throw new Error(`no amount: ${JSON.stringify(result)}`);
  return result.annualEur;
};

describe('vehicleTax (§ 9 KraftStG)', () => {
  it('first registration from 2021: displacement plus CO₂ steps', () => {
    // Diesel 1,530 cm³ (16 × 9.50 = 152) and 165 g/km (40 + 44 + 50 + 29 = 163).
    expect(
      annual({
        firstRegistration: '2021-02-15',
        drive: 'diesel',
        displacementCcm: 1530,
        co2GPerKm: 165,
      }),
    ).toBe(315);
    // Petrol 1,498 cm³ (15 × 2 = 30) and 130 g/km (40 + 15 × 2.20 = 73).
    expect(annual({ firstRegistration: '2022-06-01', displacementCcm: 1498, co2GPerKm: 130 })).toBe(
      103,
    );
    // Up to 95 g/km no CO₂ part; above 195 g/km 4 € per gram.
    expect(annual({ firstRegistration: '2023-01-01', displacementCcm: 999, co2GPerKm: 95 })).toBe(
      20,
    );
    // 200 g/km: 40 + 44 + 50 + 58 + 68 + 5 × 4 = 280, plus 20 × 2 = 40.
    expect(annual({ firstRegistration: '2023-01-01', displacementCcm: 1984, co2GPerKm: 200 })).toBe(
      320,
    );
  });

  it('first registration July 2009 – 2020: 2 € per gram above 120, 110 or 95 g/km', () => {
    expect(annual({ firstRegistration: '2010-05-01', displacementCcm: 1390, co2GPerKm: 149 })).toBe(
      14 * 2 + 29 * 2,
    );
    expect(annual({ firstRegistration: '2013-05-01', displacementCcm: 1390, co2GPerKm: 149 })).toBe(
      14 * 2 + 39 * 2,
    );
    expect(
      annual({
        firstRegistration: '2016-05-01',
        drive: 'diesel',
        displacementCcm: 1968,
        co2GPerKm: 109,
      }),
    ).toBe(20 * 9.5 + 14 * 2);
    expect(annual({ firstRegistration: '2016-05-01', displacementCcm: 999, co2GPerKm: 90 })).toBe(
      20,
    );
  });

  it('first registration before July 2009: displacement by emission class', () => {
    expect(
      annual({
        firstRegistration: '2005-01-01',
        displacementCcm: 1598,
        co2GPerKm: null,
        emissionClass: 'euro3',
      }),
    ).toBe(Math.floor(16 * 6.75));
    expect(
      annual({
        firstRegistration: '1998-01-01',
        drive: 'diesel',
        displacementCcm: 1896,
        emissionClass: 'euro2',
      }),
    ).toBe(Math.floor(19 * 16.05));
    expect(vehicleTax(car({ firstRegistration: '2005-01-01' }), TODAY)).toEqual({
      kind: 'missing',
      fields: ['emissionClass'],
    });
  });

  it('first registration 5 Nov 2008 – 30 Jun 2009: the cheaper CO₂ rate (§ 18 Abs. 4a)', () => {
    // Class rate 16 × 6.75 = 108; CO₂ rate 16 × 2 + 0 = 32.
    expect(
      annual({
        firstRegistration: '2009-03-01',
        displacementCcm: 1598,
        co2GPerKm: 115,
        emissionClass: 'euro3',
      }),
    ).toBe(32);
    // Without a CO₂ value only the class rate can be computed.
    expect(
      annual({
        firstRegistration: '2009-03-01',
        displacementCcm: 1598,
        co2GPerKm: null,
        emissionClass: 'euro3',
      }),
    ).toBe(108);
  });

  it('rounds down to full euros (§ 11 Abs. 5)', () => {
    // 15 × 2 + 20 × 2 + 1 × 2.20 = 72.20 → 72
    expect(annual({ firstRegistration: '2021-06-01', displacementCcm: 1498, co2GPerKm: 116 })).toBe(
      72,
    );
  });

  it('asks for what is missing instead of guessing', () => {
    expect(vehicleTax(car({ displacementCcm: null, co2GPerKm: null }), TODAY)).toEqual({
      kind: 'missing',
      fields: ['displacementCcm', 'co2GPerKm'],
    });
    expect(vehicleTax(car({ firstRegistration: '2027-01-01' }), TODAY).kind).toBe('invalid');
    expect(vehicleTax(car({ firstRegistration: '2021-02-30' }), TODAY).kind).toBe('invalid');
    expect(vehicleTax(car({ displacementCcm: 20 }), TODAY).kind).toBe('invalid');
  });

  it('electric cars: exempt for ten years, at most until 2035, then by weight', () => {
    expect(
      vehicleTax(
        car({ firstRegistration: '2020-07-15', drive: 'electric', grossWeightKg: 2232 }),
        TODAY,
      ),
    ).toMatchObject({ kind: 'exempt', until: '2030-07-14', afterwardsEur: 68 });
    expect(
      vehicleTax(
        car({ firstRegistration: '2026-01-10', drive: 'electric', grossWeightKg: null }),
        TODAY,
      ),
    ).toMatchObject({ kind: 'exempt', until: '2035-12-31', afterwardsEur: null });
    // First registered before 18 May 2011: taxed by weight.
    expect(
      annual({ firstRegistration: '2011-01-10', drive: 'electric', grossWeightKg: 1500 }),
    ).toBe(Math.floor((8 * 11.25) / 2));
    // Exemption ended (2015 + 10 years).
    expect(
      vehicleTax(
        car({ firstRegistration: '2015-06-01', drive: 'electric', grossWeightKg: null }),
        TODAY,
      ),
    ).toEqual({ kind: 'missing', fields: ['grossWeightKg'] });
  });

  it('weight bands for electric cars (§ 9 Abs. 1 Nr. 3, halved)', () => {
    // 2,232 kg: 10 × 11.25 + 2 × 12.02 = 136.54 → 68.27 → 68
    expect(electricCarTaxEur(2232)).toBe(68);
    // 3,100 kg: 10 × 11.25 + 5 × 12.02 + 1 × 12.78 = 185.38 → 92
    expect(electricCarTaxEur(3100)).toBe(92);
  });
});
