import { z } from 'zod';
import { foldName } from './models';

/**
 * Engines registered in Germany per model and year, from the EEA's CO₂
 * monitoring of new passenger cars (Regulation (EU) 2019/631, CC BY 4.0).
 * One JSON file per model in data/engines, written by `npm run
 * catalog:engines`; each file is its own chunk.
 */
export const ENGINE_FUELS = [
  'petrol',
  'diesel',
  'electric',
  'hybrid',
  'hybrid_diesel',
  'plugin_hybrid',
  'plugin_hybrid_diesel',
  'lpg',
  'cng',
  'ethanol',
  'hydrogen',
] as const;
export type EngineFuel = (typeof ENGINE_FUELS)[number];

export const ENGINE_FUEL_LABELS: Record<EngineFuel, string> = {
  petrol: 'Benzin',
  diesel: 'Diesel',
  electric: 'Elektro',
  hybrid: 'Hybrid (Benzin)',
  hybrid_diesel: 'Hybrid (Diesel)',
  plugin_hybrid: 'Plug-in-Hybrid (Benzin)',
  plugin_hybrid_diesel: 'Plug-in-Hybrid (Diesel)',
  lpg: 'Autogas (LPG)',
  cng: 'Erdgas (CNG)',
  ethanol: 'Ethanol (E85)',
  hydrogen: 'Wasserstoff',
};

export const EngineRecordSchema = z.object({
  /** The year of first registration in Germany. */
  year: z.number().int(),
  fuel: z.enum(ENGINE_FUELS),
  /** Displacement in cm³; null for electric cars. */
  ccm: z.number().int().positive().nullable(),
  kw: z.number().int().positive(),
  /** Cars registered with these values in the year. */
  registrations: z.number().int().positive(),
  /** Median CO₂ in g/km after WLTP (V.7 for first registration from September 2018). */
  co2Wltp: z.number().nonnegative().nullable(),
  /** Median CO₂ in g/km after NEDC (V.7 before). */
  co2Nedc: z.number().nonnegative().nullable(),
  /** Average WLTP consumption of petrol or diesel in litres per 100 km; reported from 2021. */
  consumption: z.number().positive().nullable(),
  /** Average electric energy consumption in kWh per 100 km. */
  electricity: z.number().positive().nullable(),
});
export type EngineRecord = z.infer<typeof EngineRecordSchema>;

export const EngineFileSchema = z.object({
  /** The day the data was retrieved, „YYYY-MM-DD“. */
  retrieved: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  engines: z.array(EngineRecordSchema).min(1),
});
export type EngineFile = z.infer<typeof EngineFileSchema>;

export const ENGINE_SOURCE = {
  name: 'Europäische Umweltagentur (EEA): CO₂-Überwachung neuer Pkw',
  /** The copyright holder named on the EEA's page. */
  holder: 'Europäische Kommission, Generaldirektion Klimapolitik (GD CLIMA)',
  url: 'https://www.eea.europa.eu/en/datahub/datahubitem-view/fa8b1229-3db6-495d-b18e-9c9b3267c02b',
  licence: 'CC BY 4.0',
  licenceUrl: 'https://creativecommons.org/licenses/by/4.0/deed.de',
} as const;

const FILES = import.meta.glob<unknown>('../data/engines/*.json', { import: 'default' });

const loaders = new Map(
  Object.entries(FILES).map(([path, load]) => [path.replace(/^.*\/(.+)\.json$/, '$1'), load]),
);

export function hasEngines(modelId: string | null | undefined): boolean {
  return !!modelId && loaders.has(modelId);
}

export async function loadEngines(modelId: string): Promise<EngineFile | null> {
  const load = loaders.get(modelId);
  if (!load) return null;
  return EngineFileSchema.parse(await load());
}

export const EngineIndexSchema = z.object({
  retrieved: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Years with provisional figures only (the EEA publishes final ones a year later). */
  provisionalYears: z.array(z.number().int()),
  /** Litres per 100 km for each g/km of CO₂, to estimate years without a reported consumption. */
  consumptionPerCo2: z.object({ petrol: z.number().positive(), diesel: z.number().positive() }),
  /** Per make id, the models with engine data. */
  makes: z.record(z.string(), z.array(z.object({ id: z.string(), name: z.string() }))),
});
export type EngineIndex = z.infer<typeof EngineIndexSchema>;

/** The makes and models with engine data, loaded on demand (its own chunk). */
export async function loadEngineIndex(): Promise<EngineIndex> {
  return EngineIndexSchema.parse((await import('../data/engine-index.json')).default);
}

/** The test whose CO₂ value is in field V.7: WLTP from 1 September 2018, NEDC before. */
export const testCycle = (firstRegistration: string): 'wltp' | 'nedc' =>
  firstRegistration >= '2018-09-01' ? 'wltp' : 'nedc';

/** The CO₂ value the tax counts, or null when the EU data has none for that test. */
export function engineCo2(engine: EngineRecord, firstRegistration: string): number | null {
  return testCycle(firstRegistration) === 'wltp' ? engine.co2Wltp : engine.co2Nedc;
}

/**
 * Litres per 100 km: as reported (WLTP, from 2021), or estimated from the
 * CO₂ value of either test. Null for plug-in hybrids (their test value is far
 * below real use), gas and electric.
 */
export function engineConsumption(
  engine: EngineRecord,
  index: Pick<EngineIndex, 'consumptionPerCo2'>,
): { litres: number; estimated: boolean; cycle: 'wltp' | 'nedc' } | null {
  if (engine.consumption !== null)
    return { litres: engine.consumption, estimated: false, cycle: 'wltp' };
  const group =
    engine.fuel === 'petrol' || engine.fuel === 'hybrid'
      ? 'petrol'
      : engine.fuel === 'diesel' || engine.fuel === 'hybrid_diesel'
        ? 'diesel'
        : null;
  const cycle = engine.co2Wltp ? 'wltp' : 'nedc';
  const co2 = engine.co2Wltp ?? engine.co2Nedc;
  if (!group || !co2) return null;
  return {
    litres: Math.round(co2 * index.consumptionPerCo2[group] * 10) / 10,
    estimated: true,
    cycle,
  };
}

/** An engine of a model as „fuel|ccm|kW“. */
export const engineKey = (engine: Pick<EngineRecord, 'fuel' | 'ccm' | 'kw'>) =>
  `${engine.fuel}|${engine.ccm ?? ''}|${engine.kw}`;

/** The first and the last year of a model in the data. */
export function engineYears(
  engines: readonly EngineRecord[],
): { first: number; last: number } | null {
  if (engines.length === 0) return null;
  const years = engines.map((engine) => engine.year);
  return { first: Math.min(...years), last: Math.max(...years) };
}

/**
 * The year whose engines fit a first registration: the year itself, else the
 * last year of the model for a newer car (a model built on, or not yet in the
 * data). Null without a plausible year or for a year the model has no data for.
 */
export function engineYear(
  engines: readonly EngineRecord[],
  firstRegistration: string,
  currentYear: number,
): number | null {
  const year = Number(firstRegistration.slice(0, 4));
  const range = engineYears(engines);
  if (!range || !Number.isInteger(year) || year < 1990 || year > currentYear) return null;
  if (year > range.last) return range.last;
  return engines.some((engine) => engine.year === year) ? year : null;
}

/** The engines of a year, the most registered first. */
export const enginesOfYear = (engines: readonly EngineRecord[], year: number) =>
  engines
    .filter((engine) => engine.year === year)
    .sort((a, b) => b.registrations - a.registrations);

/** The model a link names: a model id of the index, or a model name of the make. */
export function findIndexModel(
  index: Pick<EngineIndex, 'makes'>,
  makeId: string,
  model: string,
): { makeId: string; modelId: string } | null {
  const folded = foldName(model);
  for (const [make, models] of Object.entries(index.makes)) {
    if (make !== makeId) continue;
    const found =
      models.find((entry) => entry.id === model) ??
      models.find((entry) => foldName(entry.name) === folded);
    if (found) return { makeId: make, modelId: found.id };
  }
  return null;
}

/** The drive for the Kfz-Steuer: spark ignition, compression ignition or electric. */
export function engineTaxDrive(fuel: EngineFuel): 'petrol' | 'diesel' | 'electric' {
  if (fuel === 'electric' || fuel === 'hydrogen') return 'electric';
  return fuel.includes('diesel') ? 'diesel' : 'petrol';
}

/**
 * „1,5 l Benzin, 110 kW (150 PS)“; with the exact displacement where two
 * engines of a list would read the same („1,4 l (1.364 cm³) Benzin, …“).
 */
export function engineLabels(engines: readonly EngineRecord[]): Map<string, string> {
  const short = (engine: EngineRecord, exact: boolean) => {
    const ps = Math.round(engine.kw / 0.73549875);
    const litres =
      engine.ccm === null
        ? ''
        : `${(Math.round(engine.ccm / 100) / 10).toLocaleString('de-DE', { minimumFractionDigits: 1 })} l ${
            exact ? `(${engine.ccm.toLocaleString('de-DE')} cm³) ` : ''
          }`;
    return `${litres}${ENGINE_FUEL_LABELS[engine.fuel]}, ${engine.kw} kW (${ps} PS)`;
  };
  const counts = new Map<string, number>();
  for (const engine of engines) {
    const label = short(engine, false);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return new Map(
    engines.map((engine) => {
      const label = short(engine, false);
      return [engineKey(engine), (counts.get(label) ?? 0) > 1 ? short(engine, true) : label];
    }),
  );
}
