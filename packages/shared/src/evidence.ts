/**
 * Every statement KaufCheck shows is tagged with where it comes from.
 * The UI must make this visible so that inference is never mistaken for fact.
 */
export const EVIDENCE_TYPES = ['listing_fact', 'calculation', 'inference', 'unknown'] as const;

export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export const EVIDENCE_LABELS: Record<EvidenceType, string> = {
  listing_fact: 'Aus dem Inserat',
  calculation: 'Berechnet',
  inference: 'Vermutung',
  unknown: 'Nicht bekannt',
};

export const EVIDENCE_DESCRIPTIONS: Record<EvidenceType, string> = {
  listing_fact: 'Diese Angabe steht so im Inserat. KaufCheck hat sie nicht überprüft.',
  calculation: 'Aus Angaben im Inserat berechnet.',
  inference: 'Eine Einschätzung auf Basis der verfügbaren Angaben – nicht überprüft.',
  unknown: 'Dazu enthält das Inserat keine Angabe.',
};

/** Where inside a listing a fact was found. */
export const FACT_SOURCES = [
  'details',
  'title',
  'description',
  'equipment',
  'page',
  'user',
] as const;

export type FactSource = (typeof FACT_SOURCES)[number];

export const FACT_SOURCE_LABELS: Record<FactSource, string> = {
  details: 'Fahrzeugdetails im Inserat',
  title: 'Titel des Inserats',
  description: 'Beschreibung des Inserats',
  equipment: 'Ausstattungsliste im Inserat',
  page: 'Inseratsseite',
  user: 'Von dir ergänzt',
};
