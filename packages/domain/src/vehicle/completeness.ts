import {
  ACCIDENT_HISTORY_LABELS,
  FUEL_LABELS,
  SERVICE_HISTORY_LABELS,
  TRANSMISSION_LABELS,
  type Completeness,
  type CompletenessField,
} from '@kaufcheck/shared';
import {
  formatEuro,
  formatKm,
  formatNumber,
  formatPower,
  formatYearMonth,
  plural,
} from '../format';
import type { VehicleRuleContext } from './rule-context';

/** A description with fewer words than this is not counted as informative. */
export const MIN_INFORMATIVE_DESCRIPTION_WORDS = 30;
export const MIN_PHOTOS = 3;

function field(
  key: string,
  label: string,
  value: string | null,
  note: string | null = null,
): CompletenessField {
  return { key, label, status: value !== null ? 'present' : 'missing', value, note };
}

/**
 * Transparent completeness score: a fixed list of fields, each counted
 * equally. Fields the source cannot provide (photos in pasted text) are
 * marked "not checkable" and excluded instead of being counted as missing.
 */
export function assessCompleteness(ctx: VehicleRuleContext): Completeness {
  const { vehicle, listing, signals } = ctx;

  const price = listing.price
    ? listing.price.kind === 'give_away'
      ? 'Zu verschenken'
      : formatEuro(listing.price.amountEur)
    : null;

  const hu = vehicle.huUntil
    ? `bis ${formatYearMonth(vehicle.huUntil)}`
    : signals.huNew
      ? 'HU neu (laut Beschreibung)'
      : null;

  const accidentNote =
    vehicle.accidentHistory === null && vehicle.condition === 'undamaged'
      ? '„Unbeschädigt“ ist angegeben – das sagt nichts über reparierte Vorschäden aus.'
      : null;

  const descriptionValue =
    ctx.descriptionWords >= MIN_INFORMATIVE_DESCRIPTION_WORDS
      ? plural(ctx.descriptionWords, 'Wort', 'Wörter')
      : null;
  const descriptionNote =
    ctx.descriptionWords === 0
      ? 'Keine Beschreibung vorhanden.'
      : ctx.descriptionWords < MIN_INFORMATIVE_DESCRIPTION_WORDS
        ? `Nur ${plural(ctx.descriptionWords, 'Wort', 'Wörter')}.`
        : null;

  const photosCheckable = ctx.sourceType === 'kleinanzeigen_url' || listing.images.length > 0;
  const photos: CompletenessField = photosCheckable
    ? field(
        'photos',
        'Fotos',
        listing.images.length >= MIN_PHOTOS ? plural(listing.images.length, 'Foto', 'Fotos') : null,
        listing.images.length > 0 && listing.images.length < MIN_PHOTOS
          ? `Nur ${plural(listing.images.length, 'Foto', 'Fotos')}.`
          : null,
      )
    : {
        key: 'photos',
        label: 'Fotos',
        status: 'not_checkable',
        value: null,
        note: 'Bei eingefügtem Text können Fotos nicht geprüft werden.',
      };

  const fields: CompletenessField[] = [
    field(
      'makeModel',
      'Marke & Modell',
      vehicle.make && vehicle.model ? `${vehicle.make} ${vehicle.model}` : null,
      vehicle.make && !vehicle.model ? `Nur die Marke (${vehicle.make}) ist angegeben.` : null,
    ),
    field('price', 'Preis', price),
    field(
      'mileage',
      'Kilometerstand',
      vehicle.mileageKm !== null ? formatKm(vehicle.mileageKm) : null,
    ),
    field(
      'firstRegistration',
      'Erstzulassung',
      vehicle.firstRegistration ? formatYearMonth(vehicle.firstRegistration) : null,
    ),
    field('fuel', 'Kraftstoff', vehicle.fuel ? FUEL_LABELS[vehicle.fuel] : null),
    field(
      'power',
      'Leistung',
      vehicle.powerKw !== null && vehicle.powerPs !== null
        ? formatPower(vehicle.powerKw, vehicle.powerPs)
        : null,
    ),
    field(
      'transmission',
      'Getriebe',
      vehicle.transmission ? TRANSMISSION_LABELS[vehicle.transmission] : null,
    ),
    field('hu', 'HU/AU', hu),
    field(
      'accidentHistory',
      'Unfallfreiheit',
      vehicle.accidentHistory ? ACCIDENT_HISTORY_LABELS[vehicle.accidentHistory] : null,
      accidentNote,
    ),
    field(
      'serviceHistory',
      'Servicehistorie',
      vehicle.serviceHistory ? SERVICE_HISTORY_LABELS[vehicle.serviceHistory] : null,
    ),
    field(
      'previousOwners',
      'Anzahl Vorbesitzer',
      vehicle.previousOwners !== null ? plural(vehicle.previousOwners, 'Halter', 'Halter') : null,
    ),
    field('description', 'Aussagekräftige Beschreibung', descriptionValue, descriptionNote),
    photos,
    field('location', 'Standort', listing.location?.raw ?? null),
    field(
      'equipment',
      'Ausstattung',
      vehicle.equipment.length > 0 ? `${formatNumber(vehicle.equipment.length)} Merkmale` : null,
    ),
  ];

  const checkable = fields.filter((f) => f.status !== 'not_checkable');
  const present = checkable.filter((f) => f.status === 'present');
  const score = checkable.length === 0 ? 0 : Math.round((present.length / checkable.length) * 100);

  return {
    score,
    presentCount: present.length,
    checkableCount: checkable.length,
    fields,
  };
}
