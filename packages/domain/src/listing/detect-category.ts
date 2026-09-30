import { KLEINANZEIGEN_CARS_CATEGORY_ID, type ListingCategory } from '@kaufcheck/shared';
import { foldGerman } from '../text/text';
import type { DescriptionSignals } from '../vehicle/description-signals';
import { findMakeInText } from '../vehicle/vocabulary';
import { attributeKeyForLabel, type AttributeKey } from './attribute-keys';
import type { ParsedListing } from './parsed-listing';

export type VehicleKind = 'car' | 'motorcycle' | 'caravan' | 'commercial' | 'parts';

export interface CategoryDetection {
  category: ListingCategory | null;
  vehicleKind: VehicleKind | null;
  confidence: 'high' | 'medium' | 'low';
}

const CAR_DETAIL_KEYS: readonly AttributeKey[] = [
  'make',
  'model',
  'mileage',
  'firstRegistration',
  'fuel',
  'power',
  'transmission',
  'hu',
  'bodyType',
];

const MOTORCYCLE_WORDS =
  /\b(motorrad|motorroller|roller|moped|mofa|quad|chopper|enduro|supersportler|naked\s*bike)\b/i;

function kindFromHints(hints: readonly string[]): VehicleKind | null {
  const folded = hints.map((hint) => foldGerman(hint));
  if (folded.some((hint) => /^autos?$/.test(hint))) return 'car';
  if (folded.some((hint) => /motorraeder|motorroller/.test(hint))) return 'motorcycle';
  if (folded.some((hint) => /wohnwagen|wohnmobil/.test(hint))) return 'caravan';
  if (folded.some((hint) => /nutzfahrzeug|anhaenger/.test(hint))) return 'commercial';
  if (folded.some((hint) => /autoteile|reifen\s*&\s*felgen|ersatzteile/.test(hint))) return 'parts';
  return null;
}

/**
 * Decides which analyzer applies. Only cars are supported today; other
 * vehicles (motorcycles, caravans, parts) are recognized so the user gets a
 * clear "not supported yet" message instead of a car checklist.
 */
export function detectCategory(
  parsed: ParsedListing,
  signals: DescriptionSignals,
  urlCategoryId: string | null,
): CategoryDetection {
  if (urlCategoryId === KLEINANZEIGEN_CARS_CATEGORY_ID) {
    return { category: 'vehicle', vehicleKind: 'car', confidence: 'high' };
  }

  const hintedKind = kindFromHints(parsed.categoryHints);
  if (hintedKind) {
    return { category: 'vehicle', vehicleKind: hintedKind, confidence: 'high' };
  }

  const keys = new Set(
    parsed.attributes
      .map((attribute) => attributeKeyForLabel(attribute.label))
      .filter((key): key is AttributeKey => key !== null),
  );
  const carDetailCount = CAR_DETAIL_KEYS.filter((key) => keys.has(key)).length;
  const text = `${parsed.title ?? ''}\n${parsed.description ?? ''}`;
  const motorcycle = MOTORCYCLE_WORDS.test(text) || /\bccm\b/i.test(text);

  if (carDetailCount >= 3) {
    if (motorcycle && !keys.has('doors') && !keys.has('bodyType')) {
      return { category: 'vehicle', vehicleKind: 'motorcycle', confidence: 'medium' };
    }
    return {
      category: 'vehicle',
      vehicleKind: 'car',
      confidence: carDetailCount >= 5 ? 'high' : 'medium',
    };
  }

  const hasMake = Boolean(findMakeInText(text)) || keys.has('make');
  const vehicleSignals =
    Number(signals.mileageMentions.length > 0 || keys.has('mileage')) +
    Number(
      signals.registrationMentions.length > 0 ||
        signals.buildYearMentions.length > 0 ||
        keys.has('firstRegistration'),
    ) +
    Number(signals.huMention !== null || signals.huNew !== null || keys.has('hu')) +
    Number(signals.powerMentions.length > 0 || keys.has('power'));

  if (hasMake && vehicleSignals >= 1) {
    if (motorcycle) return { category: 'vehicle', vehicleKind: 'motorcycle', confidence: 'low' };
    return {
      category: 'vehicle',
      vehicleKind: 'car',
      confidence: vehicleSignals >= 2 ? 'medium' : 'low',
    };
  }

  return { category: null, vehicleKind: null, confidence: 'low' };
}
