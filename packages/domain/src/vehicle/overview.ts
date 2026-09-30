import {
  ACCIDENT_HISTORY_LABELS,
  CONDITION_LABELS,
  DRIVETRAIN_LABELS,
  FUEL_LABELS,
  PRICE_KIND_LABELS,
  SELLER_TYPE_LABELS,
  SERVICE_HISTORY_LABELS,
  TRANSMISSION_LABELS,
  type OverviewItem,
  type VehicleField,
  type VehicleSummary,
} from '@kaufcheck/shared';
import {
  formatEuro,
  formatIsoDate,
  formatKm,
  formatMonthsDuration,
  formatNumber,
  formatPower,
  formatYearMonth,
  plural,
} from '../format';
import type { VehicleRuleContext } from './rule-context';

const SOURCE_NOTES = {
  details: null,
  page: null,
  title: 'aus dem Titel erkannt',
  description: 'laut Beschreibung',
  equipment: 'aus der Ausstattungsliste',
  user: 'von dir ergänzt',
} as const;

function fact(
  ctx: VehicleRuleContext,
  key: string,
  label: string,
  value: string | null,
  field: VehicleField | null,
  extraNote: string | null = null,
): OverviewItem {
  const source = field ? ctx.vehicle.fieldSources[field]?.source : undefined;
  const sourceNote = source ? SOURCE_NOTES[source] : null;
  const note = [sourceNote, extraNote].filter(Boolean).join(' · ') || null;
  return {
    key,
    label,
    value,
    evidence: value === null ? 'unknown' : 'listing_fact',
    note: value === null ? null : note,
  };
}

/** Key facts for the overview section. Missing values are shown as "Nicht angegeben". */
export function buildOverview(ctx: VehicleRuleContext): OverviewItem[] {
  const { vehicle, listing } = ctx;
  const items: OverviewItem[] = [];
  const price = listing.price;

  items.push({
    key: 'price',
    label: 'Preis',
    value: price
      ? price.kind === 'give_away'
        ? 'Zu verschenken'
        : formatEuro(price.amountEur)
      : null,
    evidence: price ? 'listing_fact' : 'unknown',
    note:
      price && price.kind !== 'asking' && price.kind !== 'give_away'
        ? PRICE_KIND_LABELS[price.kind]
        : null,
  });
  items.push(
    fact(
      ctx,
      'mileage',
      'Kilometerstand',
      vehicle.mileageKm !== null ? formatKm(vehicle.mileageKm) : null,
      'mileageKm',
    ),
  );
  items.push(
    fact(
      ctx,
      'firstRegistration',
      'Erstzulassung',
      vehicle.firstRegistration ? formatYearMonth(vehicle.firstRegistration) : null,
      'firstRegistration',
    ),
  );
  if (ctx.ageMonths !== null && ctx.ageMonths >= 0) {
    items.push({
      key: 'age',
      label: 'Alter',
      value: `${ctx.ageApproximate ? 'ca. ' : ''}${formatMonthsDuration(ctx.ageMonths)}`,
      evidence: 'calculation',
      note: 'seit Erstzulassung',
    });
  }
  items.push(
    fact(
      ctx,
      'power',
      'Leistung',
      vehicle.powerKw !== null && vehicle.powerPs !== null
        ? formatPower(vehicle.powerKw, vehicle.powerPs)
        : null,
      'power',
    ),
  );
  items.push(
    fact(ctx, 'fuel', 'Kraftstoff', vehicle.fuel ? FUEL_LABELS[vehicle.fuel] : null, 'fuel'),
  );
  items.push(
    fact(
      ctx,
      'transmission',
      'Getriebe',
      vehicle.transmission ? TRANSMISSION_LABELS[vehicle.transmission] : null,
      'transmission',
    ),
  );
  if (vehicle.drivetrain) {
    items.push(
      fact(ctx, 'drivetrain', 'Antrieb', DRIVETRAIN_LABELS[vehicle.drivetrain], 'drivetrain'),
    );
  }

  if (vehicle.huUntil && ctx.huMonthsLeft !== null) {
    const left = ctx.huMonthsLeft;
    items.push({
      key: 'hu',
      label: 'HU/AU',
      value: `bis ${formatYearMonth(vehicle.huUntil)}`,
      evidence: 'listing_fact',
      note:
        left < 0
          ? `seit ${plural(Math.abs(left), 'Monat', 'Monaten')} abgelaufen (berechnet)`
          : left === 0
            ? 'läuft diesen Monat ab (berechnet)'
            : `noch ${plural(left, 'Monat', 'Monate')} gültig (berechnet)`,
    });
  } else if (ctx.signals.huNew) {
    items.push({
      key: 'hu',
      label: 'HU/AU',
      value: 'neu',
      evidence: 'listing_fact',
      note: 'laut Beschreibung',
    });
  } else {
    items.push({ key: 'hu', label: 'HU/AU', value: null, evidence: 'unknown', note: null });
  }

  items.push({
    key: 'location',
    label: 'Standort',
    value: listing.location?.raw ?? null,
    evidence: listing.location ? 'listing_fact' : 'unknown',
    note: null,
  });
  items.push({
    key: 'seller',
    label: 'Verkäufer',
    value: listing.seller.type ? SELLER_TYPE_LABELS[listing.seller.type] : null,
    evidence: listing.seller.type ? 'listing_fact' : 'unknown',
    note: listing.seller.memberSince
      ? `bei Kleinanzeigen aktiv seit ${formatIsoDate(listing.seller.memberSince)}`
      : null,
  });
  items.push(
    fact(
      ctx,
      'previousOwners',
      'Vorbesitzer',
      vehicle.previousOwners !== null ? plural(vehicle.previousOwners, 'Halter', 'Halter') : null,
      'previousOwners',
    ),
  );
  items.push(
    fact(
      ctx,
      'accidentHistory',
      'Unfallfreiheit',
      vehicle.accidentHistory ? ACCIDENT_HISTORY_LABELS[vehicle.accidentHistory] : null,
      'accidentHistory',
    ),
  );
  items.push(
    fact(
      ctx,
      'serviceHistory',
      'Servicehistorie',
      vehicle.serviceHistory ? SERVICE_HISTORY_LABELS[vehicle.serviceHistory] : null,
      'serviceHistory',
    ),
  );
  if (vehicle.condition) {
    items.push(
      fact(ctx, 'condition', 'Fahrzeugzustand', CONDITION_LABELS[vehicle.condition], 'condition'),
    );
  }
  if (vehicle.bodyType)
    items.push(fact(ctx, 'bodyType', 'Fahrzeugtyp', vehicle.bodyType, 'bodyType'));
  if (vehicle.color) items.push(fact(ctx, 'color', 'Farbe', vehicle.color, 'color'));
  if (vehicle.emissionClass) {
    items.push(
      fact(ctx, 'emissionClass', 'Schadstoffklasse', vehicle.emissionClass, 'emissionClass'),
    );
  }
  if (listing.postedAt) {
    items.push({
      key: 'postedAt',
      label: 'Inseriert am',
      value: formatIsoDate(listing.postedAt),
      evidence: 'listing_fact',
      note: null,
    });
  }
  return items;
}

export function buildVehicleTitle(ctx: VehicleRuleContext): string {
  const { vehicle, listing } = ctx;
  const parts = [vehicle.make, vehicle.model, vehicle.variant].filter((part): part is string =>
    Boolean(part),
  );
  if (parts.length >= 2) return parts.join(' ');
  return listing.title ?? (vehicle.make ? vehicle.make : 'Fahrzeug');
}

export function buildVehicleSummary(ctx: VehicleRuleContext): VehicleSummary {
  const { vehicle, listing } = ctx;
  const chips: VehicleSummary['chips'] = [];
  if (vehicle.firstRegistration)
    chips.push({ key: 'year', text: String(vehicle.firstRegistration.year) });
  if (vehicle.mileageKm !== null) chips.push({ key: 'mileage', text: formatKm(vehicle.mileageKm) });
  if (vehicle.powerPs !== null)
    chips.push({ key: 'power', text: `${formatNumber(vehicle.powerPs)}\u00A0PS` });
  if (vehicle.transmission)
    chips.push({ key: 'transmission', text: TRANSMISSION_LABELS[vehicle.transmission] });
  if (vehicle.fuel) chips.push({ key: 'fuel', text: FUEL_LABELS[vehicle.fuel] });
  if (listing.price) {
    chips.push({
      key: 'price',
      text:
        listing.price.kind === 'give_away'
          ? 'Zu verschenken'
          : `${formatEuro(listing.price.amountEur)}${listing.price.kind === 'negotiable' ? ' VB' : ''}`,
    });
  }
  return { title: buildVehicleTitle(ctx), chips };
}
