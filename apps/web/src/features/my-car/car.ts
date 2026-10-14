import { findListingModel, findMake, makeById } from '@kaufcheck/catalog';
import { MODEL_INDEX } from '@kaufcheck/catalog/advisor-index';
import {
  huCalendarFile,
  type FuelType,
  type HuMonth,
  type OwnedCarDto,
  type OwnedCarInput,
  type Vehicle,
} from '@kaufcheck/shared';

/** Generations of the researched models, by model id. */
export const GENERATIONS = new Map(MODEL_INDEX.map((model) => [model.id, model.generations]));

/** Form state: everything as typed, so that half-filled fields stay as they are. */
export interface CarFormValues {
  nickname: string;
  makeId: string;
  /** Catalog model id, `other` for a model outside the catalog, or empty. */
  modelId: string;
  modelName: string;
  generationId: string;
  fuel: FuelType | '';
  registrationMonth: string;
  registrationYear: string;
  mileageKm: string;
  huMonth: string;
  huYear: string;
}

export const OTHER_MODEL = 'other';

export const EMPTY_CAR_FORM: CarFormValues = {
  nickname: '',
  makeId: '',
  modelId: '',
  modelName: '',
  generationId: '',
  fuel: '',
  registrationMonth: '',
  registrationYear: '',
  mileageKm: '',
  huMonth: '',
  huYear: '',
};

const text = (value: number | null | undefined) =>
  value === null || value === undefined ? '' : String(value);

export function formFromCar(car: OwnedCarDto): CarFormValues {
  return {
    nickname: car.nickname ?? '',
    makeId: car.makeId,
    modelId: car.modelId ?? OTHER_MODEL,
    modelName: car.modelName,
    generationId: car.generationId ?? '',
    fuel: car.fuel ?? '',
    registrationMonth: text(car.firstRegistration.month),
    registrationYear: String(car.firstRegistration.year),
    mileageKm: text(car.mileageKm),
    huMonth: text(car.huUntil?.month),
    huYear: text(car.huUntil?.year),
  };
}

/** Prefill from a checked listing: what the listing says, matched to the catalog where possible. */
export function formFromListing(vehicle: Vehicle | null): CarFormValues {
  const make = findMake(vehicle?.make);
  const model = findListingModel(make, vehicle?.model);
  const year = vehicle?.firstRegistration?.year ?? null;
  const generation =
    model && year !== null
      ? GENERATIONS.get(model.id)?.find(
          (item) => item.years[0] <= year && (item.years[1] ?? year) >= year,
        )
      : undefined;
  return {
    ...EMPTY_CAR_FORM,
    makeId: make?.id ?? '',
    modelId: model?.id ?? (make && vehicle?.model ? OTHER_MODEL : ''),
    modelName: model?.model ?? vehicle?.model?.slice(0, 60) ?? '',
    generationId: generation?.id ?? '',
    fuel: vehicle?.fuel ?? '',
    registrationMonth: text(vehicle?.firstRegistration?.month),
    registrationYear: text(year),
    mileageKm: text(vehicle?.mileageKm),
    huMonth: text(vehicle?.huUntil?.month),
    huYear: text(vehicle?.huUntil?.year),
  };
}

export type CarFormField =
  'makeId' | 'modelName' | 'generation' | 'registration' | 'mileageKm' | 'hu' | 'nickname';

export interface CarFormError {
  field: CarFormField | null;
  message: string;
}

const SERVER_FIELDS: Record<string, CarFormField> = {
  makeId: 'makeId',
  modelId: 'modelName',
  modelName: 'modelName',
  generationId: 'generation',
  firstRegistration: 'registration',
  mileageKm: 'mileageKm',
  huUntil: 'hu',
  nickname: 'nickname',
};

/** A server validation error, attached to its field when the server names one. */
export function formErrorFromServer(
  message: string,
  fieldErrors: Record<string, string[]> | undefined,
): CarFormError {
  for (const [key, messages] of Object.entries(fieldErrors ?? {})) {
    const field = SERVER_FIELDS[key.split('.')[0] ?? ''];
    if (field) return { field, message: messages[0] ?? message };
  }
  return { field: null, message };
}

const wholeNumber = (value: string) => {
  const compact = value.replace(/[\s.]/g, '');
  return /^\d+$/.test(compact) ? Number(compact) : null;
};

/** The request body, or the first field to fix. */
export function inputFromForm(
  values: CarFormValues,
  now: Date,
): { input: OwnedCarInput } | { field: CarFormField; message: string } {
  const thisYear = now.getFullYear();
  if (!values.makeId) return { field: 'makeId', message: 'Bitte wähle die Marke.' };
  const catalogModel = values.modelId && values.modelId !== OTHER_MODEL ? values.modelId : null;
  const modelName = values.modelName.trim();
  if (!modelName) return { field: 'modelName', message: 'Bitte wähle oder nenne das Modell.' };

  const year = wholeNumber(values.registrationYear);
  if (year === null || year < 1950 || year > thisYear)
    return {
      field: 'registration',
      message: `Bitte gib das Jahr der Erstzulassung an, zwischen 1950 und ${thisYear}.`,
    };
  const month = values.registrationMonth ? Number(values.registrationMonth) : null;

  let mileageKm: number | null = null;
  if (values.mileageKm.trim()) {
    mileageKm = wholeNumber(values.mileageKm);
    if (mileageKm === null || mileageKm > 2_000_000)
      return { field: 'mileageKm', message: 'Bitte gib den Kilometerstand als Zahl an.' };
  }

  let huUntil: OwnedCarInput['huUntil'] = null;
  if (values.huMonth || values.huYear) {
    const huYear = wholeNumber(values.huYear);
    if (!values.huMonth || huYear === null || huYear < 1950)
      return { field: 'hu', message: 'Bitte gib Monat und Jahr von der HU-Plakette an.' };
    if (huYear > thisYear + 3)
      return { field: 'hu', message: 'Die HU kann höchstens drei Jahre im Voraus gültig sein.' };
    huUntil = { year: huYear, month: Number(values.huMonth) };
  }

  return {
    input: {
      nickname: values.nickname.trim() || null,
      makeId: values.makeId,
      modelId: catalogModel,
      modelName,
      generationId: catalogModel && values.generationId ? values.generationId : null,
      fuel: values.fuel || null,
      firstRegistration: { year, month },
      mileageKm,
      huUntil,
    },
  };
}

export const carHeadingId = (id: string) => `car-${id}-title`;

/** The nickname, or make and model. */
export const carName = (car: Pick<OwnedCarDto, 'makeId' | 'modelName' | 'nickname'>) =>
  car.nickname ?? carTitle(car);

export function carTitle(car: Pick<OwnedCarDto, 'makeId' | 'modelName'>): string {
  return `${makeById(car.makeId)?.name ?? car.makeId} ${car.modelName}`;
}

/** The calendar file for the next HU of a car. */
export function carHuCalendarFile(car: OwnedCarDto, hu: HuMonth, now: Date): string {
  const title = car.nickname ? `${car.nickname} (${carTitle(car)})` : carTitle(car);
  return huCalendarFile({ uid: `hu-${car.id}-${hu.year}-${hu.month}@kaufcheck`, title, hu, now });
}
