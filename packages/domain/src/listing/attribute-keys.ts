import { cleanInline, foldGerman } from '../text/text';

/**
 * Canonical keys for listing detail attributes. Marketplaces show car details
 * as label/value pairs ("Kilometerstand: 185.000 km", "Anzahl der Fahrzeughalter
 * 2"); sellers who write details themselves use many variants of the same labels.
 */
export type AttributeKey =
  | 'make'
  | 'model'
  | 'mileage'
  | 'condition'
  | 'firstRegistration'
  | 'fuel'
  | 'power'
  | 'transmission'
  | 'bodyType'
  | 'doors'
  | 'hu'
  | 'emissionSticker'
  | 'emissionClass'
  | 'color'
  | 'interior'
  | 'previousOwners'
  | 'displacement'
  | 'seats'
  | 'drivetrain'
  | 'accidentFree'
  | 'serviceBook'
  | 'lastService'
  | 'origin'
  | 'keyCount'
  | 'commercialUse'
  | 'price'
  | 'shipping';

/** Label variants (already folded: lower case, ä→ae, ß→ss) per key. */
const LABEL_VARIANTS: Record<AttributeKey, readonly string[]> = {
  make: ['marke', 'hersteller', 'fahrzeugmarke'],
  model: ['modell', 'fahrzeugmodell'],
  mileage: ['kilometerstand', 'km-stand', 'km stand', 'kmstand', 'laufleistung', 'kilometer', 'km'],
  condition: ['fahrzeugzustand', 'zustand', 'schaden', 'artikelzustand'],
  firstRegistration: [
    'erstzulassung',
    'ez',
    'erstzul',
    'erstzul.',
    'zulassung',
    'erstzulassungsdatum',
    'datum der erstzulassung',
  ],
  fuel: ['kraftstoffart', 'kraftstoff', 'treibstoff', 'motorart', 'antriebsart (kraftstoff)'],
  power: ['leistung', 'motorleistung', 'ps', 'kw', 'leistung (ps)', 'leistung (kw)'],
  transmission: ['getriebe', 'getriebeart', 'schaltung'],
  bodyType: [
    'fahrzeugtyp',
    'karosserieform',
    'karosserie',
    'fahrzeugart',
    'kategorie',
    'fahrzeugklasse',
  ],
  doors: ['anzahl tueren', 'anzahl der tueren', 'tueren', 'tuerenanzahl'],
  hu: [
    'hu bis',
    'hu',
    'hu/au',
    'hu/au bis',
    'tuev',
    'tuev bis',
    'hauptuntersuchung',
    'hu gueltig bis',
    'hu/au gueltig bis',
    'tuev gueltig bis',
  ],
  emissionSticker: ['umweltplakette', 'feinstaubplakette'],
  emissionClass: ['schadstoffklasse', 'abgasnorm', 'euronorm', 'emissionsklasse'],
  color: ['aussenfarbe', 'farbe', 'farbe (hersteller)', 'farbe laut hersteller', 'herstellerfarbe'],
  interior: ['material innenausstattung', 'innenausstattung', 'polster'],
  previousOwners: [
    'anzahl fahrzeughalter',
    'fahrzeughalter',
    'anzahl der fahrzeughalter',
    'vorbesitzer',
    'anzahl vorbesitzer',
    'halter',
    'anzahl halter',
    'anzahl der vorbesitzer',
    'anzahl der halter',
  ],
  displacement: ['hubraum'],
  seats: ['anzahl sitzplaetze', 'anzahl der sitzplaetze', 'sitzplaetze', 'sitze'],
  drivetrain: ['antrieb', 'antriebsart'],
  accidentFree: ['unfallfrei', 'unfallfahrzeug', 'unfallschaden'],
  serviceBook: ['scheckheftgepflegt', 'scheckheft', 'serviceheft'],
  // Kept as listing facts (and for the AI's grounding checks); not vehicle fields.
  lastService: ['letzter service', 'letzter service am', 'letzte inspektion', 'letzte wartung'],
  origin: ['herkunft', 'herkunftsland'],
  keyCount: ['anzahl schluessel', 'anzahl der schluessel'],
  commercialUse: ['gewerbliche nutzung'],
  price: ['preis', 'kaufpreis', 'preisvorstellung'],
  shipping: ['versand'],
};

const LABEL_LOOKUP = new Map<string, AttributeKey>();
for (const [key, variants] of Object.entries(LABEL_VARIANTS) as [
  AttributeKey,
  readonly string[],
][]) {
  for (const variant of variants) LABEL_LOOKUP.set(variant, key);
}

export function normalizeLabel(label: string): string {
  return foldGerman(cleanInline(label))
    .replace(/[:：]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function attributeKeyForLabel(label: string): AttributeKey | null {
  return LABEL_LOOKUP.get(normalizeLabel(label)) ?? null;
}

/** All known labels, longest first, for prefix matching ("Leistung 310 PS"). */
export const KNOWN_LABELS: readonly string[] = [...LABEL_LOOKUP.keys()].sort(
  (a, b) => b.length - a.length,
);
