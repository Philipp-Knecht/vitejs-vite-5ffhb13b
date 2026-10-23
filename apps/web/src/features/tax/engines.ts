import {
  engineCo2,
  engineConsumption,
  engineTaxDrive,
  loadEngineIndex,
  loadEngines,
  testCycle,
  type EngineIndex,
  type EngineRecord,
} from '@kaufcheck/catalog/engines';
import { useQuery } from '@tanstack/react-query';
import type { TaxFormValues } from './form';
import type { ConsumptionSuggestion } from './RunningCosts';

/** What the engine picker holds: ids, and the engine as „fuel|ccm|kW“. */
export interface EnginePick {
  makeId: string;
  modelId: string;
  engineKey: string;
}

export const NO_PICK: EnginePick = { makeId: '', modelId: '', engineKey: '' };

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

/** The tax fields an engine fills. */
export type EngineFields = Pick<TaxFormValues, 'drive' | 'displacementCcm' | 'co2GPerKm'>;

export const NO_FIELDS: EngineFields = { drive: '', displacementCcm: '', co2GPerKm: '' };

/** The fields of the tax calculator (empty where the data has no value) and the consumption. */
export function engineValues(
  engine: EngineRecord,
  firstRegistration: string,
  index: EngineIndex,
): { fields: EngineFields; consumption: Omit<ConsumptionSuggestion, 'replace'> | null } {
  const co2 = engineCo2(engine, firstRegistration);
  const electric = engine.fuel === 'electric' || engine.fuel === 'hydrogen';
  const consumption = engineConsumption(engine, index);
  return {
    fields: {
      drive: engineTaxDrive(engine.fuel),
      displacementCcm: engine.ccm === null ? '' : String(engine.ccm),
      co2GPerKm: electric || co2 === null ? '' : String(Math.round(co2)),
    },
    consumption: electric
      ? engine.electricity === null
        ? null
        : { value: engine.electricity, estimated: false, cycle: 'wltp' }
      : consumption && {
          value: consumption.litres,
          estimated: consumption.estimated,
          cycle: consumption.cycle,
        },
  };
}

/** What the EU data lacks for a first registration, to name below the picker. */
export function missingValues(engine: EngineRecord, firstRegistration: string): string[] {
  const missing: string[] = [];
  const electric = engine.fuel === 'electric' || engine.fuel === 'hydrogen';
  if (!electric && engineCo2(engine, firstRegistration) === null)
    missing.push(
      `der CO₂-Wert nach ${testCycle(firstRegistration) === 'wltp' ? 'WLTP' : 'NEFZ'} (Feld V.7)`,
    );
  return missing;
}

/**
 * The tax fields after a new engine: a field takes the engine's value where it
 * is empty or still holds what the previous engine put there; with `replace`
 * (a pick by hand) also over a typed value. An empty engine value only clears
 * what the previous engine put there.
 */
export function mergeEngineFields(
  values: TaxFormValues,
  previous: EngineFields,
  next: EngineFields,
  replace: boolean,
): TaxFormValues {
  const field = <T extends string>(current: T, before: T, after: T): T => {
    const ours = current === '' || current === before;
    if (after !== '') return ours || replace ? after : current;
    return ours ? after : current;
  };
  return {
    ...values,
    drive: field(values.drive, previous.drive, next.drive),
    displacementCcm: field(values.displacementCcm, previous.displacementCcm, next.displacementCcm),
    co2GPerKm: field(values.co2GPerKm, previous.co2GPerKm, next.co2GPerKm),
  };
}
