import type { FuelType, Vehicle } from '@kaufcheck/shared';

const DRIVE_PARAM: Partial<Record<FuelType, string>> = {
  petrol: 'benzin',
  // Hybrids are not prefilled: they can have a petrol or a diesel engine.
  lpg: 'benzin',
  cng: 'benzin',
  ethanol: 'benzin',
  diesel: 'diesel',
  electric: 'elektro',
  // Fuel cell cars count as electric cars under the KraftStG (§ 9 Abs. 2).
  hydrogen: 'elektro',
};

/** Link to the tax calculator, prefilled with what the listing says (month of first registration, drive). */
export function taxCalculatorLink(vehicle: Vehicle | null): string {
  const params = new URLSearchParams();
  const registration = vehicle?.firstRegistration;
  if (registration?.month) {
    params.set('ez', `${registration.year}-${String(registration.month).padStart(2, '0')}`);
  }
  const drive = vehicle?.fuel ? DRIVE_PARAM[vehicle.fuel] : undefined;
  if (drive) params.set('antrieb', drive);
  const query = params.toString();
  return query ? `/kfz-steuer-rechner?${query}` : '/kfz-steuer-rechner';
}
