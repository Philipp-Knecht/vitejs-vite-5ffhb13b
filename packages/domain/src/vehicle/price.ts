import {
  MIN_COMPARABLES,
  PRICE_VERDICT_LABELS,
  PRICE_VERDICT_LIMITS,
  type MarketContext,
  type Observation,
  type PriceAdvice,
  type PriceContext,
  type PriceMetric,
  type PriceVerdict,
} from '@kaufcheck/shared';
import { formatDecimal, formatEuro, formatKm, formatNumber, NBSP } from '../format';
import { expectedPrice, type ExpectedPrice, type PriceTarget } from './market-model';
import type { VehicleRuleContext } from './rule-context';

export const INSUFFICIENT_MARKET_DATA_MESSAGE =
  'Für eine belastbare Marktpreis-Einordnung liegen aktuell nicht genügend Vergleichsdaten vor.';

export const NO_PRICE_MESSAGE =
  'Ohne einen echten Angebotspreis lässt sich der Preis nicht mit anderen Angeboten vergleichen.';

export interface MarketComparable {
  priceEur: number;
  /** First registration as a decimal year (2016.5 = July 2016); absent when unknown. */
  registration?: number | null;
  mileageKm?: number | null;
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

/** From 30 % below the usual price the reason needs asking: defects, or a fake offer. */
export const UNUSUALLY_LOW_PERCENT = -30;

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

function fromValuation(valuation: ValuationReference): ExpectedPrice {
  const low = valuation.lowEur ?? valuation.expectedEur;
  const high = valuation.highEur ?? valuation.expectedEur;
  return {
    expectedEur: valuation.expectedEur,
    lowEur: low,
    highEur: high,
    method: 'valuation',
    sampleSize: 0,
    medianEur: valuation.expectedEur,
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
          })),
          target,
          MIN_COMPARABLES,
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
    verdict: priceVerdict(deviationPercent),
    unusuallyLow: deviationPercent <= UNUSUALLY_LOW_PERCENT,
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

/** A car that compares with no intact one: damaged, not roadworthy, sold as defective. */
function notComparable(ctx: VehicleRuleContext, observations: readonly Observation[]): boolean {
  const { vehicle } = ctx;
  return (
    vehicle.condition === 'damaged' ||
    vehicle.condition === 'not_roadworthy' ||
    vehicle.accidentHistory === 'unrepaired_damage' ||
    observations.some((o) => o.id === 'sold_as_defective')
  );
}

/** A price worth aiming for: the usual price, rounded to 100 €. */
function targetPrice(expectedEur: number): number {
  return Math.max(100, Math.round(expectedEur / 100) * 100);
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
    return market.status === 'insufficient_data' && market.reason === 'not_comparable'
      ? {
          action: 'compare',
          title: 'Kein Preisvergleich bei Schäden',
          text: 'Laut Inserat ist das Auto beschädigt, nicht fahrbereit oder defekt. Der Preis hängt dann vor allem von den Reparaturkosten ab: Lass den Schaden vor dem Kauf von einer Werkstatt schätzen.',
          targetPriceEur: null,
        }
      : {
          action: 'compare',
          title: 'Noch zu wenige Vergleichsangebote',
          text: 'Für dieses Auto kennt KaufCheck noch nicht genug ähnliche Inserate, um den Preis zu bewerten. Vergleich selbst: Die Suche öffnet ähnliche Angebote auf den großen Börsen.',
          targetPriceEur: null,
        };
  }

  const expected = market.expectedEur ?? market.medianEur;
  const percent = `${formatDecimal(Math.abs(market.deviationPercent))}${NBSP}%`;
  const defects = observations.some((o) => o.id === 'damage_mentioned' && o.severity !== 'info')
    ? ' Das Inserat nennt Mängel: Rechne die Reparatur ein, bevor du zusagst.'
    : '';
  const fixed = kind === 'fixed' ? ' Laut Inserat ist es ein Festpreis; frag trotzdem.' : '';

  if (market.unusuallyLow) {
    return {
      action: 'caution',
      title: 'Auffällig günstig – Grund klären',
      text: `Der Preis liegt ${percent} unter dem, was vergleichbare Angebote kosten (etwa ${formatEuro(expected)}). Das kann ein Glücksfall sein, aber auch auf Mängel oder ein unseriöses Angebot hindeuten. Frag nach dem Grund, sieh dir das Auto genau an und zahl nichts im Voraus.`,
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
        text: `Der Preis entspricht etwa dem, was vergleichbare Angebote kosten (etwa ${formatEuro(expected)}). Handeln kannst du bei Mängeln, die du bei der Besichtigung findest.${defects}`,
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
        title: 'Teurer als üblich – weitersuchen',
        text: `Der Preis liegt ${percent} über dem, was vergleichbare Angebote kosten. Such lieber weiter, außer der Verkäufer geht auf etwa ${formatEuro(targetPrice(expected))} herunter.${defects}`,
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
  const marketContext: MarketContext = notComparable(ctx, observations)
    ? {
        status: 'insufficient_data',
        message:
          'Laut Inserat ist das Auto beschädigt, nicht fahrbereit oder defekt. Mit intakten Autos lässt sich der Preis nicht vergleichen.',
        sampleSize: 0,
        reason: 'not_comparable',
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
    ...(price && price.kind !== 'give_away' && price.amountEur > 0 && !placeholder
      ? { advice: priceAdvice(marketContext, observations, price.kind) }
      : {}),
  };
}
