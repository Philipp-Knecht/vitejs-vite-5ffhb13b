import { z } from 'zod';
import {
  ANALYSIS_STAGES,
  MAX_LISTING_TEXT_LENGTH,
  MIN_LISTING_TEXT_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '../constants';
import { ApiErrorSchema } from './errors';
import { FUEL_TYPES } from '../labels';
import { CAR_LOG_KINDS } from '../car-log';
import { REMINDER_KINDS } from '../reminders';
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
// Saved car searches (Pro)
// ---------------------------------------------------------------------------

export const SavedSearchDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** The search in KaufCheck's own address format (`marke=vw&modell=vw-golf&…`). */
  query: z.string(),
  createdAt: z.string(),
});
export type SavedSearchDto = z.infer<typeof SavedSearchDtoSchema>;

export const SavedSearchesResponseSchema = z.object({
  items: z.array(SavedSearchDtoSchema),
  limit: z.number().int().nonnegative(),
});
export type SavedSearchesResponse = z.infer<typeof SavedSearchesResponseSchema>;

export const SaveSearchRequestSchema = z.object({
  name: z.string().trim().min(1).max(80),
  query: z.string().max(600),
});
export type SaveSearchRequest = z.infer<typeof SaveSearchRequestSchema>;

// ---------------------------------------------------------------------------
// Mein Auto: the cars a user owns
// ---------------------------------------------------------------------------

const CarYearSchema = z.number().int().min(1950).max(2100);

/** One line of text without control characters (a NUL byte cannot be stored, a line break makes no sense). */
const lineOfText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Bitte höchstens ${max} Zeichen.`)
    .refine(
      (value) => ![...value].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127),
      'Bitte ohne Zeilenumbrüche und Steuerzeichen.',
    );
const CarMonthSchema = z.number().int().min(1).max(12);

/** What the user enters about a car they own; catalog ids are checked by the server. */
export const OwnedCarInputSchema = z.object({
  nickname: lineOfText(60).nullable(),
  /** Catalog make id, e.g. `vw`. */
  makeId: z.string().min(1).max(40),
  /** Catalog model id when the model is known, e.g. `vw-golf`. */
  modelId: z.string().min(1).max(80).nullable(),
  /** The model as the user calls it, shown when there is no catalog model. */
  modelName: lineOfText(60).pipe(z.string().min(1, 'Bitte nenne das Modell.')),
  generationId: z.string().min(1).max(80).nullable(),
  fuel: z.enum(FUEL_TYPES).nullable(),
  firstRegistration: z.object({ year: CarYearSchema, month: CarMonthSchema.nullable() }),
  mileageKm: z.number().int().min(0).max(2_000_000).nullable(),
  /** Month and year on the HU badge (Prüfplakette). */
  huUntil: z.object({ year: CarYearSchema, month: CarMonthSchema }).nullable(),
});
export type OwnedCarInput = z.infer<typeof OwnedCarInputSchema>;

export const OwnedCarDtoSchema = OwnedCarInputSchema.extend({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type OwnedCarDto = z.infer<typeof OwnedCarDtoSchema>;

export const OwnedCarsResponseSchema = z.object({
  items: z.array(OwnedCarDtoSchema),
  limit: z.number().int().nonnegative(),
});
export type OwnedCarsResponse = z.infer<typeof OwnedCarsResponseSchema>;

/** A date as YYYY-MM-DD that exists in the calendar. */
const DaySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Bitte gib ein gültiges Datum an.')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, 'Bitte gib ein gültiges Datum an.');

/** Free text over several lines, without other control characters. */
const noteText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Bitte höchstens ${max} Zeichen.`)
    .refine(
      (value) =>
        ![...value].some((char) => {
          const code = char.charCodeAt(0);
          return (
            (code < 32 && char !== '\n') ||
            (code >= 127 && code <= 159) ||
            (code >= 0x202a && code <= 0x202e) ||
            (code >= 0x2066 && code <= 0x2069)
          );
        }),
      'Bitte ohne Steuerzeichen.',
    );

/** One entry in the cost book and service history of a car (Pro). */
export const CarLogEntryInputSchema = z.object({
  date: DaySchema,
  kind: z.enum(CAR_LOG_KINDS),
  odometerKm: z.number().int().min(0).max(2_000_000).nullable(),
  /** In euro cents; null for an entry without costs, e.g. work under warranty. */
  amountCents: z.number().int().min(0).max(100_000_000).nullable(),
  /** Litres or kWh, two decimals at most. */
  quantity: z
    .number()
    .positive()
    .max(10_000)
    .refine(
      (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6,
      'Bitte höchstens zwei Nachkommastellen.',
    )
    .nullable(),
  fullTank: z.boolean(),
  /** A fill-up before this one was not entered; optional for clients from before it existed. */
  missedBefore: z.boolean().default(false),
  workshop: lineOfText(100).nullable(),
  note: noteText(500).nullable(),
  /** The owner keeps an invoice or receipt for it. */
  invoice: z.boolean(),
});
export type CarLogEntryInput = z.infer<typeof CarLogEntryInputSchema>;

export const CarLogEntryDtoSchema = CarLogEntryInputSchema.extend({
  id: z.string(),
  carId: z.string(),
  createdAt: z.string(),
});
export type CarLogEntryDto = z.infer<typeof CarLogEntryDtoSchema>;

export const CarLogResponseSchema = z.object({
  items: z.array(CarLogEntryDtoSchema),
  limit: z.number().int().nonnegative(),
  /** False without Pro: the entries can be read, exported and deleted, but not added. */
  editable: z.boolean(),
});
export type CarLogResponse = z.infer<typeof CarLogResponseSchema>;

// ---------------------------------------------------------------------------
// Reminders for the cars in „Mein Auto“
// ---------------------------------------------------------------------------

export const ReminderKindSchema = z.enum(REMINDER_KINDS);

const ReminderMonthSchema = z.object({ year: CarYearSchema, month: CarMonthSchema });

export const ReminderDtoSchema = z.object({
  kind: ReminderKindSchema,
  /** The e-mail reminder is switched on. */
  email: z.boolean(),
  /** Inspection: the month it is due; brake fluid: the month of the last change. */
  month: ReminderMonthSchema.nullable(),
  /** The due date the last e-mail was about (see `dueOccurrence`). */
  lastSentKey: z.string().nullable(),
});
export type ReminderDto = z.infer<typeof ReminderDtoSchema>;

export const CarRemindersResponseSchema = z.object({
  /** One per kind, in the order of `REMINDER_KINDS`. */
  items: z.array(ReminderDtoSchema),
  /** The account's address: reminders go there once it is confirmed. */
  emailAddress: z.string(),
  emailConfirmed: z.boolean(),
  /** A confirmation link was sent and is still valid. */
  confirmationPending: z.boolean(),
  /** False without Pro: reminders can be switched off, not on. */
  editable: z.boolean(),
});
export type CarRemindersResponse = z.infer<typeof CarRemindersResponseSchema>;

export const ReminderInputSchema = z.object({
  email: z.boolean(),
  month: ReminderMonthSchema.nullable(),
});
export type ReminderInput = z.infer<typeof ReminderInputSchema>;

export const ReminderConfirmRequestSchema = z.object({ token: z.string().min(16).max(200) });

export const ReminderUnsubscribeRequestSchema = z.object({
  reminder: z.string().min(1).max(64),
  token: z.string().min(16).max(200),
});

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
  /** The underlying numbers of numeric rows (for weighing by the buyer's priorities). */
  numbers: z.array(z.number().nullable()).optional(),
});
export type ComparisonRow = z.infer<typeof ComparisonRowSchema>;

export const ComparisonItemSchema = z.object({
  savedListingId: z.string(),
  analysisId: z.string(),
  title: z.string(),
  sourceUrl: z.string().nullable(),
  isExample: z.boolean(),
  /** For looking up what is known about the model. */
  vehicle: z
    .object({
      make: z.string().nullable(),
      model: z.string().nullable(),
      firstRegistrationYear: z.number().int().nullable(),
      /** For the monthly costs (Pro): tax calculator link and units. */
      firstRegistrationMonth: z.number().int().nullable().optional(),
      fuel: z.enum(FUEL_TYPES).nullable().optional(),
    })
    .nullable()
    .optional(),
  /** The asking price, if the listing names one. */
  askingPriceEur: z.number().int().nullable().optional(),
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
    /** E-mail reminders can be sent (e-mail and operator details configured). */
    reminders: z.boolean(),
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
