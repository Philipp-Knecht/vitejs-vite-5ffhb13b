import type { FuelType } from './labels';

/**
 * Monthly costs of a car from the buyer's own figures, in blocks modelled on
 * the ADAC's cost comparisons: depreciation, fuel or electricity, tax,
 * insurance and workshop costs. KaufCheck has no price data, so nothing is
 * assumed: a block without figures is left out and named.
 */

/** What a car runs on, for the unit and the shared price. */
export const ENERGY_GROUPS = [
  'petrol',
  'diesel',
  'electric',
  'lpg',
  'cng',
  'hydrogen',
  'ethanol',
  'pluginHybrid',
  'pluginHybridDiesel',
] as const;
export type EnergyGroup = (typeof ENERGY_GROUPS)[number];
/** Plug-in hybrids use fuel and electricity. */
export const PLUGIN_HYBRIDS = { pluginHybrid: 'petrol', pluginHybridDiesel: 'diesel' } as const;
type PluginHybrid = keyof typeof PLUGIN_HYBRIDS;
export const isPluginHybrid = (group: EnergyGroup | null | ''): group is PluginHybrid =>
  group === 'pluginHybrid' || group === 'pluginHybridDiesel';
/** What has a price per unit. */
export type PriceGroup = Exclude<EnergyGroup, PluginHybrid>;

export const ENERGY_GROUP_LABELS: Record<EnergyGroup, string> = {
  petrol: 'Benzin',
  diesel: 'Diesel',
  electric: 'Strom',
  lpg: 'Autogas (LPG)',
  cng: 'Erdgas (CNG)',
  hydrogen: 'Wasserstoff',
  ethanol: 'Ethanol (E85)',
  pluginHybrid: 'Plug-in-Hybrid (Benzin und Strom)',
  pluginHybridDiesel: 'Plug-in-Hybrid (Diesel und Strom)',
};

/** The prices a car needs. */
export const PRICES_NEEDED: Record<EnergyGroup, readonly PriceGroup[]> = {
  petrol: ['petrol'],
  diesel: ['diesel'],
  electric: ['electric'],
  lpg: ['lpg'],
  cng: ['cng'],
  hydrogen: ['hydrogen'],
  ethanol: ['ethanol'],
  pluginHybrid: ['petrol', 'electric'],
  pluginHybridDiesel: ['diesel', 'electric'],
};

/** The unit a price and a consumption per 100 km refer to. */
export const ENERGY_UNITS: Record<PriceGroup, 'l' | 'kWh' | 'kg'> = {
  petrol: 'l',
  diesel: 'l',
  electric: 'kWh',
  lpg: 'l',
  cng: 'kg',
  hydrogen: 'kg',
  ethanol: 'l',
};

/**
 * The group of a fuel from a listing; null where it is not clear: „Andere“,
 * and (plug-in) hybrids, which can have a petrol or a diesel engine.
 */
export function energyGroup(fuel: FuelType | null | undefined): EnergyGroup | null {
  switch (fuel) {
    case 'petrol':
      return 'petrol';
    case 'diesel':
    case 'electric':
    case 'lpg':
    case 'cng':
    case 'hydrogen':
    case 'ethanol':
      return fuel;
    default:
      return null;
  }
}

export interface SharedCostAssumptions {
  kmPerYear: number | null;
  /** Price per unit (€/l, €/kWh, €/kg) for each energy group. */
  prices: Partial<Record<PriceGroup, number>>;
  /** Years the buyer plans to keep the car, for the depreciation. */
  years: number | null;
}

export interface CarCostFigures {
  energy: EnergyGroup | null;
  /** Units per 100 km; for a plug-in hybrid the litres of fuel. */
  consumption: number | null;
  /** Only a plug-in hybrid: kWh per 100 km, both averaged over all trips. */
  electricConsumption: number | null;
  taxPerYear: number | null;
  insurancePerYear: number | null;
  /** Inspections, wear parts, tyres and repairs. */
  workshopPerYear: number | null;
  /** E.g. care, parking, a club membership. */
  otherPerYear: number | null;
  purchasePrice: number | null;
  /** What the buyer expects to get for the car at the end. */
  resaleValue: number | null;
  /** Interest of a loan spread over its term (see `loan`); null without financing. */
  loanInterestPerMonth?: number | null;
}

export const COST_PARTS = [
  'depreciation',
  'energy',
  'tax',
  'insurance',
  'workshop',
  'other',
] as const;
export type CostPart = (typeof COST_PARTS)[number];

export const COST_PART_LABELS: Record<CostPart, string> = {
  depreciation: 'Wertverlust',
  energy: 'Kraftstoff oder Strom',
  tax: 'Kfz-Steuer',
  insurance: 'Versicherung',
  workshop: 'Werkstatt und Reifen',
  other: 'Sonstiges',
};

export interface MonthlyCosts {
  /** Euros per month for each part; null where figures are missing. */
  parts: Record<CostPart, number | null>;
  /** The sum of the known parts, rounded to whole euros. */
  totalEur: number;
  /** Parts without figures. */
  missing: CostPart[];
  /** Interest of a financing per month; null without. The repayment is no cost: it is the price. */
  interest: number | null;
}

const perMonth = (perYear: number | null) => (perYear === null ? null : perYear / 12);

/** Monthly costs of one car; rounded per part so that the parts add up to the total. */
export function monthlyCosts(figures: CarCostFigures, shared: SharedCostAssumptions): MonthlyCosts {
  let energy: number | null = null;
  if (figures.energy && shared.kmPerYear !== null) {
    let per100: number | null = null;
    if (isPluginHybrid(figures.energy)) {
      const fuelPrice = shared.prices[PLUGIN_HYBRIDS[figures.energy]];
      if (
        figures.consumption !== null &&
        figures.electricConsumption !== null &&
        fuelPrice !== undefined &&
        shared.prices.electric !== undefined
      )
        per100 =
          figures.consumption * fuelPrice + figures.electricConsumption * shared.prices.electric;
    } else {
      const price = shared.prices[figures.energy];
      if (figures.consumption !== null && price !== undefined) per100 = figures.consumption * price;
    }
    if (per100 !== null) energy = (shared.kmPerYear / 100) * per100;
  }
  const depreciation =
    figures.purchasePrice !== null &&
    figures.resaleValue !== null &&
    shared.years !== null &&
    shared.years > 0 &&
    figures.resaleValue <= figures.purchasePrice
      ? (figures.purchasePrice - figures.resaleValue) / (shared.years * 12)
      : null;
  const raw: Record<CostPart, number | null> = {
    depreciation,
    energy: perMonth(energy),
    tax: perMonth(figures.taxPerYear),
    insurance: perMonth(figures.insurancePerYear),
    workshop: perMonth(figures.workshopPerYear),
    other: perMonth(figures.otherPerYear),
  };
  const parts = Object.fromEntries(
    COST_PARTS.map((part) => [part, raw[part] === null ? null : Math.round(raw[part])]),
  ) as Record<CostPart, number | null>;
  const interest =
    figures.loanInterestPerMonth === undefined || figures.loanInterestPerMonth === null
      ? null
      : Math.round(figures.loanInterestPerMonth);
  return {
    parts,
    totalEur: COST_PARTS.reduce((sum, part) => sum + (parts[part] ?? 0), 0) + (interest ?? 0),
    missing: COST_PARTS.filter((part) => parts[part] === null),
    interest,
  };
}

/**
 * The cheapest car, only when every car has figures for the same parts –
 * otherwise a lower total may just mean missing figures.
 */
export function cheapestCar(costs: readonly MonthlyCosts[]): number | null {
  if (costs.length < 2) return null;
  const key = (cost: MonthlyCosts) => cost.missing.join(',');
  if (costs.some((cost) => key(cost) !== key(costs[0]!))) return null;
  if (costs[0]!.missing.length === COST_PARTS.length) return null;
  let best = 0;
  costs.forEach((cost, index) => {
    if (cost.totalEur < costs[best]!.totalEur) best = index;
  });
  return costs.filter((cost) => cost.totalEur === costs[best]!.totalEur).length > 1 ? null : best;
}
