/**
 * German display labels for enumerated vehicle values. These are pure
 * presentation mappings, shared so that web and api label values identically.
 */
export const FUEL_TYPES = [
  'petrol',
  'diesel',
  'electric',
  'hybrid',
  'plugin_hybrid',
  'lpg',
  'cng',
  'hydrogen',
  'ethanol',
  'other',
] as const;
export type FuelType = (typeof FUEL_TYPES)[number];

export const FUEL_LABELS: Record<FuelType, string> = {
  petrol: 'Benzin',
  diesel: 'Diesel',
  electric: 'Elektro',
  hybrid: 'Hybrid',
  plugin_hybrid: 'Plug-in-Hybrid',
  lpg: 'Autogas (LPG)',
  cng: 'Erdgas (CNG)',
  hydrogen: 'Wasserstoff',
  ethanol: 'Ethanol',
  other: 'Andere',
};

export const TRANSMISSION_TYPES = ['manual', 'automatic', 'semi_automatic'] as const;
export type TransmissionType = (typeof TRANSMISSION_TYPES)[number];

export const TRANSMISSION_LABELS: Record<TransmissionType, string> = {
  manual: 'Schaltgetriebe',
  automatic: 'Automatik',
  semi_automatic: 'Halbautomatik',
};

export const DRIVETRAIN_TYPES = ['fwd', 'rwd', 'awd'] as const;
export type DrivetrainType = (typeof DRIVETRAIN_TYPES)[number];

export const DRIVETRAIN_LABELS: Record<DrivetrainType, string> = {
  fwd: 'Frontantrieb',
  rwd: 'Heckantrieb',
  awd: 'Allradantrieb',
};

export const SERVICE_HISTORY_TYPES = ['documented', 'claimed', 'none'] as const;
export type ServiceHistoryType = (typeof SERVICE_HISTORY_TYPES)[number];

export const SERVICE_HISTORY_LABELS: Record<ServiceHistoryType, string> = {
  documented: 'Nachweise laut Inserat vorhanden',
  claimed: 'Wartung erwähnt, ohne Nachweis',
  none: 'Laut Inserat keine Nachweise',
};

/**
 * `previous_damage` = the listing mentions an accident or prior damage
 * (repaired or unspecified); `unrepaired_damage` = explicitly not repaired.
 */
export const ACCIDENT_HISTORY_TYPES = [
  'accident_free',
  'previous_damage',
  'unrepaired_damage',
] as const;
export type AccidentHistoryType = (typeof ACCIDENT_HISTORY_TYPES)[number];

export const ACCIDENT_HISTORY_LABELS: Record<AccidentHistoryType, string> = {
  accident_free: 'Unfallfrei laut Inserat',
  previous_damage: 'Vorschaden laut Inserat',
  unrepaired_damage: 'Unreparierter Schaden laut Inserat',
};

export const CONDITION_TYPES = ['undamaged', 'damaged', 'not_roadworthy'] as const;
export type ConditionType = (typeof CONDITION_TYPES)[number];

export const CONDITION_LABELS: Record<ConditionType, string> = {
  undamaged: 'Unbeschädigt',
  damaged: 'Beschädigt',
  not_roadworthy: 'Nicht fahrtauglich',
};

export const SELLER_TYPES = ['private', 'commercial'] as const;
export type SellerType = (typeof SELLER_TYPES)[number];

export const SELLER_TYPE_LABELS: Record<SellerType, string> = {
  private: 'Privat',
  commercial: 'Gewerblich',
};

/**
 * `asking` = a price without further qualification. It is not labelled as
 * "Festpreis" unless the listing explicitly says so (`fixed`).
 */
export const PRICE_KINDS = ['asking', 'negotiable', 'fixed', 'give_away'] as const;
export type PriceKind = (typeof PRICE_KINDS)[number];

export const PRICE_KIND_LABELS: Record<PriceKind, string> = {
  asking: 'Angebotspreis',
  negotiable: 'Verhandlungsbasis (VB)',
  fixed: 'Festpreis',
  give_away: 'Zu verschenken',
};

/**
 * Price levels from the comparison with similar offers, cheapest first. The
 * thresholds are fixed (see `priceVerdict` in the domain package), so the same
 * deviation always gets the same level.
 */
export const PRICE_VERDICTS = ['very_good', 'good', 'fair', 'increased', 'high'] as const;
export type PriceVerdict = (typeof PRICE_VERDICTS)[number];

/**
 * Limits in percent from the usual price: at most −15 % is a very good price,
 * at most −5 % a good one, below +5 % fair, below +15 % increased, from +15 %
 * high. A price within the middle half of comparable offers is always fair.
 */
export const PRICE_VERDICT_LIMITS = { veryGood: -15, good: -5, fair: 5, increased: 15 } as const;

/** From 30 % below the usual price the reason needs asking: defects, or something wrong with the offer. */
export const UNUSUALLY_LOW_PERCENT = -30;

/** Minimum number of comparable offers (after removing outliers) before a price is rated. */
export const MIN_COMPARABLES = 8;

/** The comparable offers must come from at least this many browsers or accounts. */
export const MIN_COMPARABLE_VISITORS = 5;

/** Each browser or account adds at most this many comparable offers. */
export const MAX_COMPARABLES_PER_VISITOR = 3;

export const PRICE_VERDICT_LABELS: Record<PriceVerdict, string> = {
  very_good: 'Sehr guter Preis',
  good: 'Guter Preis',
  fair: 'Fairer Preis',
  increased: 'Erhöhter Preis',
  high: 'Hoher Preis',
};

/** What to do about the price: look at the car, negotiate, look further, be careful, compare. */
export const PRICE_ADVICE_ACTIONS = [
  'inspect',
  'negotiate',
  'search_on',
  'caution',
  'compare',
] as const;
export type PriceAdviceAction = (typeof PRICE_ADVICE_ACTIONS)[number];
