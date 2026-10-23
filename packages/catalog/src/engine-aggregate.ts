/**
 * Turns rows of the EEA's CO₂ monitoring data (see scripts/fetch-engines.ts)
 * into one record per year and engine: the typical (median) CO₂ value and the
 * average consumption of the cars registered in Germany.
 */
import type { EngineFuel, EngineRecord } from './engines';

/** One row of the query: cars with the same values, counted. */
export interface RawEngineRow {
  mk: string | null;
  cn: string | null;
  ft: string | null;
  fm: string | null;
  ccm: number | null;
  kw: number | null;
  y: number;
  /** CO₂ in g/km after WLTP. */
  w: number | null;
  /** CO₂ in g/km after NEDC. */
  e: number | null;
  n: number;
  /** Fuel consumption in l/100 km (kg for gas), reported from 2021. */
  fc: number | null;
  /** Electric energy consumption in Wh/km. */
  z: number | null;
}

/** Fewer registrations are left out: too few for a typical value. */
export const MIN_REGISTRATIONS = 10;

/** Fuels whose consumption is given and estimated: litres of petrol or diesel. */
const LIQUID_FUELS: ReadonlySet<EngineFuel> = new Set([
  'petrol',
  'diesel',
  'hybrid',
  'hybrid_diesel',
]);

/**
 * Plug-in hybrids before 2019 (fuel mode „M“) are told apart from hybrids by
 * their electric consumption or a CO₂ value up to 100 g/km; above 120 g/km no
 * car is a plug-in hybrid, whatever its fuel mode says.
 */
const PLUGIN_LIKELY_CO2 = 100;
const PLUGIN_MAX_CO2 = 120;

/** „999 kW“ and more stand for a missing figure. */
const MAX_KW = 998;

/** A typical value needs this share of the registrations to have it. */
const MIN_COVERAGE = 0.5;

export function engineFuel(
  row: Pick<RawEngineRow, 'ft' | 'fm' | 'w' | 'e'> & { z?: number | null },
): EngineFuel | null {
  const ft = (row.ft ?? '').toUpperCase();
  const fm = (row.fm ?? '').toUpperCase();
  const diesel = ft.includes('DIESEL');
  if (ft.includes('ELECTRIC') && (diesel || ft.includes('PETROL'))) {
    const co2 = row.w ?? row.e;
    const plugin =
      (co2 === null || co2 <= PLUGIN_MAX_CO2) &&
      (fm === 'P' ||
        (fm !== 'H' && ((row.z ?? 0) > 0 || (co2 !== null && co2 <= PLUGIN_LIKELY_CO2))));
    if (plugin) return diesel ? 'plugin_hybrid_diesel' : 'plugin_hybrid';
    return diesel ? 'hybrid_diesel' : 'hybrid';
  }
  if (ft === 'PETROL PHEV') return 'plugin_hybrid';
  if (ft === 'ELECTRIC') return 'electric';
  if (ft === 'HYDROGEN') return 'hydrogen';
  if (ft === 'LPG') return 'lpg';
  if (ft === 'NG' || ft === 'CNG' || ft === 'NG-BIOMETHANE') return 'cng';
  if (ft === 'E85') return 'ethanol';
  if (ft === 'DIESEL') return fm === 'H' ? 'hybrid_diesel' : 'diesel';
  if (ft === 'PETROL') return fm === 'H' ? 'hybrid' : 'petrol';
  return null;
}

/** The value that half of the cars are below and half above. */
function median(values: [value: number, count: number][]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a[0] - b[0]);
  const total = sorted.reduce((sum, [, count]) => sum + count, 0);
  let seen = 0;
  for (const [value, count] of sorted) {
    seen += count;
    if (seen * 2 >= total) return value;
  }
  return sorted.at(-1)![0];
}

function mean(values: [value: number, count: number][]): number | null {
  const total = values.reduce((sum, [, count]) => sum + count, 0);
  if (total === 0) return null;
  return values.reduce((sum, [value, count]) => sum + value * count, 0) / total;
}

const round1 = (value: number | null) => (value === null ? null : Math.round(value * 10) / 10);

export function aggregateEngines(rows: readonly RawEngineRow[]): EngineRecord[] {
  const groups = new Map<string, { record: EngineRecord; rows: RawEngineRow[] }>();
  for (const row of rows) {
    const fuel = engineFuel(row);
    if (!fuel || row.n <= 0) continue;
    const electric = fuel === 'electric' || fuel === 'hydrogen';
    const ccm = electric ? null : row.ccm;
    // A combustion engine without displacement or any car without power is no usable engine.
    if ((!electric && !ccm) || !row.kw || row.kw > MAX_KW) continue;
    const key = `${row.y}|${fuel}|${ccm}|${row.kw}`;
    const group = groups.get(key) ?? {
      record: {
        year: row.y,
        fuel,
        ccm,
        kw: row.kw,
        registrations: 0,
        co2Wltp: null,
        co2Nedc: null,
        consumption: null,
        electricity: null,
      },
      rows: [],
    };
    group.record.registrations += row.n;
    group.rows.push(row);
    groups.set(key, group);
  }

  const records: EngineRecord[] = [];
  for (const { record, rows: groupRows } of groups.values()) {
    if (record.registrations < MIN_REGISTRATIONS) continue;
    const electric = record.fuel === 'electric' || record.fuel === 'hydrogen';
    // Only values that enough of the cars have: a few cars with a value are no typical one.
    const pick = (value: (row: RawEngineRow) => number | null, positive: boolean) => {
      const values = groupRows.flatMap((row): [number, number][] => {
        const v = value(row);
        return v !== null && (positive ? v > 0 : v >= 0) ? [[v, row.n]] : [];
      });
      const covered = values.reduce((sum, [, count]) => sum + count, 0);
      return covered >= MIN_REGISTRATIONS && covered >= record.registrations * MIN_COVERAGE
        ? values
        : [];
    };
    record.co2Wltp = electric ? null : median(pick((row) => row.w, true));
    record.co2Nedc = electric ? null : median(pick((row) => row.e, true));
    // WLTP is the stricter test: a WLTP value well below the NEDC one is a reporting error.
    if (
      record.co2Wltp !== null &&
      record.co2Nedc !== null &&
      record.co2Wltp < record.co2Nedc * 0.95
    )
      record.co2Wltp = null;
    // Only petrol and diesel: gas is reported in m³ and bi-fuel cars with their petrol CO₂ value.
    record.consumption = LIQUID_FUELS.has(record.fuel)
      ? round1(mean(pick((row) => row.fc, true)))
      : null;
    record.electricity = round1(mean(pick((row) => (row.z === null ? null : row.z / 10), true)));
    records.push(record);
  }
  return records.sort(
    (a, b) =>
      a.year - b.year ||
      a.fuel.localeCompare(b.fuel) ||
      (a.kw ?? 0) - (b.kw ?? 0) ||
      (a.ccm ?? 0) - (b.ccm ?? 0),
  );
}

/**
 * Litres of petrol or diesel per 100 km for each g/km of CO₂, from the cars
 * that report both values (from 2021): burning a litre of a fuel gives a fixed
 * amount of CO₂, so earlier years can be estimated from their CO₂ value.
 */
export function consumptionPerCo2(rows: readonly RawEngineRow[]): Record<string, number> {
  const sums = new Map<string, { fc: number; co2: number }>();
  for (const row of rows) {
    const fuel = engineFuel(row);
    if (!fuel || !LIQUID_FUELS.has(fuel)) continue;
    if (row.fc === null || row.fc <= 0 || row.w === null || row.w <= 0) continue;
    const group = fuel === 'hybrid' ? 'petrol' : fuel === 'hybrid_diesel' ? 'diesel' : fuel;
    const sum = sums.get(group) ?? { fc: 0, co2: 0 };
    sum.fc += row.fc * row.n;
    sum.co2 += row.w * row.n;
    sums.set(group, sum);
  }
  return Object.fromEntries(
    [...sums]
      .filter(([, sum]) => sum.co2 > 0)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([group, sum]) => [group, Math.round((sum.fc / sum.co2) * 100_000) / 100_000]),
  );
}
