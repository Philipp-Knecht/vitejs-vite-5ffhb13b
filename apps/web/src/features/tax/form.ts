import type { TaxDrive, TaxEmissionClass } from '@kaufcheck/shared';

/** Form state of the tax calculator: the raw input of each field. */
export interface TaxFormValues {
  firstRegistration: string;
  drive: TaxDrive | '';
  displacementCcm: string;
  co2GPerKm: string;
  emissionClass: TaxEmissionClass | '';
  grossWeightKg: string;
}

export const EMPTY_TAX_FORM: TaxFormValues = {
  firstRegistration: '',
  drive: '',
  displacementCcm: '',
  co2GPerKm: '',
  emissionClass: '',
  grossWeightKg: '',
};
