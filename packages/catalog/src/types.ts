import { FUEL_TYPES } from '@kaufcheck/shared';
import { z } from 'zod';

/** Vehicle classes as buyers know them (roughly the KBA segments). */
export const SEGMENTS = [
  'kleinstwagen',
  'kleinwagen',
  'kompakt',
  'mittelklasse',
  'obere_mittelklasse',
  'oberklasse',
  'suv_klein',
  'suv_kompakt',
  'suv_mittel',
  'suv_gross',
  'van_klein',
  'van',
  'hochdachkombi',
  'bus',
  'sportwagen',
] as const;
export type Segment = (typeof SEGMENTS)[number];

export const SEGMENT_LABELS: Record<Segment, string> = {
  kleinstwagen: 'Kleinstwagen',
  kleinwagen: 'Kleinwagen',
  kompakt: 'Kompaktklasse',
  mittelklasse: 'Mittelklasse',
  obere_mittelklasse: 'Obere Mittelklasse',
  oberklasse: 'Oberklasse',
  suv_klein: 'Kleines SUV',
  suv_kompakt: 'Kompakt-SUV',
  suv_mittel: 'Mittelgroßes SUV',
  suv_gross: 'Großes SUV',
  van_klein: 'Kleiner Van',
  van: 'Van',
  hochdachkombi: 'Hochdachkombi',
  bus: 'Bus',
  sportwagen: 'Sportwagen',
};

export const BODY_TYPES = [
  'limousine',
  'schraegheck',
  'kombi',
  'suv',
  'van',
  'cabrio',
  'coupe',
  'pickup',
  'bus',
] as const;
export type BodyType = (typeof BODY_TYPES)[number];

export const BODY_TYPE_LABELS: Record<BodyType, string> = {
  limousine: 'Limousine',
  schraegheck: 'Schrägheck',
  kombi: 'Kombi',
  suv: 'SUV / Geländewagen',
  van: 'Van / Minivan',
  cabrio: 'Cabrio',
  coupe: 'Coupé',
  pickup: 'Pick-up',
  bus: 'Bus / Kleinbus',
};

const SourceSchema = z.object({
  label: z.string().min(2).max(160),
  url: z.url({ protocol: /^https$/ }),
});
export type Source = z.infer<typeof SourceSchema>;

const Rating = z.number().int().min(1).max(5);
const Year = z.number().int().min(1990).max(2035);

export const KnownIssueSchema = z.object({
  title: z.string().min(3).max(120),
  /** Engines, gearboxes and years concerned, as precise as the source allows. */
  affects: z.string().min(2).max(240),
  detail: z.string().min(10).max(600),
  /** What buyers should check or ask. */
  check: z.string().min(5).max(400),
  severity: z.enum(['hoch', 'mittel', 'gering']),
  sources: z.array(SourceSchema).min(1),
});
export type KnownIssue = z.infer<typeof KnownIssueSchema>;

const EngineNoteSchema = z.object({
  name: z.string().min(2).max(120),
  why: z.string().min(5).max(400),
});
export type EngineNote = z.infer<typeof EngineNoteSchema>;

export const GenerationSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(1).max(80),
  code: z.string().max(80).nullable(),
  years: z.tuple([Year, Year.nullable()]),
  bodyTypes: z.array(z.enum(BODY_TYPES)).min(1),
  fuels: z.array(z.enum(FUEL_TYPES)).min(1),
  seats: z.array(z.number().int().min(1).max(9)).min(1),
  automatic: z.boolean(),
  /** Typical asking prices of used offers, only where a source names them. */
  typicalPriceEur: z.tuple([z.number().int().min(0), z.number().int().min(0)]).nullable(),
  priceSource: SourceSchema.nullable(),
  strengths: z.array(z.string().min(3).max(240)).max(6),
  issues: z.array(KnownIssueSchema).max(8),
  engines: z.object({
    recommended: z.array(EngineNoteSchema).max(6),
    caution: z.array(EngineNoteSchema).max(6),
  }),
  tips: z.array(z.string().min(5).max(300)).max(6),
});
export type Generation = z.infer<typeof GenerationSchema>;

export const CarModelSchema = z.object({
  /** "<make slug>-<model slug>", also the address of the model page. */
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  make: z.string().min(1).max(40),
  model: z.string().min(1).max(60),
  /** Lower-case spellings used in listings. */
  aliases: z.array(z.string().min(1).max(60)),
  segment: z.enum(SEGMENTS),
  summary: z.string().min(10).max(400),
  ratings: z.object({
    reliability: Rating,
    reliabilityNote: z.string().min(5).max(400),
    reliabilitySources: z.array(SourceSchema),
    runningCosts: Rating,
    space: Rating,
    comfort: Rating,
  }),
  /** Technically identical model of another make (e.g. Škoda Citigo → VW up!). */
  twinOf: z.string().optional(),
  generations: z.array(GenerationSchema).min(1),
});
export type CarModel = z.infer<typeof CarModelSchema>;
