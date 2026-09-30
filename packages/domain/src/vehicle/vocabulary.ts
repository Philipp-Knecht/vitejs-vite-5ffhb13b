import type { ConditionType, DrivetrainType, FuelType, TransmissionType } from '@kaufcheck/shared';
import { foldGerman } from '../text/text';

/** Car makes with the spellings used in German listings. */
const MAKES: readonly { name: string; aliases: readonly string[] }[] = [
  { name: 'Abarth', aliases: ['abarth'] },
  { name: 'Alfa Romeo', aliases: ['alfa romeo', 'alfa-romeo', 'alfa'] },
  { name: 'Alpine', aliases: ['alpine'] },
  { name: 'Aston Martin', aliases: ['aston martin'] },
  { name: 'Audi', aliases: ['audi'] },
  { name: 'Bentley', aliases: ['bentley'] },
  { name: 'BMW', aliases: ['bmw'] },
  { name: 'BYD', aliases: ['byd'] },
  { name: 'Cadillac', aliases: ['cadillac'] },
  { name: 'Chevrolet', aliases: ['chevrolet', 'chevy'] },
  { name: 'Chrysler', aliases: ['chrysler'] },
  { name: 'Citroën', aliases: ['citroën', 'citroen'] },
  { name: 'Cupra', aliases: ['cupra'] },
  { name: 'Dacia', aliases: ['dacia'] },
  { name: 'Daihatsu', aliases: ['daihatsu'] },
  { name: 'Dodge', aliases: ['dodge'] },
  { name: 'DS Automobiles', aliases: ['ds automobiles', 'ds'] },
  { name: 'Ferrari', aliases: ['ferrari'] },
  { name: 'Fiat', aliases: ['fiat'] },
  { name: 'Ford', aliases: ['ford'] },
  { name: 'Genesis', aliases: ['genesis'] },
  { name: 'Honda', aliases: ['honda'] },
  { name: 'Hyundai', aliases: ['hyundai'] },
  { name: 'Infiniti', aliases: ['infiniti'] },
  { name: 'Jaguar', aliases: ['jaguar'] },
  { name: 'Jeep', aliases: ['jeep'] },
  { name: 'Kia', aliases: ['kia'] },
  { name: 'Lada', aliases: ['lada'] },
  { name: 'Lamborghini', aliases: ['lamborghini'] },
  { name: 'Lancia', aliases: ['lancia'] },
  { name: 'Land Rover', aliases: ['land rover', 'land-rover', 'landrover', 'range rover'] },
  { name: 'Lexus', aliases: ['lexus'] },
  { name: 'Lotus', aliases: ['lotus'] },
  { name: 'Maserati', aliases: ['maserati'] },
  { name: 'Mazda', aliases: ['mazda'] },
  { name: 'McLaren', aliases: ['mclaren'] },
  { name: 'Mercedes-Benz', aliases: ['mercedes-benz', 'mercedes benz', 'mercedes', 'mb'] },
  { name: 'MG', aliases: ['mg', 'mg motor'] },
  { name: 'MINI', aliases: ['mini'] },
  { name: 'Mitsubishi', aliases: ['mitsubishi'] },
  { name: 'Nissan', aliases: ['nissan'] },
  { name: 'Opel', aliases: ['opel'] },
  { name: 'Peugeot', aliases: ['peugeot'] },
  { name: 'Polestar', aliases: ['polestar'] },
  { name: 'Porsche', aliases: ['porsche'] },
  { name: 'Renault', aliases: ['renault'] },
  { name: 'Rolls-Royce', aliases: ['rolls-royce', 'rolls royce'] },
  { name: 'Rover', aliases: ['rover'] },
  { name: 'Saab', aliases: ['saab'] },
  { name: 'Seat', aliases: ['seat'] },
  { name: 'Škoda', aliases: ['škoda', 'skoda'] },
  { name: 'smart', aliases: ['smart'] },
  { name: 'SsangYong', aliases: ['ssangyong', 'kgm'] },
  { name: 'Subaru', aliases: ['subaru'] },
  { name: 'Suzuki', aliases: ['suzuki'] },
  { name: 'Tesla', aliases: ['tesla'] },
  { name: 'Toyota', aliases: ['toyota'] },
  { name: 'Volkswagen', aliases: ['volkswagen', 'vw'] },
  { name: 'Volvo', aliases: ['volvo'] },
];

const MAKE_BY_ALIAS = new Map<string, string>();
for (const make of MAKES) {
  for (const alias of make.aliases) MAKE_BY_ALIAS.set(foldGerman(alias), make.name);
}

/** Short aliases that are also common words or abbreviations need an exact field match. */
const AMBIGUOUS_ALIASES = new Set([
  'mb',
  'ds',
  'mg',
  'mini',
  'smart',
  'seat',
  'alpine',
  'genesis',
  'lotus',
  'rover',
]);

function escapeRegExp(value: string): string {
  // '-' is not escaped: it is only special inside character classes, and
  // "\-" outside a class is a syntax error in Unicode mode.
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Free-text patterns, longest alias first so "Alfa Romeo" wins over "Alfa". */
const MAKE_PATTERNS = [...MAKE_BY_ALIAS.entries()]
  .filter(([alias]) => !AMBIGUOUS_ALIASES.has(alias))
  .sort(([a], [b]) => b.length - a.length)
  .map(([alias, make]) => ({
    make,
    length: alias.length,
    pattern: new RegExp(`(^|[^\\p{L}\\p{N}])(${escapeRegExp(alias)})(?=$|[^\\p{L}\\p{N}])`, 'u'),
  }));

export function canonicalMake(value: string): string | null {
  return MAKE_BY_ALIAS.get(foldGerman(value.trim())) ?? null;
}

/**
 * Finds the first make at a word boundary inside free text (e.g. a title).
 * Matching runs on the lower-cased text (no umlaut folding; no alias contains
 * ä/ö/ü/ß), so `index`/`length` are valid positions in the original text.
 */
export function findMakeInText(
  text: string,
): { make: string; index: number; length: number } | null {
  const folded = text.toLowerCase();
  let best: { make: string; index: number; length: number } | null = null;
  for (const { make, length, pattern } of MAKE_PATTERNS) {
    const match = pattern.exec(folded);
    if (!match) continue;
    const index = match.index + (match[1]?.length ?? 0);
    if (!best || index < best.index) best = { make, index, length };
  }
  return best;
}

export function mapFuel(value: string): FuelType | null {
  const v = foldGerman(value);
  if (/plug-?in|phev|e-hybrid/.test(v)) return 'plugin_hybrid';
  if (/hybrid/.test(v)) return 'hybrid';
  if (/autogas|lpg|fluessiggas/.test(v)) return 'lpg';
  if (/erdgas|cng/.test(v)) return 'cng';
  if (/wasserstoff|brennstoffzelle|hydrogen/.test(v)) return 'hydrogen';
  if (/ethanol|e85/.test(v)) return 'ethanol';
  if (/elektro|electric|\bev\b|\bbev\b/.test(v)) return 'electric';
  if (/diesel/.test(v)) return 'diesel';
  if (/benzin|super|petrol|otto|gasoline/.test(v)) return 'petrol';
  if (/andere|sonstige/.test(v)) return 'other';
  return null;
}

export function mapTransmission(value: string): TransmissionType | null {
  const v = foldGerman(value);
  if (/halbautomati/.test(v)) return 'semi_automatic';
  if (/automati|\bdsg\b|tronic|\bcvt\b|\bpdk\b|powershift|\bedc\b|\bdct\b/.test(v))
    return 'automatic';
  if (/manuell|schalt|handschalt|manual/.test(v)) return 'manual';
  return null;
}

export function mapCondition(value: string): ConditionType | null {
  const v = foldGerman(value);
  if (/nicht\s+fahr(?:tauglich|bereit|tuechtig)/.test(v)) return 'not_roadworthy';
  if (/unbeschaedigt/.test(v)) return 'undamaged';
  if (/beschaedigt|unfall/.test(v)) return 'damaged';
  return null;
}

export function mapDrivetrain(value: string): DrivetrainType | null {
  const v = foldGerman(value);
  if (/allrad|4x4|\bawd\b|\b4wd\b|quattro|xdrive|4matic|4motion|all4|syncro/.test(v)) return 'awd';
  if (/heck/.test(v)) return 'rwd';
  if (/front/.test(v)) return 'fwd';
  return null;
}

/** Drivetrain tokens in titles/descriptions ("quattro", "xDrive", "4MATIC", "Allrad"). */
export const AWD_TOKEN =
  /\b(quattro|xdrive|4matic|4motion|allradantrieb|allrad|4x4|awd|4wd|all4|q4|syncro|sh-awd|e-four|4xe)\b/i;

/** Engine designations that indicate diesel or petrol (used for consistency checks). */
export const DIESEL_TOKEN =
  /\b(tdi|cdi|crdi|hdi|dci|tdci|cdti|jtd|jtdm|multijet|d-?4d|bluehdi|bluetec|sdi|tdv6|tdv8|diesel|\d{3}\s?d)\b/i;
export const PETROL_TOKEN = /\b(tfsi|tsi|fsi|tce|vtec|ecoboost|puretech|benziner|benzin|\d{3}i)\b/i;
