import type { ValuationReference } from '@kaufcheck/domain';
import type { FuelType, YearMonth } from '@kaufcheck/shared';

/** What a valuation service needs to know about the car. */
export interface ValuationRequest {
  make: string;
  model: string;
  variant: string | null;
  firstRegistration: YearMonth;
  mileageKm: number;
  fuel: FuelType | null;
  powerKw: number | null;
}

/**
 * A paid valuation service (DAT, Autovista/Schwacke …) that knows the usual
 * retail price of a car. None is connected: the operator has to sign a
 * contract first. Its adapter implements this interface and is passed to the
 * analysis service; until then the price check uses KaufCheck's own
 * comparable offers.
 */
export interface ValuationProvider {
  /** Shown as the source, e.g. „DAT“. */
  readonly name: string;
  /** Null when the service does not know the car. */
  valuate(request: ValuationRequest, signal: AbortSignal): Promise<ValuationReference | null>;
}
