/**
 * Annual motor vehicle tax (Kfz-Steuer) for passenger cars in Germany, after
 * the Kraftfahrzeugsteuergesetz (KraftStG) as of October 2026:
 * § 9 Abs. 1 Nr. 2 (rates), § 9 Abs. 2 with Nr. 3 (electric cars by weight),
 * § 3d (exemption of electric cars), § 18 Abs. 4a (cheaper rate for cars first
 * registered 5 Nov 2008 – 30 Jun 2009) and § 11 Abs. 5 (rounded down to
 * full euros). The binding amount is set by the Hauptzollamt.
 */

/** `petrol` covers every spark-ignition engine: petrol, LPG, CNG and their hybrids. */
export type TaxDrive = 'petrol' | 'diesel' | 'electric';

/**
 * Emission class for cars first registered before 1 July 2009 (§ 9 Abs. 1
 * Nr. 2 a aa–ee). `ozoneExempt`: not low-emission, but exempt from the former
 * ozone driving ban (dd); `older`: none of these (ee, the highest rate).
 */
export type TaxEmissionClass = 'euro3' | 'euro2' | 'euro1' | 'ozoneExempt' | 'older';

export interface VehicleTaxInput {
  /** Date of first registration, „YYYY-MM-DD“ (Fahrzeugschein, field B). */
  firstRegistration: string;
  drive: TaxDrive;
  /** Displacement in cm³ (field P.1). */
  displacementCcm: number | null;
  /** CO₂ emissions in g/km (field V.7). */
  co2GPerKm: number | null;
  /** Only for first registration before 1 July 2009. */
  emissionClass: TaxEmissionClass | null;
  /** Permissible gross weight in kg (field F.2), only for electric cars. */
  grossWeightKg: number | null;
}

export interface VehicleTaxPart {
  label: string;
  amountEur: number;
}

export type VehicleTaxField =
  'firstRegistration' | 'displacementCcm' | 'co2GPerKm' | 'emissionClass' | 'grossWeightKg';

export type VehicleTaxResult =
  | {
      kind: 'amount';
      /** Annual tax, rounded down to full euros. */
      annualEur: number;
      parts: VehicleTaxPart[];
      rule: string;
    }
  | {
      kind: 'exempt';
      /** Last day of the exemption, „YYYY-MM-DD“. */
      until: string;
      /** Annual tax afterwards, if the gross weight is known. */
      afterwardsEur: number | null;
      rule: string;
    }
  | { kind: 'missing'; fields: VehicleTaxField[]; note?: string }
  | { kind: 'invalid'; field: VehicleTaxField; message: string };

/** Rates per 100 cm³ for first registration before 1 July 2009: [petrol, diesel]. */
const RATES_BEFORE_JULY_2009: Readonly<Record<TaxEmissionClass, readonly [number, number]>> = {
  euro3: [6.75, 15.44], // aa: limits of Directive 70/220/EEC as amended (Euro 3 and later)
  euro2: [7.36, 16.05], // bb: Directive 94/12/EC (Euro 2)
  euro1: [15.13, 27.35], // cc: low-emission or conditionally low-emission level C (Euro 1)
  ozoneExempt: [21.07, 33.29], // dd: not low-emission, no ozone driving ban
  older: [25.36, 37.58], // ee: none of the above
};

/** CO₂ steps for first registration from 2021: [upper limit in g/km, euros per gram]. */
const CO2_STEPS_FROM_2021: readonly (readonly [number, number])[] = [
  [115, 2.0],
  [135, 2.2],
  [155, 2.5],
  [175, 2.9],
  [195, 3.4],
  [Infinity, 4.0],
];

/** Electric cars after the exemption: euros per started 200 kg within each weight band. */
const WEIGHT_BANDS: readonly (readonly [number, number])[] = [
  [2000, 11.25],
  [3000, 12.02],
  [3500, 12.78],
];

const cents = (value: number) => Math.round(value * 100) / 100;
const euro = (value: number) => `${value.toFixed(2).replace('.', ',')} €`;
const day = (iso: string) => iso.split('-').reverse().join('.');

function displacementPart(ccm: number, rate: number, drive: TaxDrive): VehicleTaxPart {
  const units = Math.ceil(ccm / 100);
  const engine = drive === 'diesel' ? 'Diesel' : 'Benziner';
  return {
    label: `Hubraum: ${units} × ${euro(rate)} je angefangene 100 cm³ (${engine})`,
    amountEur: cents(units * rate),
  };
}

/** Only full grams count („jedes Gramm, das … überschreitet“). */
const grams = (co2: number) => Math.floor(co2);

/** CO₂ part for first registration 1 July 2009 – 31 December 2020: 2 € per gram above the limit. */
function co2PartUntil2020(co2: number, limit: number): VehicleTaxPart {
  const over = Math.max(0, grams(co2) - limit);
  return {
    label:
      over > 0
        ? `CO₂: ${over} g/km über ${limit} g/km × 2,00 €`
        : `CO₂: bis ${limit} g/km steuerfrei`,
    amountEur: over * 2,
  };
}

function co2PartFrom2021(co2: number): VehicleTaxPart {
  const value = grams(co2);
  let amount = 0;
  let lower = 95;
  const steps: string[] = [];
  for (const [upper, rate] of CO2_STEPS_FROM_2021) {
    if (value <= lower) break;
    const inStep = Math.min(value, upper) - lower;
    amount += inStep * rate;
    steps.push(`${inStep} g × ${euro(rate)}`);
    lower = upper;
  }
  return {
    label: value > 95 ? `CO₂ über 95 g/km: ${steps.join(' + ')}` : 'CO₂: bis 95 g/km steuerfrei',
    amountEur: cents(amount),
  };
}

/** Started 200 kg units of the gross weight, counted within each weight band. */
function weightUnits(grossWeightKg: number): { units: number; amount: number } {
  let units = 0;
  let amount = 0;
  let lower = 0;
  for (const [upper, rate] of WEIGHT_BANDS) {
    if (grossWeightKg <= lower) break;
    const bandUnits = Math.ceil((Math.min(grossWeightKg, upper) - lower) / 200);
    units += bandUnits;
    amount += bandUnits * rate;
    lower = upper;
  }
  return { units, amount };
}

/** Weight-based tax of an electric car after the exemption, halved (§ 9 Abs. 2). */
export function electricCarTaxEur(grossWeightKg: number): number {
  return Math.floor(cents(weightUnits(grossWeightKg).amount / 2));
}

function sum(parts: VehicleTaxPart[]): number {
  return Math.floor(cents(parts.reduce((total, part) => total + part.amountEur, 0)));
}

function addYears(isoDay: string, years: number): string {
  const [year, month, dayOfMonth] = isoDay.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year + years, month - 1, dayOfMonth));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/** A real calendar day (no 30 February). */
function isIsoDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/**
 * Annual tax of a passenger car. `today` decides whether an electric car is
 * still exempt. Returns which fields are missing instead of guessing.
 */
export function vehicleTax(input: VehicleTaxInput, today: string): VehicleTaxResult {
  const { firstRegistration: ez, drive } = input;
  if (!isIsoDay(ez) || ez > today) {
    return {
      kind: 'invalid',
      field: 'firstRegistration',
      message: 'Bitte gib ein gültiges Datum der Erstzulassung an.',
    };
  }
  if (ez < '1950-01-01') {
    return {
      kind: 'invalid',
      field: 'firstRegistration',
      message: 'Erstzulassungen vor 1950 rechnet dieser Rechner nicht – frag das Hauptzollamt.',
    };
  }

  if (drive === 'electric') {
    const weight = input.grossWeightKg;
    if (weight !== null && (weight < 400 || weight > 3500)) {
      return {
        kind: 'invalid',
        field: 'grossWeightKg',
        message:
          weight > 3500
            ? 'Über 3.500 kg rechnet dieser Rechner nicht – frag das Hauptzollamt.'
            : 'Bitte prüfe das zulässige Gesamtgewicht (Feld F.2).',
      };
    }
    const afterwards = weight === null ? null : electricCarTaxEur(weight);
    let ended: string | null = null;
    if (ez >= '2011-05-18' && ez <= '2030-12-31') {
      const tenYears = addYears(ez, 10);
      const until = tenYears < '2035-12-31' ? tenYears : '2035-12-31';
      if (today <= until) {
        return {
          kind: 'exempt',
          until,
          afterwardsEur: afterwards,
          rule: '§ 3d KraftStG: Elektroautos mit Erstzulassung vom 18.05.2011 bis 31.12.2030 sind zehn Jahre ab Erstzulassung steuerfrei, längstens bis 31.12.2035. Die Befreiung geht beim Halterwechsel auf dich über.',
        };
      }
      ended = until;
    }
    if (weight === null) {
      return {
        kind: 'missing',
        fields: ['grossWeightKg'],
        ...(ended ? { note: `Die Steuerbefreiung endete am ${day(ended)}.` } : {}),
      };
    }
    return {
      kind: 'amount',
      annualEur: afterwards!,
      parts: [
        {
          label: `Gewicht: ${weightUnits(weight).units} × je angefangene 200 kg, davon 50 %`,
          amountEur: cents(weightUnits(weight).amount / 2),
        },
      ],
      rule: '§ 9 Abs. 1 Nr. 3 und Abs. 2 KraftStG: Elektroautos zahlen nach dem Gesamtgewicht, um 50 % ermäßigt.',
    };
  }

  const missing: VehicleTaxField[] = [];
  const ccm = input.displacementCcm;
  const co2 = input.co2GPerKm;
  if (ccm === null) missing.push('displacementCcm');
  if (ccm !== null && (ccm < 50 || ccm > 10_000)) {
    return {
      kind: 'invalid',
      field: 'displacementCcm',
      message: 'Der Hubraum liegt zwischen 50 und 10.000 cm³.',
    };
  }
  if (co2 !== null && (co2 < 0 || co2 > 1000)) {
    return {
      kind: 'invalid',
      field: 'co2GPerKm',
      message: 'Der CO₂-Wert liegt zwischen 0 und 1.000 g/km.',
    };
  }
  const column = drive === 'diesel' ? 1 : 0;

  if (ez < '2009-07-01') {
    if (!input.emissionClass) missing.push('emissionClass');
    // § 18 Abs. 4a: the cheaper CO₂ tariff needs the CO₂ value.
    if (ez >= '2008-11-05' && co2 === null) missing.push('co2GPerKm');
    if (missing.length > 0) return { kind: 'missing', fields: missing };
    const rate = RATES_BEFORE_JULY_2009[input.emissionClass!][column];
    const before = [displacementPart(ccm!, rate, drive)];
    if (ez >= '2008-11-05') {
      const after = [displacementPart(ccm!, column ? 9.5 : 2, drive), co2PartUntil2020(co2!, 120)];
      if (sum(after) < sum(before)) {
        return {
          kind: 'amount',
          annualEur: sum(after),
          parts: after,
          rule: '§ 18 Abs. 4a KraftStG: Für Erstzulassungen vom 05.11.2008 bis 30.06.2009 gilt der günstigere CO₂-Tarif.',
        };
      }
    }
    return {
      kind: 'amount',
      annualEur: sum(before),
      parts: before,
      rule: '§ 9 Abs. 1 Nr. 2 a KraftStG: Erstzulassung bis 30.06.2009, Steuer nach Hubraum und Schadstoffklasse.',
    };
  }

  if (co2 === null) missing.push('co2GPerKm');
  if (missing.length > 0) return { kind: 'missing', fields: missing };
  const displacement = displacementPart(ccm!, column ? 9.5 : 2, drive);

  if (ez < '2021-01-01') {
    const limit = ez < '2012-01-01' ? 120 : ez < '2014-01-01' ? 110 : 95;
    const parts = [displacement, co2PartUntil2020(co2!, limit)];
    return {
      kind: 'amount',
      annualEur: sum(parts),
      parts,
      rule: `§ 9 Abs. 1 Nr. 2 b KraftStG: Erstzulassung vom 01.07.2009 bis 31.12.2020, CO₂ über ${limit} g/km kostet 2 € je Gramm.`,
    };
  }

  const parts = [displacement, co2PartFrom2021(co2!)];
  return {
    kind: 'amount',
    annualEur: sum(parts),
    parts,
    rule: '§ 9 Abs. 1 Nr. 2 c KraftStG: Erstzulassung ab 01.01.2021, CO₂ über 95 g/km gestaffelt von 2 € bis 4 € je Gramm.',
  };
}
