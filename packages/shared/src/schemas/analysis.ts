import { z } from 'zod';
import { EVIDENCE_TYPES } from '../evidence';
import { PRICE_ADVICE_ACTIONS, PRICE_KINDS, PRICE_VERDICTS } from '../labels';
import { ListingCategorySchema } from './listing';

export const EvidenceTypeSchema = z.enum(EVIDENCE_TYPES);

/** Who produced a statement: the deterministic rule engine or an AI model. */
export const OriginSchema = z.enum(['rules', 'ai']);
export type Origin = z.infer<typeof OriginSchema>;

export const OverviewItemSchema = z.object({
  key: z.string(),
  label: z.string(),
  /** Display value (German formatting). `null` = not stated in the listing. */
  value: z.string().nullable(),
  evidence: EvidenceTypeSchema,
  /** Optional short explanation, e.g. how a value was calculated. */
  note: z.string().nullable(),
});
export type OverviewItem = z.infer<typeof OverviewItemSchema>;

export const VehicleSummarySchema = z.object({
  title: z.string(),
  chips: z.array(z.object({ key: z.string(), text: z.string() })),
});
export type VehicleSummary = z.infer<typeof VehicleSummarySchema>;

export const HighlightSchema = z.object({
  text: z.string(),
  evidence: EvidenceTypeSchema,
  origin: OriginSchema,
  /** Verbatim snippet from the listing supporting the statement. */
  quote: z.string().nullable(),
});
export type Highlight = z.infer<typeof HighlightSchema>;

export const SummarySchema = z.object({
  /** Neutral, rule-generated summary built only from facts and calculations. */
  text: z.string(),
  /** Information in the listing that speaks for the offer. */
  positives: z.array(HighlightSchema),
  /** Open questions and information that speaks against the offer. */
  openPoints: z.array(HighlightSchema),
  /** Optional AI summary; always an inference. */
  ai: z.object({ text: z.string() }).nullable(),
});
export type Summary = z.infer<typeof SummarySchema>;

export const COMPLETENESS_STATUSES = ['present', 'missing', 'not_checkable'] as const;

export const CompletenessFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  status: z.enum(COMPLETENESS_STATUSES),
  value: z.string().nullable(),
  note: z.string().nullable(),
});
export type CompletenessField = z.infer<typeof CompletenessFieldSchema>;

export const CompletenessSchema = z.object({
  /** Share of checkable fields that are present, 0–100. */
  score: z.number().int().min(0).max(100),
  presentCount: z.number().int().nonnegative(),
  checkableCount: z.number().int().nonnegative(),
  fields: z.array(CompletenessFieldSchema),
});
export type Completeness = z.infer<typeof CompletenessSchema>;

export const PRICE_METRIC_KEYS = [
  'price_per_year',
  'price_per_10000_km',
  'km_per_year',
  'comparable_deviation',
] as const;

export const PriceMetricSchema = z.object({
  key: z.enum(PRICE_METRIC_KEYS),
  label: z.string(),
  value: z.string(),
  numericValue: z.number(),
  evidence: z.literal('calculation'),
  explanation: z.string(),
});
export type PriceMetric = z.infer<typeof PriceMetricSchema>;

/**
 * Why there is no comparison: too few offers (or from too few visitors), no
 * price, a car that compares with no intact one, make, model, first
 * registration or mileage missing in the listing, or a fictional example.
 */
export const MARKET_GAPS = [
  'few_comparables',
  'no_price',
  'not_comparable',
  'missing_basics',
  'example',
] as const;

export const MarketContextSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('insufficient_data'),
    message: z.string(),
    sampleSize: z.number().int().nonnegative(),
    /** Absent in results from before rules 2026.10.5. */
    reason: z.enum(MARKET_GAPS).optional(),
  }),
  z.object({
    status: z.literal('available'),
    /** Comparable offers; 0 with a valuation service. */
    sampleSize: z.number().int().nonnegative(),
    medianEur: z.number().int(),
    lowerQuartileEur: z.number().int(),
    upperQuartileEur: z.number().int(),
    /** Deviation from `expectedEur`, in older results from the median. */
    deviationPercent: z.number(),
    criteria: z.string(),
    source: z.string(),
    message: z.string(),
    // The fields below are absent in results from before rules 2026.10.5.
    /** What comparable offers cost at this age and mileage (or their median). */
    expectedEur: z.number().int().positive().optional(),
    /** The middle half of comparable offers around `expectedEur`. */
    typicalLowEur: z.number().int().positive().optional(),
    typicalHighEur: z.number().int().positive().optional(),
    /**
     * `age_mileage`: adjusted to this car's age and mileage; `median`: plain
     * median; `valuation`: from a valuation service named in `source`.
     */
    method: z.enum(['median', 'age_mileage', 'valuation']).optional(),
    verdict: z.enum(PRICE_VERDICTS).optional(),
    /** So far below the usual price that the reason needs asking. */
    unusuallyLow: z.boolean().optional(),
  }),
]);
export type MarketContext = z.infer<typeof MarketContextSchema>;

/** The answer to „Is the price worth it?“, from fixed rules – never from the AI. */
export const PriceAdviceSchema = z.object({
  action: z.enum(PRICE_ADVICE_ACTIONS),
  title: z.string(),
  text: z.string(),
  /** A price worth aiming for, from the comparison; null without one. */
  targetPriceEur: z.number().int().positive().nullable(),
});
export type PriceAdvice = z.infer<typeof PriceAdviceSchema>;

export const PriceContextSchema = z.object({
  askingPrice: z
    .object({
      amountEur: z.number().int().nonnegative(),
      display: z.string(),
      kind: z.enum(PRICE_KINDS),
    })
    .nullable(),
  metrics: z.array(PriceMetricSchema),
  market: MarketContextSchema,
  notes: z.array(z.string()),
  /** Absent in results from before rules 2026.10.5 and without an asking price. */
  advice: PriceAdviceSchema.optional(),
});
export type PriceContext = z.infer<typeof PriceContextSchema>;

export const SEVERITIES = ['info', 'notice', 'warning'] as const;

export const ObservationSchema = z.object({
  id: z.string(),
  title: z.string(),
  detail: z.string(),
  severity: z.enum(SEVERITIES),
  evidence: EvidenceTypeSchema,
  origin: OriginSchema,
  relatedFields: z.array(z.string()),
  quotes: z.array(z.string()),
});
export type Observation = z.infer<typeof ObservationSchema>;

export const CheckItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  detail: z.string(),
  /** Evidence behind the trigger; `null` for checks that always apply. */
  evidence: EvidenceTypeSchema.nullable(),
  /** Why this check is shown, e.g. "Automatikgetriebe laut Inserat". */
  basis: z.string().nullable(),
  origin: OriginSchema,
});
export type CheckItem = z.infer<typeof CheckItemSchema>;

export const SellerQuestionSchema = z.object({
  id: z.string(),
  /** Formal address ("Sie"). */
  text: z.string(),
  /** Informal address ("du"). */
  textInformal: z.string(),
  /** Why this question is suggested. */
  reason: z.string(),
  /** 1 = most important. */
  priority: z.number().int().min(1).max(3),
  relatedField: z.string().nullable(),
  origin: OriginSchema,
});
export type SellerQuestion = z.infer<typeof SellerQuestionSchema>;

export const ChecklistItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  hint: z.string().nullable(),
});
export type ChecklistItem = z.infer<typeof ChecklistItemSchema>;

export const ChecklistSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  items: z.array(ChecklistItemSchema),
});
export type ChecklistSection = z.infer<typeof ChecklistSectionSchema>;

export const PHOTO_FINDING_TYPES = [
  'exterior_damage',
  'warning_light',
  'odometer',
  'corrosion',
  'tires',
  'other',
] as const;

export const PhotoFindingSchema = z.object({
  imageIndex: z.number().int().nonnegative(),
  type: z.enum(PHOTO_FINDING_TYPES),
  description: z.string(),
  confidence: z.enum(['low', 'medium']),
});
export type PhotoFinding = z.infer<typeof PhotoFindingSchema>;

export const PHOTO_ANALYSIS_STATUSES = [
  'completed',
  'no_photos',
  'not_configured',
  'not_in_plan',
  'failed',
] as const;

export const PhotoAnalysisSchema = z.object({
  status: z.enum(PHOTO_ANALYSIS_STATUSES),
  message: z.string().nullable(),
  findings: z.array(PhotoFindingSchema),
  analyzedImageCount: z.number().int().nonnegative(),
});
export type PhotoAnalysis = z.infer<typeof PhotoAnalysisSchema>;

export const AI_STATUSES = ['completed', 'not_configured', 'failed', 'skipped'] as const;

export const AiInfoSchema = z.object({
  status: z.enum(AI_STATUSES),
  provider: z.string().nullable(),
  model: z.string().nullable(),
  /** True when the development mock provider produced the output. */
  isMock: z.boolean(),
  message: z.string().nullable(),
});
export type AiInfo = z.infer<typeof AiInfoSchema>;

export const AnalysisResultSchema = z.object({
  schemaVersion: z.literal(1),
  rulesVersion: z.string(),
  category: ListingCategorySchema,
  vehicleSummary: VehicleSummarySchema.nullable(),
  summary: SummarySchema,
  overview: z.array(OverviewItemSchema),
  completeness: CompletenessSchema,
  priceContext: PriceContextSchema,
  observations: z.array(ObservationSchema),
  checks: z.array(CheckItemSchema),
  sellerQuestions: z.array(SellerQuestionSchema),
  inspectionChecklist: z.array(ChecklistSectionSchema),
  photoAnalysis: PhotoAnalysisSchema,
  ai: AiInfoSchema,
  disclaimer: z.string(),
});
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;
