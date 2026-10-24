import {
  MIN_COMPARABLE_VISITORS,
  MIN_COMPARABLES,
  PRICE_VERDICT_LABELS,
  PRICE_VERDICT_LIMITS,
  UNUSUALLY_LOW_PERCENT,
  type MarketContext,
  type Observation,
  type PriceAdvice,
  type PriceContext,
  type PriceMetric,
  type PriceVerdict,
} from '@kaufcheck/shared';
import { formatDecimal, formatEuro, formatKm, formatNumber, joinGerman, NBSP } from '../format';
import { expectedPrice, type ExpectedPrice, type PriceTarget } from './market-model';
import type { VehicleRuleContext } from './rule-context';

export const INSUFFICIENT_MARKET_DATA_MESSAGE =
  'Für eine belastbare Marktpreis-Einordnung liegen aktuell nicht genügend Vergleichsdaten vor.';

export const NO_PRICE_MESSAGE =
  'Ohne einen echten Angebotspreis lässt sich der Preis nicht mit anderen Angeboten vergleichen.';

/**
 * Damage that rules out a comparison with intact cars, when the description
 * says so in plain words. Signals like „Zylinderkopfdichtung“ alone are not
 * enough: they also appear for repaired parts.
 */
const SEVERE_DAMAGE =
  /\b(?:motorschaden|getriebeschaden|nicht\s+(?:fahrbereit|fahrtüchtig|fahrtauglich)|springt\s+nicht\s+(?:mehr\s+)?an|fährt\s+nicht|durchgerostet|rostl(?:o|ö)ch(?:er)?)\b/i;

/** Words that say the damage was dealt with („wurde repariert“, „neu“). */
const REPAIRED =
  /\b(?:repariert|behoben|erneuert|getauscht|ausgetauscht|gewechselt|instandgesetzt|überholt|neu)\b/i;

/**
 * Why the car compares with no intact one, as the listing says it – or null.
 * Such offers are no comparables either (the stored reason is checked).
 */
function notComparableReason(
  ctx: VehicleRuleContext,
  observations: readonly Observation[],
): string | null {
  const { vehicle } = ctx;
  if (vehicle.condition === 'damaged') return 'Laut Inserat ist das Auto beschädigt.';
  if (vehicle.condition === 'not_roadworthy')
    return 'Laut Inserat ist das Auto nicht fahrtauglich.';
  if (vehicle.accidentHistory === 'unrepaired_damage')
    return 'Laut Inserat hat das Auto einen nicht reparierten Schaden.';
  if (observations.some((o) => o.id === 'sold_as_defective'))
    return 'Laut Inserat wird das Auto für Bastler oder als defekt angeboten.';
  for (const observation of observations) {
    if (!observation.id.startsWith('damage_')) continue;
    for (const quote of observation.quotes) {
      const term = SEVERE_DAMAGE.exec(quote)?.[0];
      if (term && !REPAIRED.test(quote)) return `Die Beschreibung nennt „${term}“.`;
    }
  }
  return null;
}

export interface MarketComparable {
  priceEur: number;
  /** First registration as a decimal year (2016.5 = July 2016); absent when unknown. */
  registration?: number | null;
  mileageKm?: number | null;
  /** Who checked the offer (browser or account), so that one alone cannot decide the price. */
  owner?: string;
}

/** The usual retail price of the car from a valuation service such as DAT or Schwacke. */
export interface ValuationReference {
  expectedEur: number;
  lowEur: number | null;
  highEur: number | null;
}

/**
 * Comparable listings supplied by the application layer: offers that were
 * actually checked with KaufCheck – never estimates. With a valuation from a
 * contracted service, that counts instead.
 */
export interface MarketData {
  comparables: readonly MarketComparable[];
  valuation?: ValuationReference;
  /** Human-readable selection criteria, e.g. "Audi A7, EZ 2010–2014, 135.000–235.000 km". */
  criteria: string;
  /** Human-readable data source. */
  source: string;
}

/** The same deviation always gets the same level. */
export function priceVerdict(deviationPercent: number): PriceVerdict {
  if (deviationPercent <= PRICE_VERDICT_LIMITS.veryGood) return 'very_good';
  if (deviationPercent <= PRICE_VERDICT_LIMITS.good) return 'good';
  if (deviationPercent < PRICE_VERDICT_LIMITS.fair) return 'fair';
  if (deviationPercent < PRICE_VERDICT_LIMITS.increased) return 'increased';
  return 'high';
}

/** First registration as a decimal year; the middle of the year when only the year is known. */
export function decimalRegistration(year: number, month: number | null): number {
  return year + ((month ?? 6.5) - 1) / 12;
}

function fromValuation(valuation: ValuationReference): ExpectedPrice | null {
  const expected = Math.round(valuation.expectedEur);
  if (!Number.isFinite(expected) || expected <= 0) return null;
  const valid = (value: number | null) =>
    value !== null && Number.isFinite(value) && value > 0 ? Math.round(value) : expected;
  const low = Math.min(valid(valuation.lowEur), expected);
  const high = Math.max(valid(valuation.highEur), expected);
  return {
    expectedEur: expected,
    lowEur: low,
    highEur: high,
    method: 'valuation',
    sampleSize: 0,
    medianEur: expected,
    lowerQuartileEur: low,
    upperQuartileEur: high,
  };
}

function marketMessage(expected: ExpectedPrice, direction: string, source: string): string {
  const range = `${formatEuro(expected.lowEur)} und ${formatEuro(expected.highEur)}`;
  switch (expected.method) {
    case 'median':
      return `Der Angebotspreis ${direction} von ${formatNumber(expected.sampleSize)} vergleichbaren Inseraten (${formatEuro(
        expected.medianEur,
      )}). Die mittlere Hälfte lag zwischen ${range}.`;
    case 'age_mileage':
      return `Bei gleichem Alter und Kilometerstand kosten vergleichbare Angebote etwa ${formatEuro(
        expected.expectedEur,
      )} (aus ${formatNumber(expected.sampleSize)} Inseraten). Der Angebotspreis ${direction}. Die mittlere Hälfte liegt zwischen ${range}.`;
    case 'valuation':
      return `Laut ${source} kostet ein vergleichbares Auto etwa ${formatEuro(expected.expectedEur)}${
        expected.lowEur < expected.highEur ? ` (üblich zwischen ${range})` : ''
      }. Der Angebotspreis ${direction}.`;
  }
}

export function assessMarket(
  askingPriceEur: number | null,
  market: MarketData | null,
  target: PriceTarget = { registration: null, mileageKm: null },
): MarketContext {
  const expected = !market
    ? null
    : market.valuation
      ? fromValuation(market.valuation)
      : expectedPrice(
          market.comparables.map((comparable) => ({
            priceEur: comparable.priceEur,
            registration: comparable.registration ?? null,
            mileageKm: comparable.mileageKm ?? null,
            ...(comparable.owner === undefined ? {} : { owner: comparable.owner }),
          })),
          target,
          MIN_COMPARABLES,
          MIN_COMPARABLE_VISITORS,
        );

  if (askingPriceEur === null || askingPriceEur <= 0) {
    return {
      status: 'insufficient_data',
      message: NO_PRICE_MESSAGE,
      sampleSize: expected?.sampleSize ?? 0,
      reason: 'no_price',
    };
  }
  if (!market || !expected) {
    return {
      status: 'insufficient_data',
      message: INSUFFICIENT_MARKET_DATA_MESSAGE,
      sampleSize: market?.comparables.length ?? 0,
      reason: 'few_comparables',
    };
  }

  const deviationPercent =
    Math.round(((askingPriceEur - expected.expectedEur) / expected.expectedEur) * 1000) / 10;
  const usual = expected.method === 'median' ? 'dem Median' : 'dem üblichen Preis';
  const direction =
    Math.abs(deviationPercent) < 1
      ? `entspricht etwa ${usual}`
      : deviationPercent < 0
        ? `liegt ${formatDecimal(Math.abs(deviationPercent))}${NBSP}% unter ${usual}`
        : `liegt ${formatDecimal(deviationPercent)}${NBSP}% über ${usual}`;

  // Within the middle half of comparable offers a price is fair, whatever the
  // deviation: with few offers the usual price itself is uncertain.
  const withinUsual = askingPriceEur >= expected.lowEur && askingPriceEur <= expected.highEur;
  return {
    status: 'available',
    sampleSize: expected.sampleSize,
    medianEur: expected.medianEur,
    lowerQuartileEur: expected.lowerQuartileEur,
    upperQuartileEur: expected.upperQuartileEur,
    deviationPercent,
    criteria: market.criteria,
    source: market.source,
    message: marketMessage(expected, direction, market.source),
    expectedEur: expected.expectedEur,
    typicalLowEur: expected.lowEur,
    typicalHighEur: expected.highEur,
    method: expected.method,
    verdict: withinUsual ? 'fair' : priceVerdict(deviationPercent),
    // Only below the middle half: a price the comparison calls fair is not suspicious.
    unusuallyLow: deviationPercent <= UNUSUALLY_LOW_PERCENT && askingPriceEur < expected.lowEur,
  };
}

/** Warning signs of a scam (see observations.ts): with any of them the price comes second. */
const SCAM_OBSERVATIONS = new Set([
  'payment_in_advance',
  'escrow_service',
  'seller_abroad',
  'shipping_offered',
  'no_viewing',
  'contact_off_platform',
]);

/** A price worth aiming for: the usual price, rounded down to 100 € (so below the asking price). */
function targetPrice(expectedEur: number): number {
  return Math.max(100, Math.floor(expectedEur / 100) * 100);
}

/**
 * The answer to „Is the price worth it?“ in one line plus a sentence, from
 * fixed rules: scam signs first, then the price level. It rates the price,
 * not the car – how good the car is shows only the viewing.
 */
export function priceAdvice(
  market: MarketContext,
  observations: readonly Observation[],
  kind: 'asking' | 'negotiable' | 'fixed',
): PriceAdvice {
  const scam = observations.some((o) => SCAM_OBSERVATIONS.has(o.id) && o.severity !== 'info');
  if (scam) {
    return {
      action: 'caution',
      title: 'Erst die Warnzeichen klären',
      text: 'Im Inserat stehen Warnzeichen, vor denen die Polizei bei Online-Autokäufen warnt (siehe „Darauf solltest du achten“). Zahl nichts im Voraus und kauf kein Auto ungesehen; Geld gibt es erst bei der Übergabe von Auto, Schlüsseln und Papieren.',
      targetPriceEur: null,
    };
  }
  if (market.status !== 'available' || market.verdict === undefined) {
    const reason = market.status === 'insufficient_data' ? market.reason : undefined;
    if (reason === 'not_comparable')
      return {
        action: 'compare',
        title: 'Kein Preisvergleich bei Schäden',
        text: `${market.message} Der Preis hängt dann vor allem von den Reparaturkosten ab: Lass den Schaden vor dem Kauf von einer Werkstatt schätzen.`,
        targetPriceEur: null,
      };
    if (reason === 'missing_basics')
      return {
        action: 'compare',
        title: 'Für den Preisvergleich fehlen Angaben',
        text: `${market.message} Steht etwas davon im Inserat, füg den ganzen Text ein; sonst frag den Verkäufer danach. Ohne diese Angaben gibt es keinen Preisvergleich.`,
        targetPriceEur: null,
      };
    return {
      action: 'compare',
      title: 'Noch zu wenige Vergleichsangebote',
      text: 'Für dieses Auto kennt KaufCheck noch nicht genug vergleichbare Inserate, um den Preis zu bewerten. Vergleich selbst ähnliche Angebote auf den großen Börsen.',
      targetPriceEur: null,
    };
  }

  const expected = market.expectedEur ?? market.medianEur;
  const percent = `${formatDecimal(Math.abs(market.deviationPercent))}${NBSP}%`;
  const damage = observations.filter((o) => o.id.startsWith('damage_'));
  const defects = damage.some((o) => o.severity === 'warning')
    ? ' Das Inserat nennt einen Mangel, der teuer werden kann: Lass ihn vor dem Kauf prüfen und rechne die Reparatur ein.'
    : damage.length > 0
      ? ' Das Inserat nennt Mängel: Rechne die Reparatur ein, bevor du zusagst.'
      : '';
  const fixed = kind === 'fixed' ? ' Laut Inserat ist es ein Festpreis; frag trotzdem.' : '';

  if (market.unusuallyLow) {
    return {
      action: 'caution',
      title: 'Auffällig günstig – Grund klären',
      text: `Der Preis liegt ${percent} unter dem, was vergleichbare Angebote kosten (etwa ${formatEuro(expected)}). Das kann ein Glücksfall sein, aber auch auf Mängel hindeuten oder darauf, dass mit dem Angebot etwas nicht stimmt. Frag nach dem Grund, sieh dir das Auto genau an und zahl nichts im Voraus.`,
      targetPriceEur: null,
    };
  }
  switch (market.verdict) {
    case 'very_good':
    case 'good':
      return {
        action: 'inspect',
        title: `${PRICE_VERDICT_LABELS[market.verdict]} – ansehen lohnt sich`,
        text: `Der Preis liegt ${percent} unter dem, was vergleichbare Angebote kosten (etwa ${formatEuro(expected)}). Prüf bei der Besichtigung, ob der Zustand dazu passt.${defects}`,
        targetPriceEur: null,
      };
    case 'fair':
      return {
        action: 'inspect',
        title: 'Fairer Preis – ansehen lohnt sich',
        text: `Der Preis passt zu dem, was vergleichbare Angebote kosten (rund ${formatEuro(expected)}). Handeln kannst du bei Mängeln, die du bei der Besichtigung findest.${defects}`,
        targetPriceEur: null,
      };
    case 'increased':
      return {
        action: 'negotiate',
        title: 'Etwas teuer – verhandeln',
        text: `Der Preis liegt ${percent} über dem, was vergleichbare Angebote kosten. Versuch, auf etwa ${formatEuro(targetPrice(expected))} zu kommen.${fixed}${defects}`,
        targetPriceEur: targetPrice(expected),
      };
    case 'high':
      return {
        action: 'search_on',
        title: 'Teurer als vergleichbare Angebote – weitersuchen',
        text: `Der Preis liegt ${percent} über dem, was vergleichbare Angebote kosten. Such lieber weiter, außer der Verkäufer geht auf etwa ${formatEuro(targetPrice(expected))} herunter.${fixed}${defects}`,
        targetPriceEur: targetPrice(expected),
      };
  }
}

export function assessPrice(
  ctx: VehicleRuleContext,
  market: MarketData | null,
  observations: readonly Observation[] = [],
): PriceContext {
  const { listing, vehicle } = ctx;
  const price = listing.price;
  const amount = price && price.kind !== 'give_away' ? price.amountEur : null;
  const metrics: PriceMetric[] = [];

  if (amount !== null && amount > 0 && ctx.ageMonths !== null && ctx.ageMonths >= 12) {
    const perYear = Math.round(amount / (ctx.ageMonths / 12));
    metrics.push({
      key: 'price_per_year',
      label: 'Preis pro Fahrzeugjahr',
      value: `${formatEuro(perYear)} pro Jahr`,
      numericValue: perYear,
      evidence: 'calculation',
      explanation: `Angebotspreis geteilt durch das Alter seit Erstzulassung${
        ctx.ageApproximate ? ' (nur das Jahr ist bekannt, daher ungefähr)' : ''
      }.`,
    });
  }

  if (amount !== null && amount > 0 && vehicle.mileageKm !== null && vehicle.mileageKm >= 1000) {
    const per10k = Math.round(amount / (vehicle.mileageKm / 10_000));
    metrics.push({
      key: 'price_per_10000_km',
      label: 'Preis je 10.000 km Laufleistung',
      value: formatEuro(per10k),
      numericValue: per10k,
      evidence: 'calculation',
      explanation: 'Angebotspreis geteilt durch die bisherige Laufleistung (in 10.000 km).',
    });
  }

  if (ctx.kmPerYear !== null) {
    metrics.push({
      key: 'km_per_year',
      label: 'Laufleistung pro Jahr',
      value: `${formatKm(ctx.kmPerYear)} pro Jahr`,
      numericValue: ctx.kmPerYear,
      evidence: 'calculation',
      explanation: `Kilometerstand geteilt durch das Alter seit Erstzulassung${
        ctx.ageApproximate ? ' (ungefähr)' : ''
      }.`,
    });
  }

  const placeholder = observations.some((o) => o.id === 'price_placeholder');
  const missing = [
    vehicle.make ? null : 'Marke',
    vehicle.model ? null : 'Modell',
    vehicle.firstRegistration ? null : 'Erstzulassung',
    vehicle.mileageKm === null ? 'Kilometerstand' : null,
  ].filter((item): item is string => item !== null);
  const damage = notComparableReason(ctx, observations);
  const marketContext: MarketContext = listing.source.isExample
    ? {
        status: 'insufficient_data',
        message: 'Für das Beispiel gibt es keinen Preisvergleich.',
        sampleSize: 0,
        reason: 'example',
      }
    : damage
      ? {
          status: 'insufficient_data',
          message: `${damage} Mit intakten Autos lässt sich der Preis nicht vergleichen.`,
          sampleSize: 0,
          reason: 'not_comparable',
        }
      : missing.length > 0 && amount !== null && amount > 0 && !placeholder
        ? {
            status: 'insufficient_data',
            message: `KaufCheck hat im Inserat diese Angaben nicht gefunden: ${joinGerman(missing)}.`,
            sampleSize: 0,
            reason: 'missing_basics',
          }
        : assessMarket(placeholder ? null : amount, market, {
            registration: vehicle.firstRegistration
              ? decimalRegistration(vehicle.firstRegistration.year, vehicle.firstRegistration.month)
              : null,
            mileageKm: vehicle.mileageKm,
          });
  if (marketContext.status === 'available') {
    metrics.push({
      key: 'comparable_deviation',
      label:
        marketContext.method === 'age_mileage'
          ? 'Abweichung vom üblichen Preis vergleichbarer Inserate'
          : 'Abweichung vom Median vergleichbarer Inserate',
      value: `${marketContext.deviationPercent > 0 ? '+' : ''}${formatDecimal(marketContext.deviationPercent)}${NBSP}%`,
      numericValue: marketContext.deviationPercent,
      evidence: 'calculation',
      explanation: marketContext.message,
    });
  }

  const notes: string[] = [];
  if (price?.kind === 'negotiable') notes.push('Laut Inserat ist der Preis verhandelbar (VB).');
  if (price?.kind === 'fixed') notes.push('Laut Inserat handelt es sich um einen Festpreis.');
  if (price?.kind === 'give_away') notes.push('Das Fahrzeug wird laut Inserat verschenkt.');
  if (metrics.some((metric) => metric.key !== 'comparable_deviation')) {
    notes.push(
      'Die Kennzahlen helfen beim Vergleich mehrerer Angebote. Allein sagen sie nichts darüber aus, ob der Preis angemessen ist.',
    );
  }

  return {
    askingPrice: price
      ? {
          amountEur: price.amountEur,
          display:
            price.kind === 'give_away'
              ? 'Zu verschenken'
              : `${formatEuro(price.amountEur)}${price.kind === 'negotiable' ? ' VB' : ''}`,
          kind: price.kind,
        }
      : null,
    metrics,
    market: marketContext,
    notes,
    ...(price &&
    price.kind !== 'give_away' &&
    price.amountEur > 0 &&
    !placeholder &&
    !listing.source.isExample
      ? { advice: priceAdvice(marketContext, observations, price.kind) }
      : {}),
  };
}
