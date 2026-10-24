/**
 * The usual asking price of a car, from comparable offers only. Plain,
 * deterministic statistics: the same offers always give the same result, and
 * nothing is estimated where there are no offers.
 */

export interface PricePoint {
  priceEur: number;
  /** First registration as a decimal year (2016.5 = July 2016); null when unknown. */
  registration: number | null;
  mileageKm: number | null;
  /** Who checked the offer (browser or account); absent when it does not matter. */
  owner?: string;
}

export interface PriceTarget {
  registration: number | null;
  mileageKm: number | null;
}

export interface ExpectedPrice {
  /** Usual asking price for the target. */
  expectedEur: number;
  /** The middle half of the comparable offers around it. */
  lowEur: number;
  highEur: number;
  /**
   * `age_mileage`: adjusted to the target's age and mileage; `median`: plain
   * median; `valuation`: from a valuation service (set by the caller).
   */
  method: 'median' | 'age_mileage' | 'valuation';
  /** Offers left after removing outliers. */
  sampleSize: number;
  /** Raw statistics of the offers left. */
  medianEur: number;
  lowerQuartileEur: number;
  upperQuartileEur: number;
}

/** Below this many offers the price is the plain median, not adjusted for age and mileage. */
export const MIN_FOR_ADJUSTMENT = 15;

/** Linear interpolation between the closest ranks, as in spreadsheets (`QUARTILE.INC`). */
export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const a = sorted[lower] ?? 0;
  const b = sorted[upper] ?? a;
  return a + (b - a) * (index - lower);
}

/**
 * In log prices: below this, the spread counts as 5 %. With many identical
 * prices the interquartile range is 0, and the fences would drop every other
 * offer.
 */
export const MIN_LOG_SPREAD = 0.05;

/**
 * The items whose value lies within Tukey's fences: `k` interquartile ranges
 * (at least `minSpread`) beyond the quartiles.
 */
export function withinFences<T>(
  items: readonly T[],
  value: (item: T) => number,
  k: number,
  minSpread = 0,
): T[] {
  const sorted = items.map(value).sort((a, b) => a - b);
  const q1 = percentile(sorted, 0.25);
  const q3 = percentile(sorted, 0.75);
  const spread = Math.max(q3 - q1, minSpread);
  return items.filter((item) => {
    const v = value(item);
    return v >= q1 - k * spread && v <= q3 + k * spread;
  });
}

type Predictor = 'age' | 'km';

interface Row {
  point: PricePoint;
  /** Years newer than the target (negative: older). */
  years: number;
  /** Difference in mileage, in 10,000 km. */
  km: number;
  logPrice: number;
}

interface Fit {
  /** Log price at the target's age and mileage. */
  intercept: number;
  residuals: number[];
}

/** Solves A·x = b by Gaussian elimination with partial pivoting; null when singular. */
function solve(matrix: number[][], vector: number[]): number[] | null {
  const n = vector.length;
  const a = matrix.map((row, i) => [...row, vector[i] ?? 0]);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1)
      if (Math.abs(a[row]![col]!) > Math.abs(a[pivot]![col]!)) pivot = row;
    if (Math.abs(a[pivot]![col]!) < 1e-9) return null;
    [a[col], a[pivot]] = [a[pivot]!, a[col]!];
    for (let row = col + 1; row < n; row += 1) {
      const factor = a[row]![col]! / a[col]![col]!;
      for (let k = col; k <= n; k += 1) a[row]![k]! -= factor * a[col]![k]!;
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let row = n - 1; row >= 0; row -= 1) {
    let sum = a[row]![n]!;
    for (let k = row + 1; k < n; k += 1) sum -= a[row]![k]! * x[k]!;
    x[row] = sum / a[row]![row]!;
  }
  return x;
}

function spread(values: readonly number[]): number {
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  return Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length);
}

function correlation(a: readonly number[], b: readonly number[]): number {
  const meanA = a.reduce((sum, v) => sum + v, 0) / a.length;
  const meanB = b.reduce((sum, v) => sum + v, 0) / b.length;
  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < a.length; i += 1) {
    cov += (a[i]! - meanA) * (b[i]! - meanB);
    varA += (a[i]! - meanA) ** 2;
    varB += (b[i]! - meanB) ** 2;
  }
  return cov / Math.sqrt(varA * varB);
}

/** Smallest spread a predictor needs: half a year, 5,000 km. */
const MIN_SPREAD: Record<Predictor, number> = { age: 0.5, km: 0.5 };

/**
 * Least squares fit of the log price on the chosen predictors, centred on the
 * target so the intercept is the target's log price. Null when the offers do
 * not support it: too little spread, predictors too closely tied, or a slope
 * the wrong way round (newer must not be cheaper, more km not dearer).
 */
function fit(rows: readonly Row[], predictors: readonly Predictor[]): Fit | null {
  const columns = predictors.map((p) => rows.map((row) => (p === 'age' ? row.years : row.km)));
  if (columns.some((column, i) => spread(column) < MIN_SPREAD[predictors[i]!])) return null;
  if (columns.length === 2 && correlation(columns[0]!, columns[1]!) ** 2 > 0.9) return null;

  const design = rows.map((_, r) => [1, ...columns.map((column) => column[r]!)]);
  const size = predictors.length + 1;
  const xtx = Array.from({ length: size }, (_, i) =>
    Array.from({ length: size }, (_, j) => design.reduce((sum, x) => sum + x[i]! * x[j]!, 0)),
  );
  const xty = Array.from({ length: size }, (_, i) =>
    design.reduce((sum, x, r) => sum + x[i]! * rows[r]!.logPrice, 0),
  );
  const coefficients = solve(xtx, xty);
  if (!coefficients) return null;
  const wrongWay = predictors.some((p, i) =>
    p === 'age' ? coefficients[i + 1]! < 0 : coefficients[i + 1]! > 0,
  );
  if (wrongWay) return null;
  const residuals = rows.map(
    (row, r) => row.logPrice - design[r]!.reduce((sum, x, i) => sum + x * coefficients[i]!, 0),
  );
  return { intercept: coefficients[0]!, residuals };
}

const MODELS: readonly (readonly Predictor[])[] = [['age', 'km'], ['age'], ['km']];

function adjusted(rows: readonly Row[], minSample: number): { fit: Fit; rows: Row[] } | null {
  for (const predictors of MODELS) {
    const first = fit(rows, predictors);
    if (!first) continue;
    // Offers far from the fitted line (a typo, a damaged car) are left out once.
    const residualOf = new Map(rows.map((row, i) => [row, first.residuals[i]!]));
    const kept = withinFences(rows, (row) => residualOf.get(row)!, 1.5, MIN_LOG_SPREAD);
    if (kept.length < minSample) continue;
    const second = fit(kept, predictors);
    if (second) return { fit: second, rows: kept };
  }
  return null;
}

function stats(prices: readonly number[]) {
  const sorted = [...prices].sort((a, b) => a - b);
  return {
    sorted,
    medianEur: Math.round(percentile(sorted, 0.5)),
    lowerQuartileEur: Math.round(percentile(sorted, 0.25)),
    upperQuartileEur: Math.round(percentile(sorted, 0.75)),
  };
}

/** Offers from enough different people: counted on the offers that are actually used. */
function enoughOwners(points: readonly PricePoint[], minOwners: number): boolean {
  const owners = new Set(
    points.flatMap((point) => (point.owner === undefined ? [] : [point.owner])),
  );
  return owners.size === 0 || owners.size >= minOwners;
}

/**
 * The usual asking price for the target from comparable offers, or null with
 * fewer than `minSample` offers (or offers from fewer than `minOwners`
 * people) left after removing outliers.
 */
export function expectedPrice(
  points: readonly PricePoint[],
  target: PriceTarget,
  minSample: number,
  minOwners = 0,
): ExpectedPrice | null {
  const valid = points.filter((point) => Number.isFinite(point.priceEur) && point.priceEur > 0);
  // Placeholders like 1 € or 99.999 € go first, before they can bend anything.
  const plausible = withinFences(valid, (point) => Math.log(point.priceEur), 3, MIN_LOG_SPREAD);

  if (target.registration !== null && target.mileageKm !== null) {
    const rows = plausible.flatMap((point): Row[] =>
      point.registration === null || point.mileageKm === null
        ? []
        : [
            {
              point,
              years: point.registration - target.registration!,
              km: (point.mileageKm - target.mileageKm!) / 10_000,
              logPrice: Math.log(point.priceEur),
            },
          ],
    );
    const model =
      rows.length >= Math.max(minSample, MIN_FOR_ADJUSTMENT) ? adjusted(rows, minSample) : null;
    if (
      model &&
      enoughOwners(
        model.rows.map((row) => row.point),
        minOwners,
      )
    ) {
      const raw = stats(model.rows.map((row) => row.point.priceEur));
      const residuals = [...model.fit.residuals].sort((a, b) => a - b);
      // Never beyond the offers themselves: no extrapolation to prices nobody asked.
      const clamp = (value: number) =>
        Math.min(Math.max(value, raw.sorted[0]!), raw.sorted[raw.sorted.length - 1]!);
      const expectedEur = Math.round(clamp(Math.exp(model.fit.intercept)));
      // Skewed residuals could leave the expected price outside its own range.
      return {
        expectedEur,
        lowEur: Math.min(
          expectedEur,
          Math.round(clamp(Math.exp(model.fit.intercept + percentile(residuals, 0.25)))),
        ),
        highEur: Math.max(
          expectedEur,
          Math.round(clamp(Math.exp(model.fit.intercept + percentile(residuals, 0.75)))),
        ),
        method: 'age_mileage',
        sampleSize: model.rows.length,
        medianEur: raw.medianEur,
        lowerQuartileEur: raw.lowerQuartileEur,
        upperQuartileEur: raw.upperQuartileEur,
      };
    }
  }

  const kept = withinFences(plausible, (point) => Math.log(point.priceEur), 1.5, MIN_LOG_SPREAD);
  if (kept.length < minSample || !enoughOwners(kept, minOwners)) return null;
  const raw = stats(kept.map((point) => point.priceEur));
  return {
    expectedEur: raw.medianEur,
    lowEur: raw.lowerQuartileEur,
    highEur: raw.upperQuartileEur,
    method: 'median',
    sampleSize: kept.length,
    medianEur: raw.medianEur,
    lowerQuartileEur: raw.lowerQuartileEur,
    upperQuartileEur: raw.upperQuartileEur,
  };
}
