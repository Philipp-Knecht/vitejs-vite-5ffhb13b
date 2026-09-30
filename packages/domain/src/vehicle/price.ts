import type { MarketContext, PriceContext, PriceMetric } from '@kaufcheck/shared';
import { formatDecimal, formatEuro, formatKm, formatNumber, NBSP } from '../format';
import type { VehicleRuleContext } from './rule-context';

export const INSUFFICIENT_MARKET_DATA_MESSAGE =
  'Für eine belastbare Marktpreis-Einordnung liegen aktuell nicht genügend Vergleichsdaten vor.';

/** Minimum number of verified comparable listings before a range is shown. */
export const MIN_COMPARABLES = 8;

export interface MarketComparable {
  priceEur: number;
}

/**
 * Comparable listings supplied by the application layer. Only listings that
 * were actually retrieved from the source may be used – never estimates.
 */
export interface MarketData {
  comparables: readonly MarketComparable[];
  /** Human-readable selection criteria, e.g. "Audi A7, EZ 2010–2014, 135.000–235.000 km". */
  criteria: string;
  /** Human-readable data source. */
  source: string;
}

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const a = sorted[lower] ?? 0;
  const b = sorted[upper] ?? a;
  return a + (b - a) * (index - lower);
}

export function assessMarket(
  askingPriceEur: number | null,
  market: MarketData | null,
): MarketContext {
  const prices = (market?.comparables ?? [])
    .map((comparable) => comparable.priceEur)
    .filter((price) => Number.isFinite(price) && price > 0)
    .sort((a, b) => a - b);

  if (
    !market ||
    prices.length < MIN_COMPARABLES ||
    askingPriceEur === null ||
    askingPriceEur <= 0
  ) {
    return {
      status: 'insufficient_data',
      message: INSUFFICIENT_MARKET_DATA_MESSAGE,
      sampleSize: prices.length,
    };
  }

  const median = Math.round(percentile(prices, 0.5));
  const lowerQuartile = Math.round(percentile(prices, 0.25));
  const upperQuartile = Math.round(percentile(prices, 0.75));
  const deviationPercent = Math.round(((askingPriceEur - median) / median) * 1000) / 10;
  const direction =
    Math.abs(deviationPercent) < 1
      ? 'entspricht etwa dem Median'
      : deviationPercent < 0
        ? `liegt ${formatDecimal(Math.abs(deviationPercent))}${NBSP}% unter dem Median`
        : `liegt ${formatDecimal(deviationPercent)}${NBSP}% über dem Median`;

  return {
    status: 'available',
    sampleSize: prices.length,
    medianEur: median,
    lowerQuartileEur: lowerQuartile,
    upperQuartileEur: upperQuartile,
    deviationPercent,
    criteria: market.criteria,
    source: market.source,
    message: `Der Angebotspreis ${direction} von ${formatNumber(prices.length)} vergleichbaren Inseraten (${formatEuro(
      median,
    )}). Die mittlere Hälfte lag zwischen ${formatEuro(lowerQuartile)} und ${formatEuro(upperQuartile)}.`,
  };
}

export function assessPrice(ctx: VehicleRuleContext, market: MarketData | null): PriceContext {
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

  const marketContext = assessMarket(amount, market);
  if (marketContext.status === 'available') {
    metrics.push({
      key: 'comparable_deviation',
      label: 'Abweichung vom Median vergleichbarer Inserate',
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
  };
}
