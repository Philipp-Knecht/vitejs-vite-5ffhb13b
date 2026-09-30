import { z } from 'zod';
import { LISTING_CATEGORIES } from '../categories';
import { FACT_SOURCES } from '../evidence';
import {
  ACCIDENT_HISTORY_TYPES,
  CONDITION_TYPES,
  DRIVETRAIN_TYPES,
  FUEL_TYPES,
  PRICE_KINDS,
  SELLER_TYPES,
  SERVICE_HISTORY_TYPES,
  TRANSMISSION_TYPES,
} from '../labels';

export const ListingCategorySchema = z.enum(LISTING_CATEGORIES);
export const FactSourceSchema = z.enum(FACT_SOURCES);

export const LISTING_SOURCE_TYPES = ['kleinanzeigen_url', 'text', 'example'] as const;
export const ListingSourceTypeSchema = z.enum(LISTING_SOURCE_TYPES);
export type ListingSourceType = z.infer<typeof ListingSourceTypeSchema>;

export const ListingSourceSchema = z.object({
  type: ListingSourceTypeSchema,
  url: z.string().nullable(),
  externalId: z.string().nullable(),
  retrievedAt: z.string(),
  /** Example listings are fictional demo data and must be labelled as such. */
  isExample: z.boolean(),
});
export type ListingSource = z.infer<typeof ListingSourceSchema>;

export const PriceSchema = z.object({
  amountEur: z.number().int().nonnegative(),
  kind: z.enum(PRICE_KINDS),
  raw: z.string(),
});
export type Price = z.infer<typeof PriceSchema>;

export const LocationSchema = z.object({
  postalCode: z.string().nullable(),
  city: z.string().nullable(),
  district: z.string().nullable(),
  raw: z.string(),
});
export type Location = z.infer<typeof LocationSchema>;

/** Seller names and contact data are deliberately not stored or returned. */
export const SellerSchema = z.object({
  type: z.enum(SELLER_TYPES).nullable(),
  memberSince: z.string().nullable(),
});
export type Seller = z.infer<typeof SellerSchema>;

export const ListingImageSchema = z.object({
  url: z.string(),
  thumbnailUrl: z.string().nullable(),
});
export type ListingImage = z.infer<typeof ListingImageSchema>;

export const ListingAttributeSchema = z.object({
  label: z.string(),
  value: z.string(),
});
export type ListingAttribute = z.infer<typeof ListingAttributeSchema>;

export const YearMonthSchema = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(12).nullable(),
});
export type YearMonth = z.infer<typeof YearMonthSchema>;

export const VEHICLE_FIELDS = [
  'make',
  'model',
  'variant',
  'mileageKm',
  'firstRegistration',
  'fuel',
  'power',
  'transmission',
  'drivetrain',
  'huUntil',
  'previousOwners',
  'serviceHistory',
  'accidentHistory',
  'condition',
  'bodyType',
  'color',
  'doors',
  'emissionClass',
  'equipment',
] as const;
export const VehicleFieldSchema = z.enum(VEHICLE_FIELDS);
export type VehicleField = z.infer<typeof VehicleFieldSchema>;

export const FieldProvenanceSchema = z.object({
  source: FactSourceSchema,
  /** The original text the value was derived from. */
  raw: z.string(),
});
export type FieldProvenance = z.infer<typeof FieldProvenanceSchema>;

export const VehicleSchema = z.object({
  make: z.string().nullable(),
  model: z.string().nullable(),
  variant: z.string().nullable(),
  mileageKm: z.number().int().nonnegative().nullable(),
  firstRegistration: YearMonthSchema.nullable(),
  fuel: z.enum(FUEL_TYPES).nullable(),
  powerKw: z.number().int().positive().nullable(),
  powerPs: z.number().int().positive().nullable(),
  transmission: z.enum(TRANSMISSION_TYPES).nullable(),
  drivetrain: z.enum(DRIVETRAIN_TYPES).nullable(),
  huUntil: YearMonthSchema.nullable(),
  /** Number of registered keepers so far ("2. Hand" = 2). */
  previousOwners: z.number().int().nonnegative().nullable(),
  serviceHistory: z.enum(SERVICE_HISTORY_TYPES).nullable(),
  accidentHistory: z.enum(ACCIDENT_HISTORY_TYPES).nullable(),
  condition: z.enum(CONDITION_TYPES).nullable(),
  bodyType: z.string().nullable(),
  color: z.string().nullable(),
  doors: z.string().nullable(),
  emissionClass: z.string().nullable(),
  equipment: z.array(z.string()),
  fieldSources: z.partialRecord(VehicleFieldSchema, FieldProvenanceSchema),
});
export type Vehicle = z.infer<typeof VehicleSchema>;

export const LISTING_STATUSES = ['active', 'reserved', 'deleted'] as const;

export const NormalizedListingSchema = z.object({
  category: ListingCategorySchema,
  source: ListingSourceSchema,
  /** Status shown on the listing page; `null` when unknown (e.g. pasted text). */
  status: z.enum(LISTING_STATUSES).nullable(),
  title: z.string().nullable(),
  price: PriceSchema.nullable(),
  location: LocationSchema.nullable(),
  seller: SellerSchema,
  postedAt: z.string().nullable(),
  description: z.string().nullable(),
  images: z.array(ListingImageSchema),
  attributes: z.array(ListingAttributeSchema),
  vehicle: VehicleSchema.nullable(),
});
export type NormalizedListing = z.infer<typeof NormalizedListingSchema>;

/** Listing as returned by the API (persisted, with id). */
export const ListingDtoSchema = NormalizedListingSchema.extend({
  id: z.string(),
});
export type ListingDto = z.infer<typeof ListingDtoSchema>;
