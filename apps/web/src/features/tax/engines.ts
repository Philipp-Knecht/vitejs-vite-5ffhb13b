import {
  engineCo2,
  engineConsumption,
  engineTaxDrive,
  loadEngineIndex,
  loadEngines,
  type EngineIndex,
  type EngineRecord,
} from '@kaufcheck/catalog/engines';
import { foldName } from '@kaufcheck/catalog';
import { useQuery } from '@tanstack/react-query';

/** What the engine picker holds: ids, and the engine as „fuel|ccm|kW“. */
export interface EnginePick {
  makeId: string;
  modelId: string;
  engineKey: string;
}

export const NO_PICK: EnginePick = { makeId: '', modelId: '', engineKey: '' };

export const engineKey = (engine: Pick<EngineRecord, 'fuel' | 'ccm' | 'kw'>) =>
  `${engine.fuel}|${engine.ccm ?? ''}|${engine.kw}`;

export function useEngineIndex() {
  return useQuery({ queryKey: ['engine-index'], queryFn: loadEngineIndex, staleTime: Infinity });
}

export function useModelEngines(modelId: string) {
  return useQuery({
    queryKey: ['engines', modelId],
    queryFn: () => loadEngines(modelId),
    enabled: modelId !== '',
    staleTime: Infinity,
  });
}

/**
 * The year whose engines fit a first registration: the year itself, else the
 * newest year in the data for a newer car. Null before the first year.
 */
export function engineYear(
  engines: readonly EngineRecord[],
  firstRegistration: string,
): number | null {
  const year = Number(firstRegistration.slice(0, 4));
  if (!year || engines.length === 0) return null;
  const years = engines.map((engine) => engine.year);
  const newest = Math.max(...years);
  if (year > newest) return newest;
  return years.includes(year) ? year : null;
}

/** The engines of a year, the most registered first. */
export const enginesOfYear = (engines: readonly EngineRecord[], year: number) =>
  engines
    .filter((engine) => engine.year === year)
    .sort((a, b) => b.registrations - a.registrations);

/** The model a link names: a model id of the index, or a model name of the make. */
export function findIndexModel(
  index: EngineIndex,
  makeId: string,
  model: string,
): { makeId: string; modelId: string } | null {
  for (const [make, models] of Object.entries(index.makes)) {
    if (makeId && make !== makeId) continue;
    const found =
      models.find((entry) => entry.id === model) ??
      models.find((entry) => foldName(entry.name) === foldName(model));
    if (found) return { makeId: make, modelId: found.id };
  }
  return null;
}

/** The fields of the tax calculator and the consumption for the running costs. */
export function engineValues(engine: EngineRecord, firstRegistration: string, index: EngineIndex) {
  const co2 = engineCo2(engine, firstRegistration);
  const consumption = engineConsumption(engine, index);
  const electric = engine.fuel === 'electric' || engine.fuel === 'hydrogen';
  return {
    drive: engineTaxDrive(engine.fuel),
    displacementCcm: engine.ccm === null ? '' : String(engine.ccm),
    co2GPerKm: co2 === null ? '' : String(Math.round(co2)),
    consumption: electric
      ? engine.electricity === null
        ? null
        : { value: engine.electricity, estimated: false, unit: 'kWh' as const }
      : consumption && {
          value: consumption.litres,
          estimated: consumption.estimated,
          unit: 'l' as const,
        },
  };
}
