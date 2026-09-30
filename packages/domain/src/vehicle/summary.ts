import type { Completeness, Highlight, Observation, Summary } from '@kaufcheck/shared';
import {
  formatEuro,
  formatKm,
  formatMonthsDuration,
  formatYearMonth,
  joinGerman,
  plural,
} from '../format';
import type { PositiveKey } from './description-signals';
import { buildVehicleTitle } from './overview';
import type { VehicleRuleContext } from './rule-context';

const POSITIVE_LABELS: Record<PositiveKey, string> = {
  non_smoker: 'Nichtraucherfahrzeug laut Beschreibung',
  garage: 'Garagenfahrzeug laut Beschreibung',
  new_brakes: 'Bremsen laut Beschreibung erneuert',
  new_tires: 'Neue Reifen laut Beschreibung',
  timing_renewed: 'Zahnriemen bzw. Steuerkette laut Beschreibung erneuert',
  clutch_renewed: 'Kupplung laut Beschreibung erneuert',
  german_vehicle: 'Deutsches Fahrzeug laut Beschreibung',
  second_tire_set: 'Zweiter Reifensatz laut Beschreibung',
};

/** Fields whose absence is worth listing as an open point. */
const IMPORTANT_MISSING = new Set([
  'price',
  'mileage',
  'firstRegistration',
  'hu',
  'accidentHistory',
  'serviceHistory',
  'previousOwners',
]);

function highlight(
  text: string,
  evidence: Highlight['evidence'],
  quote: string | null = null,
): Highlight {
  return { text, evidence, origin: 'rules', quote };
}

/**
 * Neutral summary built only from facts and calculations, plus two lists:
 * what speaks for the offer and what is open or speaks against it.
 * Never a purchase recommendation.
 */
export function buildSummary(
  ctx: VehicleRuleContext,
  completeness: Completeness,
  observations: readonly Observation[],
): Summary {
  const { vehicle, listing, signals } = ctx;

  const facts: string[] = [];
  if (vehicle.firstRegistration) {
    facts.push(
      `Erstzulassung ${formatYearMonth(vehicle.firstRegistration)}${
        ctx.ageMonths !== null && ctx.ageMonths >= 12
          ? ` (${ctx.ageApproximate ? 'ca. ' : ''}${formatMonthsDuration(Math.floor(ctx.ageMonths / 12) * 12)})`
          : ''
      }`,
    );
  }
  if (vehicle.mileageKm !== null) facts.push(formatKm(vehicle.mileageKm));
  if (listing.price) {
    facts.push(
      listing.price.kind === 'give_away'
        ? 'zu verschenken'
        : `${formatEuro(listing.price.amountEur)}${listing.price.kind === 'negotiable' ? ' VB' : ''}`,
    );
  }

  const sentences: string[] = [];
  const title = buildVehicleTitle(ctx);
  sentences.push(facts.length > 0 ? `${title}: ${facts.join(', ')}.` : `${title}.`);
  sentences.push(
    `Das Inserat enthält ${completeness.presentCount} von ${completeness.checkableCount} wichtigen Angaben (${completeness.score}\u00A0%).`,
  );
  const missing = completeness.fields
    .filter((field) => field.status === 'missing')
    .map((field) => field.label);
  if (missing.length > 0) {
    const shown = missing.slice(0, 4);
    sentences.push(
      `Nicht angegeben: ${joinGerman(missing.length > 4 ? [...shown, 'weitere'] : shown)}.`,
    );
  }
  const relevant = observations.filter((item) => item.severity !== 'info');
  if (relevant.length > 0) {
    sentences.push(
      `${plural(relevant.length, 'Auffälligkeit', 'Auffälligkeiten')} solltest du vor einer Besichtigung klären.`,
    );
  }

  // Positives
  const positives: Highlight[] = [];
  if (vehicle.huUntil && ctx.huMonthsLeft !== null && ctx.huMonthsLeft >= 6) {
    positives.push(
      highlight(
        `HU noch ${plural(ctx.huMonthsLeft, 'Monat', 'Monate')} gültig (bis ${formatYearMonth(vehicle.huUntil)})`,
        'calculation',
      ),
    );
  } else if (!vehicle.huUntil && signals.huNew) {
    positives.push(highlight('HU laut Beschreibung neu', 'listing_fact', signals.huNew.quote));
  }
  const provenanceQuote = (field: 'serviceHistory' | 'accidentHistory' | 'previousOwners') => {
    const source = vehicle.fieldSources[field];
    return source && source.source !== 'details' ? source.raw : null;
  };
  if (vehicle.serviceHistory === 'documented') {
    positives.push(
      highlight(
        'Wartungsnachweise laut Inserat vorhanden',
        'listing_fact',
        provenanceQuote('serviceHistory'),
      ),
    );
  }
  if (
    vehicle.accidentHistory === 'accident_free' &&
    !observations.some((o) => o.id === 'accident_conflict')
  ) {
    positives.push(
      highlight('Unfallfrei laut Inserat', 'listing_fact', provenanceQuote('accidentHistory')),
    );
  }
  if (vehicle.previousOwners !== null && vehicle.previousOwners <= 2) {
    positives.push(
      highlight(
        `${plural(vehicle.previousOwners, 'Halter', 'Halter')} laut Inserat`,
        'listing_fact',
        provenanceQuote('previousOwners'),
      ),
    );
  }
  if (vehicle.condition === 'undamaged') {
    positives.push(highlight('Fahrzeugzustand „unbeschädigt“ laut Inserat', 'listing_fact'));
  }
  for (const positive of signals.positives) {
    positives.push(highlight(POSITIVE_LABELS[positive.key], 'listing_fact', positive.quote));
  }
  if (ctx.descriptionWords >= 80) {
    positives.push(
      highlight(
        `Ausführliche Beschreibung (${plural(ctx.descriptionWords, 'Wort', 'Wörter')})`,
        'listing_fact',
      ),
    );
  }
  if (listing.images.length >= 8) {
    positives.push(
      highlight(`${plural(listing.images.length, 'Foto', 'Fotos')} im Inserat`, 'listing_fact'),
    );
  }

  // Open points: observations first, then important missing fields
  const openPoints: Highlight[] = observations
    .filter((item) => item.severity !== 'info' || item.evidence !== 'unknown')
    .slice(0, 6)
    .map((item) => highlight(item.title, item.evidence, item.quotes[0] ?? null));
  for (const field of completeness.fields) {
    if (field.status === 'missing' && IMPORTANT_MISSING.has(field.key)) {
      openPoints.push(highlight(`${field.label}: nicht angegeben`, 'unknown'));
    }
  }

  return {
    text: sentences.join(' '),
    positives: positives.slice(0, 8),
    openPoints: openPoints.slice(0, 10),
    ai: null,
  };
}
