import {
  ACCIDENT_HISTORY_TYPES,
  CONDITION_TYPES,
  DRIVETRAIN_TYPES,
  FUEL_TYPES,
  LISTING_STATUSES,
  PRICE_KINDS,
  SELLER_TYPES,
  SERVICE_HISTORY_TYPES,
  TRANSMISSION_TYPES,
  FieldProvenanceSchema,
  ListingAttributeSchema,
  ListingImageSchema,
  VehicleFieldSchema,
  type ListingCategory,
  type ListingDto,
  type ListingSourceType,
  type NormalizedListing,
  type Vehicle,
} from '@kaufcheck/shared';
import { z } from 'zod';
import { sha256 } from '../lib/crypto';
import type { Prisma } from '../infrastructure/db/client';
import type {
  Listing as ListingRow,
  Vehicle as VehicleRow,
  ListingCategory as DbCategory,
  ListingSourceType as DbSourceType,
} from '../generated/prisma/client';

const CATEGORY_TO_DB: Record<ListingCategory, DbCategory> = {
  vehicle: 'VEHICLE',
  electronics: 'ELECTRONICS',
  computer: 'COMPUTER',
  smartphone: 'SMARTPHONE',
  camera: 'CAMERA',
  bike: 'BIKE',
  tool: 'TOOL',
  furniture: 'FURNITURE',
};
const CATEGORY_FROM_DB = Object.fromEntries(
  Object.entries(CATEGORY_TO_DB).map(([key, value]) => [value, key]),
) as Record<DbCategory, ListingCategory>;

const SOURCE_TO_DB: Record<ListingSourceType, DbSourceType> = {
  kleinanzeigen_url: 'KLEINANZEIGEN_URL',
  text: 'TEXT',
  example: 'EXAMPLE',
};
const SOURCE_FROM_DB = Object.fromEntries(
  Object.entries(SOURCE_TO_DB).map(([key, value]) => [value, key]),
) as Record<DbSourceType, ListingSourceType>;

export function sourceTypeToDb(type: ListingSourceType): DbSourceType {
  return SOURCE_TO_DB[type];
}

export function sourceTypeFromDb(type: DbSourceType): ListingSourceType {
  return SOURCE_FROM_DB[type];
}

/**
 * Identifies the same offer across snapshots: the Kleinanzeigen ad id when
 * known (also found in pasted text), otherwise a hash of the key facts.
 */
export function listingFingerprint(listing: NormalizedListing, exampleId?: string): string {
  if (listing.source.isExample) return `example:${exampleId ?? listing.source.externalId ?? 'default'}`;
  if (listing.source.externalId) return `ka:${listing.source.externalId}`;
  const vehicle = listing.vehicle;
  const key = [
    listing.title,
    listing.price?.amountEur,
    vehicle?.make,
    vehicle?.model,
    vehicle?.mileageKm,
    vehicle?.firstRegistration?.year,
    vehicle?.firstRegistration?.month,
    listing.description?.slice(0, 500),
  ]
    .map((part) => String(part ?? '').toLowerCase().trim())
    .join('|');
  return `text:${sha256(key).slice(0, 40)}`;
}

export function toListingCreate(listing: NormalizedListing, fingerprint: string): Prisma.ListingCreateInput {
  const vehicle = listing.vehicle;
  return {
    fingerprint,
    category: CATEGORY_TO_DB[listing.category],
    sourceType: SOURCE_TO_DB[listing.source.type],
    sourceUrl: listing.source.url,
    externalId: listing.source.externalId,
    status: listing.status,
    title: listing.title,
    priceEur: listing.price?.amountEur ?? null,
    priceKind: listing.price?.kind ?? null,
    priceRaw: listing.price?.raw ?? null,
    postalCode: listing.location?.postalCode ?? null,
    city: listing.location?.city ?? null,
    district: listing.location?.district ?? null,
    locationRaw: listing.location?.raw ?? null,
    sellerType: listing.seller.type,
    sellerMemberSince: listing.seller.memberSince,
    postedAt: listing.postedAt,
    description: listing.description,
    images: listing.images,
    attributes: listing.attributes,
    isExample: listing.source.isExample,
    retrievedAt: new Date(listing.source.retrievedAt),
    vehicle: vehicle
      ? {
          create: {
            make: vehicle.make,
            model: vehicle.model,
            variant: vehicle.variant,
            mileageKm: vehicle.mileageKm,
            firstRegistrationYear: vehicle.firstRegistration?.year ?? null,
            firstRegistrationMonth: vehicle.firstRegistration?.month ?? null,
            fuel: vehicle.fuel,
            powerKw: vehicle.powerKw,
            powerPs: vehicle.powerPs,
            transmission: vehicle.transmission,
            drivetrain: vehicle.drivetrain,
            huYear: vehicle.huUntil?.year ?? null,
            huMonth: vehicle.huUntil?.month ?? null,
            previousOwners: vehicle.previousOwners,
            serviceHistory: vehicle.serviceHistory,
            accidentHistory: vehicle.accidentHistory,
            condition: vehicle.condition,
            bodyType: vehicle.bodyType,
            color: vehicle.color,
            doors: vehicle.doors,
            emissionClass: vehicle.emissionClass,
            equipment: vehicle.equipment,
            fieldSources: vehicle.fieldSources,
          },
        }
      : undefined,
  };
}

function parseJson<T>(schema: z.ZodType<T>, value: unknown, fallback: T): T {
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : fallback;
}

const VehicleEnums = {
  fuel: z.enum(FUEL_TYPES),
  transmission: z.enum(TRANSMISSION_TYPES),
  drivetrain: z.enum(DRIVETRAIN_TYPES),
  serviceHistory: z.enum(SERVICE_HISTORY_TYPES),
  accidentHistory: z.enum(ACCIDENT_HISTORY_TYPES),
  condition: z.enum(CONDITION_TYPES),
  priceKind: z.enum(PRICE_KINDS),
  sellerType: z.enum(SELLER_TYPES),
  status: z.enum(LISTING_STATUSES),
};

function enumOrNull<T extends string>(schema: z.ZodType<T>, value: string | null): T | null {
  if (value === null) return null;
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function vehicleFromRow(row: VehicleRow): Vehicle {
  return {
    make: row.make,
    model: row.model,
    variant: row.variant,
    mileageKm: row.mileageKm,
    firstRegistration:
      row.firstRegistrationYear !== null
        ? { year: row.firstRegistrationYear, month: row.firstRegistrationMonth }
        : null,
    fuel: enumOrNull(VehicleEnums.fuel, row.fuel),
    powerKw: row.powerKw,
    powerPs: row.powerPs,
    transmission: enumOrNull(VehicleEnums.transmission, row.transmission),
    drivetrain: enumOrNull(VehicleEnums.drivetrain, row.drivetrain),
    huUntil: row.huYear !== null ? { year: row.huYear, month: row.huMonth } : null,
    previousOwners: row.previousOwners,
    serviceHistory: enumOrNull(VehicleEnums.serviceHistory, row.serviceHistory),
    accidentHistory: enumOrNull(VehicleEnums.accidentHistory, row.accidentHistory),
    condition: enumOrNull(VehicleEnums.condition, row.condition),
    bodyType: row.bodyType,
    color: row.color,
    doors: row.doors,
    emissionClass: row.emissionClass,
    equipment: row.equipment,
    fieldSources: parseJson(z.partialRecord(VehicleFieldSchema, FieldProvenanceSchema), row.fieldSources, {}),
  };
}

export function listingFromRow(row: ListingRow & { vehicle: VehicleRow | null }): ListingDto {
  const priceKind = enumOrNull(VehicleEnums.priceKind, row.priceKind);
  return {
    id: row.id,
    category: CATEGORY_FROM_DB[row.category],
    source: {
      type: SOURCE_FROM_DB[row.sourceType],
      url: row.sourceUrl,
      externalId: row.externalId,
      retrievedAt: row.retrievedAt.toISOString(),
      isExample: row.isExample,
    },
    status: enumOrNull(VehicleEnums.status, row.status),
    title: row.title,
    price:
      row.priceEur !== null && priceKind
        ? { amountEur: row.priceEur, kind: priceKind, raw: row.priceRaw ?? '' }
        : null,
    location: row.locationRaw
      ? { postalCode: row.postalCode, city: row.city, district: row.district, raw: row.locationRaw }
      : null,
    seller: { type: enumOrNull(VehicleEnums.sellerType, row.sellerType), memberSince: row.sellerMemberSince },
    postedAt: row.postedAt,
    description: row.description,
    images: parseJson(z.array(ListingImageSchema), row.images, []),
    attributes: parseJson(z.array(ListingAttributeSchema), row.attributes, []),
    vehicle: row.vehicle ? vehicleFromRow(row.vehicle) : null,
  };
}
