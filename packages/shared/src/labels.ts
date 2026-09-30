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
