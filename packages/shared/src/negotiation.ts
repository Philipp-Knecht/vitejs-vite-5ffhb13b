import type { Observation } from './schemas/analysis';
import type { Vehicle, YearMonth } from './schemas/listing';

/** A fact from the listing the buyer may raise when negotiating, if it applies. */
export interface NegotiationSuggestion {
  id: string;
  text: string;
}

/** Quotes are already windowed around the defect (about 180 characters); this only guards the length. */
const MAX_QUOTE_LENGTH = 240;

function yearMonth(value: YearMonth): string {
  return value.month ? `${String(value.month).padStart(2, '0')}/${value.year}` : String(value.year);
}

function shorten(quote: string): string {
  // By code point, so that no emoji is cut in half.
  const chars = Array.from(quote.replace(/\s+/g, ' ').trim());
  return chars.length > MAX_QUOTE_LENGTH
    ? `${chars
        .slice(0, MAX_QUOTE_LENGTH - 1)
        .join('')
        .trimEnd()}…`
    : chars.join('');
}

/**
 * Points from the analysis that can be fair arguments in a price negotiation:
 * an expired or soon due HU, defects named in the listing and missing service
 * records. They are only suggestions – the buyer picks what really applies
 * after the inspection. No amounts: KaufCheck has no repair cost data.
 */
export function negotiationSuggestions(
  observations: readonly Observation[],
  vehicle: Vehicle | null,
): NegotiationSuggestion[] {
  const suggestions: NegotiationSuggestion[] = [];
  const add = (suggestion: NegotiationSuggestion) => {
    // Several defects in one sentence share its quote.
    if (!suggestions.some((existing) => existing.text === suggestion.text)) {
      suggestions.push(suggestion);
    }
  };
  const hu = vehicle?.huUntil ?? null;
  for (const observation of observations) {
    // Only the rule-based findings; their ids and quotes are known.
    if (observation.origin !== 'rules') continue;
    if (observation.id === 'hu_expired' && hu) {
      add({
        id: observation.id,
        text: `Die HU ist abgelaufen (gültig bis ${yearMonth(hu)}).`,
      });
    } else if (observation.id === 'hu_expiring' && hu) {
      add({
        id: observation.id,
        text: `Die nächste HU ist schon ${yearMonth(hu)} fällig.`,
      });
    } else if (observation.id.startsWith('damage_')) {
      for (const [index, quote] of observation.quotes.entries()) {
        add({
          id: `${observation.id}:${index}`,
          text: `Wie im Inserat beschrieben: „${shorten(quote)}“`,
        });
      }
    }
  }
  if (vehicle?.serviceHistory === 'none') {
    add({ id: 'service_none', text: 'Es gibt keine Wartungsnachweise.' });
  } else if (vehicle?.serviceHistory === 'claimed') {
    add({
      id: 'service_claimed',
      text: 'Die Wartung ist nicht mit Nachweisen belegt.',
    });
  }
  return suggestions;
}

export interface NegotiationMessageInput {
  /** `true` = "Sie", `false` = "du". */
  formal: boolean;
  vehicleTitle: string | null;
  points: readonly string[];
  /** The buyer's own offer; KaufCheck never suggests one. */
  offerEur: number | null;
}

/**
 * A polite, factual message to the seller after the inspection. It lists the
 * points neutrally – no accusations – and ends with an open question or the
 * buyer's own offer.
 */
export function buildNegotiationMessage({
  formal,
  vehicleTitle,
  points,
  offerEur,
}: NegotiationMessageInput): string {
  const subject = formal ? 'Ihr Fahrzeug' : 'dein Auto';
  const title = vehicleTitle ? ` „${vehicleTitle}“` : '';
  const intro = `vielen Dank, dass ich ${subject}${title} ansehen konnte. ${
    points.length === 1 ? 'Einen Punkt' : 'Einige Punkte'
  } möchte ich noch ansprechen:`;
  const list = points.map((point, index) => `${index + 1}. ${point}`).join('\n');
  const consequence = `${
    points.length === 1 ? 'Das muss ich' : 'Diese Punkte muss ich'
  } nach dem Kauf erledigen lassen oder einplanen.`;
  const ask =
    offerEur !== null
      ? `Deshalb kann ich ${formal ? 'Ihnen' : 'dir'} ${offerEur.toLocaleString('de-DE')}\u00a0€ anbieten.`
      : formal
        ? 'Wie kommen Sie mir beim Preis entgegen? Alternativ könnten Sie Mängel vor der Übergabe beheben lassen.'
        : 'Wie kommst du mir beim Preis entgegen? Alternativ könntest du Mängel vor der Übergabe beheben lassen.';
  return ['Hallo,', intro, list, `${consequence} ${ask}`, 'Viele Grüße'].join('\n\n');
}

/**
 * The buyer's offer in whole euros as typed: „12500“, „12.500“, „12 500 €“,
 * „12.500,00“, „12.500,-“ or „12.500 EUR“. `null` when empty, `undefined` when it is not a
 * plausible amount (e.g. „12,5“ or „9999.99“).
 */
export function parseOfferEur(value: string): number | null | undefined {
  const compact = value
    .replace(/\s|€|euro?(?![a-z])/gi, '')
    .replace(/(?:,(?:00|[-–]{1,2})|\.[-–]{1,2})$/, '');
  if (compact === '') return null;
  if (!/^(?:[1-9]\d{0,2}(?:\.\d{3})+|[1-9]\d{0,7})$/.test(compact)) return undefined;
  const amount = Number(compact.replace(/\./g, ''));
  return amount > 0 && amount < 100_000_000 ? amount : undefined;
}
