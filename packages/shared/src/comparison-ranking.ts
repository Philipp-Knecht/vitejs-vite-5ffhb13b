import type { ComparisonDto } from './schemas/api';

/**
 * The buyer's own order of saved offers: each criterion the buyer finds
 * important compares the offers' numbers (best = 1, worst = 0) and the
 * weighted average decides. KaufCheck adds no judgement of its own – with
 * other priorities the order changes.
 */
export const DECISION_CRITERIA = [
  { key: 'price', label: 'Preis', prefer: 'min', best: 'günstigster Preis' },
  { key: 'mileage', label: 'Kilometerstand', prefer: 'min', best: 'wenigste Kilometer' },
  { key: 'age', label: 'Alter', prefer: 'min', best: 'jüngstes Auto' },
  {
    key: 'kmPerYear',
    label: 'Kilometer pro Jahr',
    prefer: 'min',
    best: 'am wenigsten gefahren pro Jahr',
  },
  {
    key: 'completeness',
    label: 'Vollständige Angaben',
    prefer: 'max',
    best: 'vollständigste Angaben',
  },
  {
    key: 'observations',
    label: 'Auffälligkeiten im Inserat',
    prefer: 'min',
    best: 'wenigste Auffälligkeiten',
  },
  { key: 'previousOwners', label: 'Vorbesitzer', prefer: 'min', best: 'wenigste Vorbesitzer' },
  { key: 'hu', label: 'Zeit bis zur nächsten HU', prefer: 'max', best: 'längste Zeit bis zur HU' },
] as const;

export type DecisionCriterionKey = (typeof DECISION_CRITERIA)[number]['key'];

/** 0 = egal, 1 = wichtig, 2 = sehr wichtig. */
export type DecisionWeight = 0 | 1 | 2;
export type DecisionWeights = Record<string, DecisionWeight>;

export const DEFAULT_DECISION_WEIGHTS: Readonly<Record<DecisionCriterionKey, DecisionWeight>> = {
  price: 2,
  mileage: 1,
  age: 1,
  kmPerYear: 0,
  completeness: 1,
  observations: 2,
  previousOwners: 0,
  hu: 0,
};

/** A criterion with one number per offer (`null` = unknown). */
export interface DecisionValues {
  key: string;
  label: string;
  prefer: 'min' | 'max';
  /** Wording when an offer is best in this criterion. */
  best: string;
  values: readonly (number | null)[];
}

export interface RankedOffer {
  /** Position of the offer in the comparison. */
  index: number;
  /** Weighted share of the best possible result, 0–1. */
  score: number;
  /** Criteria in which this offer is best, most important first. */
  ahead: string[];
  /** Important criteria the listing says nothing about. */
  unknown: string[];
}

/** The numeric criteria of a comparison, ready for weighing. */
export function comparisonValues(comparison: ComparisonDto): DecisionValues[] {
  return DECISION_CRITERIA.flatMap((criterion) => {
    const row = comparison.rows.find((item) => item.key === criterion.key);
    return row?.numbers ? [{ ...criterion, values: row.numbers }] : [];
  });
}

export function rankOffers(
  count: number,
  criteria: readonly DecisionValues[],
  weights: DecisionWeights,
): RankedOffer[] {
  const totals = Array.from({ length: count }, () => 0);
  const ahead: { label: string; weight: number }[][] = Array.from({ length: count }, () => []);
  const unknown: string[][] = Array.from({ length: count }, () => []);
  let weightSum = 0;

  for (const criterion of criteria) {
    const weight = weights[criterion.key] ?? 0;
    if (weight === 0) continue;
    const known = criterion.values.filter((value): value is number => value !== null);
    criterion.values.forEach((value, index) => {
      if (value === null && index < count) unknown[index]?.push(criterion.label);
    });
    const min = Math.min(...known);
    const max = Math.max(...known);
    // Nothing to compare: fewer than two known values or all the same.
    if (known.length < 2 || min === max) continue;
    weightSum += weight;
    criterion.values.forEach((value, index) => {
      if (value === null || index >= count) return;
      const share =
        criterion.prefer === 'min' ? (max - value) / (max - min) : (value - min) / (max - min);
      totals[index] = (totals[index] ?? 0) + weight * share;
      if (share === 1) ahead[index]?.push({ label: criterion.best, weight });
    });
  }

  return totals
    .map((total, index) => ({
      index,
      score: weightSum === 0 ? 0 : total / weightSum,
      ahead: (ahead[index] ?? []).sort((a, b) => b.weight - a.weight).map((item) => item.label),
      unknown: unknown[index] ?? [],
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
}
