import type { Observation } from './schemas/analysis';
import type { Vehicle, YearMonth } from './schemas/listing';

/** A fact from the listing the buyer may raise when negotiating, if it applies. */
export interface NegotiationSuggestion {
  id: string;
  text: string;
}

const MAX_QUOTE_LENGTH = 120;

function yearMonth(value: YearMonth): string {
  return value.month ? `${String(value.month).padStart(2, '0')}/${value.year}` : String(value.year);
}

function shorten(quote: string): string {
  const text = quote.replace(/\s+/g, ' ').trim();
  return text.length > MAX_QUOTE_LENGTH
    ? `${text.slice(0, MAX_QUOTE_LENGTH - 1).trimEnd()}…`
    : text;
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
  const hu = vehicle?.huUntil ?? null;
  for (const observation of observations) {
    // Only the rule-based findings; their ids and quotes are known.
    if (observation.origin !== 'rules') continue;
    if (observation.id === 'hu_expired' && hu) {
      suggestions.push({
        id: observation.id,
        text: `Die HU ist abgelaufen (gültig bis ${yearMonth(hu)}).`,
      });
    } else if (observation.id === 'hu_expiring' && hu) {
      suggestions.push({
        id: observation.id,
        text: `Die nächste HU ist schon ${yearMonth(hu)} fällig.`,
      });
    } else if (observation.id.startsWith('damage_')) {
      for (const [index, quote] of observation.quotes.entries()) {
        suggestions.push({
          id: `${observation.id}:${index}`,
          text: `Im Inserat genannt: „${shorten(quote)}“`,
        });
      }
    }
  }
  if (vehicle?.serviceHistory === 'none') {
    suggestions.push({ id: 'service_none', text: 'Es gibt keine Wartungsnachweise.' });
  } else if (vehicle?.serviceHistory === 'claimed') {
    suggestions.push({
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
  const intro = `vielen Dank, dass ich ${subject}${title} ansehen konnte. Dabei ${
    points.length === 1 ? 'ist mir ein Punkt' : 'sind mir einige Punkte'
  } aufgefallen:`;
  const list = points.map((point, index) => `${index + 1}. ${point}`).join('\n');
  const consequence = `${
    points.length === 1 ? 'Das muss ich' : 'Diese Punkte muss ich'
  } nach dem Kauf erledigen lassen oder einplanen.`;
  const ask =
    offerEur !== null
      ? `Deshalb kann ich ${formal ? 'Ihnen' : 'dir'} ${offerEur.toLocaleString('de-DE')} € anbieten.`
      : formal
        ? 'Wie kommen Sie mir beim Preis entgegen? Alternativ könnten Sie die Punkte vor der Übergabe erledigen lassen.'
        : 'Wie kommst du mir beim Preis entgegen? Alternativ könntest du die Punkte vor der Übergabe erledigen lassen.';
  return ['Hallo,', intro, list, `${consequence} ${ask}`, 'Viele Grüße'].join('\n\n');
}
