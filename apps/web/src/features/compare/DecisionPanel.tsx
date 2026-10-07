import { findListingModel, findMake } from '@kaufcheck/catalog';
import {
  comparisonValues,
  DEFAULT_DECISION_WEIGHTS,
  rankOffers,
  type ComparisonDto,
  type DecisionValues,
  type DecisionWeight,
  type DecisionWeights,
} from '@kaufcheck/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { cn } from '../../lib/format';
import { readJson, writeJson } from '../../lib/storage';

const STORAGE_KEY = 'kaufcheck:entscheidung-prioritaeten';
const WEIGHT_LABELS: Record<DecisionWeight, string> = {
  0: 'Egal',
  1: 'Wichtig',
  2: 'Sehr wichtig',
};
const WEIGHTS: readonly DecisionWeight[] = [0, 1, 2];

const isWeights = (value: unknown): value is DecisionWeights =>
  typeof value === 'object' &&
  value !== null &&
  Object.values(value).every((weight) => weight === 0 || weight === 1 || weight === 2);

const MODEL_RELIABILITY = {
  key: 'modelReliability',
  label: 'Zuverlässigkeit des Modells',
  prefer: 'max',
  best: 'zuverlässigstes Modell laut ADAC und TÜV',
} as const;

/** The researched reliability (1–5) of each offer's model, where KaufCheck knows the model. */
function useModelReliability(comparison: ComparisonDto): DecisionValues | null {
  const ids = comparison.items.map(
    (item) => findListingModel(findMake(item.vehicle?.make), item.vehicle?.model)?.id ?? null,
  );
  const index = useQuery({
    queryKey: ['advisor-index'],
    queryFn: () => import('@kaufcheck/catalog/advisor-index').then((module) => module.MODEL_INDEX),
    staleTime: Infinity,
    enabled: ids.some((id) => id !== null),
  });
  if (!index.data) return null;
  const values = ids.map(
    (id) => index.data.find((model) => model.id === id)?.ratings.reliability ?? null,
  );
  return values.filter((value) => value !== null).length >= 2
    ? { ...MODEL_RELIABILITY, values }
    : null;
}

/**
 * The buyer's priorities turn the comparison into an order: who to contact
 * first. Purely the listings' numbers, weighted as the buyer says.
 */
export function DecisionPanel({ comparison }: { comparison: ComparisonDto }) {
  const [weights, setWeights] = useState<DecisionWeights>(() => ({
    ...DEFAULT_DECISION_WEIGHTS,
    [MODEL_RELIABILITY.key]: 1,
    ...readJson(STORAGE_KEY, {}, isWeights),
  }));
  const reliability = useModelReliability(comparison);
  const criteria = useMemo(
    () => [...comparisonValues(comparison), ...(reliability ? [reliability] : [])],
    [comparison, reliability],
  );
  const ranked = rankOffers(comparison.items.length, criteria, weights);
  const decided = ranked.some((offer) => offer.score > 0);
  const firstCount = comparison.items.length > 2 ? 2 : 1;

  const choose = (key: string, weight: DecisionWeight) => {
    const next = { ...weights, [key]: weight };
    setWeights(next);
    writeJson(STORAGE_KEY, next);
  };

  return (
    <section className="page__section decision" aria-labelledby="decision-title">
      <h2 id="decision-title">Deine Reihenfolge</h2>
      <p className="muted">
        Stell ein, was dir wichtig ist – KaufCheck sortiert die Angebote danach. Mit anderen
        Prioritäten ändert sich die Reihenfolge; ein Urteil über die Autos ist das nicht.
      </p>
      <div className="decision__layout">
        <div className="decision__weights">
          {criteria.map((criterion) => (
            <fieldset key={criterion.key} className="weight-row">
              <legend className="weight-row__label">{criterion.label}</legend>
              <div className="weight-row__options">
                {WEIGHTS.map((weight) => {
                  const checked = (weights[criterion.key] ?? 0) === weight;
                  return (
                    <label key={weight} className={cn('weight-option', checked && 'is-checked')}>
                      <input
                        type="radio"
                        name={`weight-${criterion.key}`}
                        checked={checked}
                        onChange={() => choose(criterion.key, weight)}
                      />
                      <span>{WEIGHT_LABELS[weight]}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>
        <div>
          {decided ? (
            <p className="decision__first">
              Nach deinen Prioritäten zuerst anfragen:{' '}
              {ranked
                .slice(0, firstCount)
                .map((offer) => comparison.items[offer.index]?.title)
                .join(' und ')}
            </p>
          ) : (
            <p className="decision__first">Wähle aus, was dir wichtig ist.</p>
          )}
          <ol className="decision__ranking">
            {ranked.map((offer, position) => {
              const item = comparison.items[offer.index];
              if (!item) return null;
              return (
                <li
                  key={item.savedListingId}
                  className={cn('ranked-offer', decided && position < firstCount && 'is-first')}
                >
                  <span className="ranked-offer__position" aria-hidden>
                    {position + 1}
                  </span>
                  <div className="ranked-offer__body">
                    <Link to={`/analyse/${item.analysisId}`} className="ranked-offer__title">
                      {item.title}
                    </Link>
                    {offer.ahead.length > 0 && <p>Vorne bei: {offer.ahead.join(', ')}</p>}
                    {offer.unknown.length > 0 && (
                      <p className="muted">Keine Angabe zu: {offer.unknown.join(', ')}</p>
                    )}
                    {decided && position < firstCount && (
                      <Link to={`/analyse/${item.analysisId}#fragen`}>
                        Fragen an den Verkäufer ansehen
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
