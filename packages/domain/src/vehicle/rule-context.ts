import type { ListingSourceType, NormalizedListing, Vehicle } from '@kaufcheck/shared';
import { monthsSince, monthsUntil } from '../text/dates';
import { wordCount } from '../text/text';
import { extractDescriptionSignals, type DescriptionSignals } from './description-signals';

/** Everything the vehicle rules need, computed once per analysis. */
export interface VehicleRuleContext {
  listing: NormalizedListing;
  vehicle: Vehicle;
  signals: DescriptionSignals;
  now: Date;
  sourceType: ListingSourceType;
  /** Months since first registration; `null` if unknown. */
  ageMonths: number | null;
  /** True if only the registration year is known. */
  ageApproximate: boolean;
  /** Average km per year since first registration (only for age ≥ 12 months). */
  kmPerYear: number | null;
  /** Months until the HU expires (negative = expired); `null` if unknown. */
  huMonthsLeft: number | null;
  descriptionWords: number;
  isCombustion: boolean;
  isElectrified: boolean;
}

export function buildRuleContext(listing: NormalizedListing, now: Date): VehicleRuleContext {
  const vehicle = listing.vehicle;
  if (!vehicle) throw new Error('Vehicle rules require a vehicle listing.');

  const signals = extractDescriptionSignals(listing.description, listing.title, now);
  const ageMonths = vehicle.firstRegistration ? monthsSince(vehicle.firstRegistration, now) : null;
  const kmPerYear =
    ageMonths !== null && ageMonths >= 12 && vehicle.mileageKm !== null
      ? Math.round((vehicle.mileageKm / ageMonths) * 12)
      : null;

  return {
    listing,
    vehicle,
    signals,
    now,
    sourceType: listing.source.type,
    ageMonths,
    ageApproximate: vehicle.firstRegistration?.month === null,
    kmPerYear,
    huMonthsLeft: vehicle.huUntil ? monthsUntil(vehicle.huUntil, now) : null,
    descriptionWords: wordCount(listing.description),
    isCombustion:
      vehicle.fuel === null ||
      ['petrol', 'diesel', 'lpg', 'cng', 'ethanol', 'hybrid', 'plugin_hybrid'].includes(
        vehicle.fuel,
      ),
    isElectrified: vehicle.fuel === 'electric' || vehicle.fuel === 'plugin_hybrid',
  };
}
