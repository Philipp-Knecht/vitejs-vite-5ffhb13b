import { z } from 'zod';
import {
  ANALYSIS_STAGES,
  MAX_LISTING_TEXT_LENGTH,
  MIN_LISTING_TEXT_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '../constants';
import { ApiErrorSchema } from './errors';
import { EntitlementsSchema, PlanSchema } from './plans';
import { LISTING_PLATFORMS, MAX_URL_INPUT_LENGTH } from '../url';
import { AnalysisResultSchema, EvidenceTypeSchema } from './analysis';
import { ListingDtoSchema, ListingSourceTypeSchema, VehicleSchema } from './listing';
import { ProOfferSchema } from './contracts';
import { EmailSchema } from './email';

// ---------------------------------------------------------------------------
// Analysis requests
// ---------------------------------------------------------------------------

export const AnalyzeUrlRequestSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, 'Bitte füge einen Link ein.')
    .max(MAX_URL_INPUT_LENGTH, 'Der Link ist zu lang.'),
});
export type AnalyzeUrlRequest = z.infer<typeof AnalyzeUrlRequestSchema>;

export const AnalyzeTextRequestSchema = z.object({
  text: z
    .string()
    .trim()
    .min(
      MIN_LISTING_TEXT_LENGTH,
      'Bitte füge den vollständigen Inseratstext ein – mindestens Titel, Preis und Fahrzeugdetails.',
    )
    .max(MAX_LISTING_TEXT_LENGTH, 'Der Text ist zu lang. Bitte füge nur das Inserat ein.'),
  /** Optional link to the original listing, kept for reference only. */
  url: z.string().trim().max(MAX_URL_INPUT_LENGTH).optional(),
});
export type AnalyzeTextRequest = z.infer<typeof AnalyzeTextRequestSchema>;

export const AnalyzeExampleRequestSchema = z.object({
  exampleId: z
    .string()
    .max(64)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
});
export type AnalyzeExampleRequest = z.infer<typeof AnalyzeExampleRequestSchema>;

// ---------------------------------------------------------------------------
// Analysis responses
// ---------------------------------------------------------------------------

export const AnalysisDtoSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  listing: ListingDtoSchema,
  /** Same as `listing.vehicle`; exposed top-level for convenience. */
  vehicle: VehicleSchema.nullable(),
  analysis: AnalysisResultSchema,
  /** Id of the saved listing if the current user saved this listing. */
  savedListingId: z.string().nullable(),
});
export type AnalysisDto = z.infer<typeof AnalysisDtoSchema>;

export const AnalysisStageSchema = z.enum(ANALYSIS_STAGES);

export const AnalysisStreamEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('stage'),
    stage: AnalysisStageSchema,
    status: z.enum(['started', 'completed']),
  }),
  z.object({ type: z.literal('result'), data: AnalysisDtoSchema }),
  z.object({ type: z.literal('error'), error: ApiErrorSchema }),
]);
export type AnalysisStreamEvent = z.infer<typeof AnalysisStreamEventSchema>;

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

export const AnalysisListItemSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  title: z.string(),
  priceDisplay: z.string().nullable(),
  chips: z.array(z.string()),
  completenessScore: z.number().int(),
  sourceType: ListingSourceTypeSchema,
  isExample: z.boolean(),
});
export type AnalysisListItem = z.infer<typeof AnalysisListItemSchema>;

export const AnalysisListResponseSchema = z.object({ items: z.array(AnalysisListItemSchema) });

// ---------------------------------------------------------------------------
// Saved listings
// ---------------------------------------------------------------------------

export const SavedListingDtoSchema = z.object({
  id: z.string(),
  title: z.string(),
  customTitle: z.string().nullable(),
  listingTitle: z.string().nullable(),
  analysisId: z.string(),
  analyzedAt: z.string(),
  createdAt: z.string(),
  priceDisplay: z.string().nullable(),
  chips: z.array(z.string()),
  completenessScore: z.number().int(),
  sourceType: ListingSourceTypeSchema,
  sourceUrl: z.string().nullable(),
  isExample: z.boolean(),
  /** Re-analysis needs either a retrievable URL or the stored listing text. */
  canReanalyze: z.boolean(),
});
export type SavedListingDto = z.infer<typeof SavedListingDtoSchema>;

export const SavedListingsResponseSchema = z.object({
  items: z.array(SavedListingDtoSchema),
  limit: z.number().int().nonnegative(),
});
export type SavedListingsResponse = z.infer<typeof SavedListingsResponseSchema>;

export const SaveListingRequestSchema = z.object({
  analysisId: z.string().min(1).max(64),
  title: z.string().trim().max(120).optional(),
});
export type SaveListingRequest = z.infer<typeof SaveListingRequestSchema>;

export const UpdateSavedListingRequestSchema = z.object({
  title: z.string().trim().max(120).nullable(),
});
export type UpdateSavedListingRequest = z.infer<typeof UpdateSavedListingRequestSchema>;

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

export const ComparisonRequestSchema = z.object({
  savedListingIds: z.array(z.string().min(1).max(64)).min(2).max(10),
});
export type ComparisonRequest = z.infer<typeof ComparisonRequestSchema>;

export const ComparisonCellSchema = z.object({
  value: z.string().nullable(),
  evidence: EvidenceTypeSchema,
  /** Factual marker for numeric rows, e.g. the lowest price. Not a verdict. */
  marker: z.string().nullable(),
});
export type ComparisonCell = z.infer<typeof ComparisonCellSchema>;

export const ComparisonRowSchema = z.object({
  key: z.string(),
  label: z.string(),
  group: z.string(),
  cells: z.array(ComparisonCellSchema),
  differs: z.boolean(),
});
export type ComparisonRow = z.infer<typeof ComparisonRowSchema>;

export const ComparisonItemSchema = z.object({
  savedListingId: z.string(),
  analysisId: z.string(),
  title: z.string(),
  sourceUrl: z.string().nullable(),
  isExample: z.boolean(),
});

export const ComparisonDtoSchema = z.object({
  items: z.array(ComparisonItemSchema),
  rows: z.array(ComparisonRowSchema),
  equipment: z.array(
    z.object({
      name: z.string(),
      presentIn: z.array(z.boolean()),
    }),
  ),
  missingInformation: z.array(z.array(z.string())),
  notes: z.array(z.string()),
});
export type ComparisonDto = z.infer<typeof ComparisonDtoSchema>;

// ---------------------------------------------------------------------------
// Session, account and configuration
// ---------------------------------------------------------------------------

export const UsageSchema = z.object({
  period: z.string(),
  used: z.number().int().nonnegative(),
  limit: z.number().int().nonnegative(),
  resetsAt: z.string(),
});
export type Usage = z.infer<typeof UsageSchema>;

export const MeDtoSchema = z.object({
  user: z
    .object({
      id: z.string(),
      email: z.string(),
      createdAt: z.string(),
    })
    .nullable(),
  plan: PlanSchema,
  entitlements: EntitlementsSchema,
  usage: UsageSchema,
  subscription: z
    .object({
      status: z.string(),
      currentPeriodEnd: z.string().nullable(),
      cancelAtPeriodEnd: z.boolean(),
    })
    .nullable(),
  /** The latest concluded Pro contract (for the withdrawal notice in the account). */
  contract: z
    .object({
      orderNumber: z.string(),
      concludedAt: z.string(),
      /** Last day of the withdrawal period as YYYY-MM-DD (weekends considered). */
      withdrawalEndsAt: z.string(),
    })
    .nullable(),
});
export type MeDto = z.infer<typeof MeDtoSchema>;

export const PublicConfigSchema = z.object({
  features: z.object({
    /** Automatic retrieval of listing URLs is enabled on this server. */
    urlRetrieval: z.boolean(),
    /** Platforms whose links are retrieved; other recognized links lead to the text input. */
    retrievablePlatforms: z.array(z.enum(LISTING_PLATFORMS)),
    /** Listing photos may be shown (loaded directly from the listing's image CDN). */
    listingPhotos: z.boolean(),
    ai: z.boolean(),
    /** The AI provider that receives listing texts (null without real AI). */
    aiProvider: z.enum(['anthropic', 'openai']).nullable(),
    aiIsMock: z.boolean(),
    photoAnalysis: z.boolean(),
    billing: z.boolean(),
    passwordReset: z.boolean(),
    analytics: z.boolean(),
  }),
  plans: z.object({
    anonymous: EntitlementsSchema,
    free: EntitlementsSchema,
    pro: EntitlementsSchema,
  }),
  /** The Pro offer; null while payments are not available. */
  pro: z.object({ offer: ProOfferSchema.nullable() }),
  /** Google AdSense ad unit; null = no ads. */
  ads: z.object({ client: z.string(), slot: z.string() }).nullable(),
  /** Operator facts the privacy policy depends on. */
  privacy: z.object({
    hosting: z.enum(['render']).nullable(),
    anonymousRetentionDays: z.number().int().positive(),
    /** E-mail service, when e-mail is sent (Brevo and Gmail are recognised by their SMTP host). */
    emailProvider: z.enum(['brevo', 'gmail', 'other']).nullable(),
  }),
});
export type PublicConfig = z.infer<typeof PublicConfigSchema>;

export { EmailSchema };

export const RegisterRequestSchema = z.object({
  email: EmailSchema,
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Das Passwort muss mindestens ${PASSWORD_MIN_LENGTH} Zeichen haben.`)
    .max(PASSWORD_MAX_LENGTH, 'Das Passwort ist zu lang.'),
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const LoginRequestSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, 'Bitte gib dein Passwort ein.').max(PASSWORD_MAX_LENGTH),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const PasswordResetRequestSchema = z.object({ email: EmailSchema });
export type PasswordResetRequest = z.infer<typeof PasswordResetRequestSchema>;

export const PasswordResetConfirmSchema = z.object({
  token: z.string().min(20).max(200),
  password: RegisterRequestSchema.shape.password,
});
export type PasswordResetConfirm = z.infer<typeof PasswordResetConfirmSchema>;

export const DeleteAccountRequestSchema = z.object({
  password: z.string().min(1, 'Bitte gib dein Passwort ein.').max(PASSWORD_MAX_LENGTH),
});
export type DeleteAccountRequest = z.infer<typeof DeleteAccountRequestSchema>;

export const RedirectResponseSchema = z.object({ url: z.string() });
export type RedirectResponse = z.infer<typeof RedirectResponseSchema>;
