import {
  EMPTY_SEARCH,
  findListingModel,
  findMake,
  SEARCH_FUELS,
  toSearchParams,
  type SearchFuel,
} from '@kaufcheck/catalog';
import type { Vehicle } from '@kaufcheck/shared';

/**
 * KaufCheck's own search for similar offers, which links on to the
 * marketplaces; null when the make is unknown (that would search everything).
 */
export function similarOffersLink(vehicle: Vehicle | null): string | null {
  const make = findMake(vehicle?.make);
  if (!make) return null;
  const model = vehicle?.model ? findListingModel(make, vehicle.model) : null;
  const year = vehicle?.firstRegistration?.year ?? null;
  const km = vehicle?.mileageKm ?? null;
  const fuel = SEARCH_FUELS.find((value): value is SearchFuel => value === vehicle?.fuel) ?? null;
  const params = toSearchParams({
    ...EMPTY_SEARCH,
    makeId: make.id,
    modelId: model?.id ?? null,
    modelText: !model && vehicle?.model ? vehicle.model : null,
    yearMin: year === null ? null : year - 2,
    yearMax: year === null ? null : year + 2,
    kmMax: km === null || km === 0 ? null : Math.ceil((km * 1.3) / 10_000) * 10_000,
    fuel,
  });
  return `/auto-finden?${params.toString()}`;
}
