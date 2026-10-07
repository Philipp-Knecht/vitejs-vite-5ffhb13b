import {
  ACCIDENT_HISTORY_LABELS,
  CONDITION_LABELS,
  DRIVETRAIN_LABELS,
  FUEL_LABELS,
  SELLER_TYPE_LABELS,
  SERVICE_HISTORY_LABELS,
  TRANSMISSION_LABELS,
  type AnalysisResult,
  type ComparisonCell,
  type ComparisonDto,
  type ComparisonRow,
  type EvidenceType,
  type NormalizedListing,
} from '@kaufcheck/shared';
import {
  formatEuro,
  formatKm,
  formatMonthsDuration,
  formatNumber,
  formatPower,
  formatYearMonth,
  plural,
} from '../format';
import { buildRuleContext, type VehicleRuleContext } from '../vehicle/rule-context';

export interface ComparisonInput {
  savedListingId: string;
  analysisId: string;
  title: string;
  listing: NormalizedListing;
  analysis: AnalysisResult;
}

interface RowSpec {
  key: string;
  label: string;
  group: string;
  cell: (
    item: ComparisonInput,
    ctx: VehicleRuleContext | null,
  ) => { value: string | null; evidence: EvidenceType; numeric?: number | null };
  /** Marks the lowest or highest numeric value with a factual label. */
  marker?: { prefer: 'min' | 'max'; label: string };
}

const listingFact = (value: string | null): { value: string | null; evidence: EvidenceType } => ({
  value,
  evidence: value === null ? 'unknown' : 'listing_fact',
});

const ROWS: readonly RowSpec[] = [
  {
    key: 'price',
    label: 'Preis',
    group: 'Eckdaten',
    cell: (item) => ({
      ...listingFact(
        item.listing.price
          ? item.listing.price.kind === 'give_away'
            ? 'Zu verschenken'
            : `${formatEuro(item.listing.price.amountEur)}${item.listing.price.kind === 'negotiable' ? ' VB' : ''}`
          : null,
      ),
      numeric: item.listing.price?.amountEur ?? null,
    }),
    marker: { prefer: 'min', label: 'niedrigster Preis' },
  },
  {
    key: 'mileage',
    label: 'Kilometerstand',
    group: 'Eckdaten',
    cell: (item) => ({
      ...listingFact(
        item.listing.vehicle?.mileageKm != null ? formatKm(item.listing.vehicle.mileageKm) : null,
      ),
      numeric: item.listing.vehicle?.mileageKm ?? null,
    }),
    marker: { prefer: 'min', label: 'geringste Laufleistung' },
  },
  {
    key: 'firstRegistration',
    label: 'Erstzulassung',
    group: 'Eckdaten',
    cell: (item) => {
      const registration = item.listing.vehicle?.firstRegistration ?? null;
      return {
        ...listingFact(registration ? formatYearMonth(registration) : null),
        numeric: registration ? registration.year * 12 + (registration.month ?? 7) : null,
      };
    },
    marker: { prefer: 'max', label: 'jüngstes Fahrzeug' },
  },
  {
    key: 'age',
    label: 'Alter',
    group: 'Eckdaten',
    cell: (_item, ctx) => ({
      value:
        ctx?.ageMonths != null && ctx.ageMonths >= 0
          ? `${ctx.ageApproximate ? 'ca. ' : ''}${formatMonthsDuration(ctx.ageMonths)}`
          : null,
      evidence: ctx?.ageMonths != null ? 'calculation' : 'unknown',
      numeric: ctx?.ageMonths != null && ctx.ageMonths >= 0 ? ctx.ageMonths : null,
    }),
  },
  {
    key: 'kmPerYear',
    label: 'Laufleistung pro Jahr',
    group: 'Eckdaten',
    cell: (_item, ctx) => ({
      value: ctx?.kmPerYear != null ? formatKm(ctx.kmPerYear) : null,
      evidence: ctx?.kmPerYear != null ? 'calculation' : 'unknown',
      numeric: ctx?.kmPerYear ?? null,
    }),
  },
  {
    key: 'power',
    label: 'Leistung',
    group: 'Technik',
    cell: (item) => {
      const vehicle = item.listing.vehicle;
      return {
        ...listingFact(
          vehicle?.powerKw != null && vehicle.powerPs != null
            ? formatPower(vehicle.powerKw, vehicle.powerPs)
            : null,
        ),
        numeric: vehicle?.powerPs ?? null,
      };
    },
    marker: { prefer: 'max', label: 'höchste Leistung' },
  },
  {
    key: 'fuel',
    label: 'Kraftstoff',
    group: 'Technik',
    cell: (item) =>
      listingFact(item.listing.vehicle?.fuel ? FUEL_LABELS[item.listing.vehicle.fuel] : null),
  },
  {
    key: 'transmission',
    label: 'Getriebe',
    group: 'Technik',
    cell: (item) =>
      listingFact(
        item.listing.vehicle?.transmission
          ? TRANSMISSION_LABELS[item.listing.vehicle.transmission]
          : null,
      ),
  },
  {
    key: 'drivetrain',
    label: 'Antrieb',
    group: 'Technik',
    cell: (item) =>
      listingFact(
        item.listing.vehicle?.drivetrain
          ? DRIVETRAIN_LABELS[item.listing.vehicle.drivetrain]
          : null,
      ),
  },
  {
    key: 'hu',
    label: 'HU bis',
    group: 'Zustand & Historie',
    cell: (item, ctx) => {
      const hu = item.listing.vehicle?.huUntil ?? null;
      return {
        ...listingFact(hu ? formatYearMonth(hu) : null),
        numeric: ctx?.huMonthsLeft ?? null,
      };
    },
    marker: { prefer: 'max', label: 'längste HU-Restlaufzeit' },
  },
  {
    key: 'accidentHistory',
    label: 'Unfallfreiheit',
    group: 'Zustand & Historie',
    cell: (item) =>
      listingFact(
        item.listing.vehicle?.accidentHistory
          ? ACCIDENT_HISTORY_LABELS[item.listing.vehicle.accidentHistory]
          : null,
      ),
  },
  {
    key: 'serviceHistory',
    label: 'Servicehistorie',
    group: 'Zustand & Historie',
    cell: (item) =>
      listingFact(
        item.listing.vehicle?.serviceHistory
          ? SERVICE_HISTORY_LABELS[item.listing.vehicle.serviceHistory]
          : null,
      ),
  },
  {
    key: 'previousOwners',
    label: 'Vorbesitzer',
    group: 'Zustand & Historie',
    cell: (item) => {
      const owners = item.listing.vehicle?.previousOwners ?? null;
      return {
        ...listingFact(owners !== null ? plural(owners, 'Halter', 'Halter') : null),
        numeric: owners,
      };
    },
    marker: { prefer: 'min', label: 'wenigste Halter' },
  },
  {
    key: 'condition',
    label: 'Fahrzeugzustand',
    group: 'Zustand & Historie',
    cell: (item) =>
      listingFact(
        item.listing.vehicle?.condition ? CONDITION_LABELS[item.listing.vehicle.condition] : null,
      ),
  },
  {
    key: 'seller',
    label: 'Verkäufer',
    group: 'Inserat',
    cell: (item) =>
      listingFact(item.listing.seller.type ? SELLER_TYPE_LABELS[item.listing.seller.type] : null),
  },
  {
    key: 'location',
    label: 'Standort',
    group: 'Inserat',
    cell: (item) => listingFact(item.listing.location?.raw ?? null),
  },
  {
    key: 'completeness',
    label: 'Vollständigkeit',
    group: 'Inserat',
    cell: (item) => ({
      value: `${item.analysis.completeness.score}\u00A0% (${item.analysis.completeness.presentCount}/${item.analysis.completeness.checkableCount})`,
      evidence: 'calculation',
      numeric: item.analysis.completeness.score,
    }),
    marker: { prefer: 'max', label: 'vollständigstes Inserat' },
  },
  {
    key: 'observations',
    label: 'Auffälligkeiten',
    group: 'Inserat',
    cell: (item) => {
      const count = item.analysis.observations.filter(
        (observation) => observation.severity !== 'info',
      ).length;
      return {
        value: count === 0 ? 'keine' : formatNumber(count),
        evidence: 'calculation',
        numeric: count,
      };
    },
  },
  {
    key: 'pricePer10k',
    label: 'Preis je 10.000 km',
    group: 'Inserat',
    cell: (item) => {
      const metric = item.analysis.priceContext.metrics.find((m) => m.key === 'price_per_10000_km');
      return {
        value: metric ? metric.value : null,
        evidence: metric ? 'calculation' : 'unknown',
        numeric: metric?.numericValue ?? null,
      };
    },
  },
];

function markerCells(
  spec: RowSpec,
  cells: { value: string | null; evidence: EvidenceType; numeric?: number | null }[],
): ComparisonCell[] {
  const numbers = cells.map((cell) => (typeof cell.numeric === 'number' ? cell.numeric : null));
  const known = numbers.filter((value): value is number => value !== null);
  let target: number | null = null;
  if (spec.marker && known.length >= 2 && new Set(known).size > 1) {
    target = spec.marker.prefer === 'min' ? Math.min(...known) : Math.max(...known);
  }
  return cells.map((cell, index) => ({
    value: cell.value,
    evidence: cell.evidence,
    marker: target !== null && numbers[index] === target && spec.marker ? spec.marker.label : null,
  }));
}

/**
 * Side-by-side comparison of factual differences. Deliberately no overall
 * score or "winner": which differences matter depends on the buyer.
 */
export function buildComparison(items: readonly ComparisonInput[], now: Date): ComparisonDto {
  const contexts = items.map((item) =>
    item.listing.vehicle ? buildRuleContext(item.listing, now) : null,
  );

  const rows: ComparisonRow[] = ROWS.map((spec) => {
    const raw = items.map((item, index) => spec.cell(item, contexts[index] ?? null));
    const cells = markerCells(spec, raw);
    const values = cells.map((cell) => cell.value ?? '');
    const numbers = raw.map((cell) => (typeof cell.numeric === 'number' ? cell.numeric : null));
    return {
      key: spec.key,
      label: spec.label,
      group: spec.group,
      cells,
      differs: new Set(values).size > 1,
      ...(numbers.some((value) => value !== null) ? { numbers } : {}),
    };
  });

  const equipmentNames = new Map<string, string>();
  for (const item of items) {
    for (const name of item.listing.vehicle?.equipment ?? []) {
      const key = name.toLowerCase();
      if (!equipmentNames.has(key)) equipmentNames.set(key, name);
    }
  }
  const equipment = [...equipmentNames.entries()]
    .map(([key, name]) => ({
      name,
      presentIn: items.map((item) =>
        (item.listing.vehicle?.equipment ?? []).some((entry) => entry.toLowerCase() === key),
      ),
    }))
    .sort(
      (a, b) =>
        b.presentIn.filter(Boolean).length - a.presentIn.filter(Boolean).length ||
        a.name.localeCompare(b.name, 'de'),
    );

  return {
    items: items.map((item) => ({
      savedListingId: item.savedListingId,
      analysisId: item.analysisId,
      title: item.title,
      sourceUrl: item.listing.source.url,
      isExample: item.listing.source.isExample,
      vehicle: item.listing.vehicle
        ? {
            make: item.listing.vehicle.make,
            model: item.listing.vehicle.model,
            firstRegistrationYear: item.listing.vehicle.firstRegistration?.year ?? null,
          }
        : null,
    })),
    rows,
    equipment,
    missingInformation: items.map((item) =>
      item.analysis.completeness.fields
        .filter((field) => field.status === 'missing')
        .map((field) => field.label),
    ),
    notes: [
      'KaufCheck vergibt keine allgemeine Gesamtnote. Eine Reihenfolge entsteht nur aus deinen eigenen Prioritäten und den Angaben der Inserate.',
      'Markierungen wie „niedrigster Preis“ beschreiben nur den Wert – nicht, welches Angebot besser ist.',
    ],
  };
}
