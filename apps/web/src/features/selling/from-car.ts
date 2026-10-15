import { makeById } from '@kaufcheck/catalog';
import { EMPTY_LISTING_TEXT, type ListingTextValues, type OwnedCarDto } from '@kaufcheck/shared';

const monthYear = (value: { year: number; month: number | null } | null) =>
  value?.month ? `${String(value.month).padStart(2, '0')}/${value.year}` : '';

/**
 * What „Mein Auto“ knows about the car. The mileage there may be old: the
 * seller reads the current one from the odometer.
 */
export function listingTextFromCar(car: OwnedCarDto): ListingTextValues {
  return {
    ...EMPTY_LISTING_TEXT,
    make: makeById(car.makeId)?.name ?? car.makeId,
    model: car.modelName,
    firstRegistration: monthYear(car.firstRegistration),
    fuel: car.fuel ?? '',
    huUntil: monthYear(car.huUntil),
  };
}
