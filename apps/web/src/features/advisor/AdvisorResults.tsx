import {
  EMPTY_SEARCH,
  modelById,
  recommend,
  SEARCH_FUEL_LABELS,
  SEGMENT_LABELS,
  toSearchParams,
  type AdvisorAnswers,
  type Recommendation,
} from '@kaufcheck/catalog';
import { loadKnowledge } from '@kaufcheck/catalog/knowledge';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { Link } from 'react-router';
import { PageLoading } from '../../components/ui/Spinner';
import { track } from '../../lib/analytics';

const yearsLabel = ([from, to]: readonly [number, number | null]) =>
  to === null ? `seit ${from}` : `${from}–${to}`;

function searchLink(recommendation: Recommendation, answers: AdvisorAnswers): string {
  const entry = modelById(recommendation.model.id);
  const params = toSearchParams({
    ...EMPTY_SEARCH,
    makeId: entry?.makeId ?? null,
    modelId: entry?.id ?? null,
    priceMax: answers.budget,
    yearMin: recommendation.generation.years[0],
    // Only a clear choice narrows the search; "petrol or hybrid" stays open.
    fuel: recommendation.fuels.length === 1 ? (recommendation.fuels[0] ?? null) : null,
    transmission: answers.transmission,
  });
  return `/auto-finden?${params.toString()}`;
}

/** The two most important weaknesses of the suggested generation (loaded per model). */
function WatchOut({ recommendation }: { recommendation: Recommendation }) {
  const knowledge = useQuery({
    queryKey: ['model-knowledge', recommendation.model.id],
    queryFn: () => loadKnowledge(recommendation.model.id),
    staleTime: Infinity,
  });
  const generation = knowledge.data?.generations.find(
    (item) => item.id === recommendation.generation.id,
  );
  const issues = [...(generation?.issues ?? [])]
    .sort((a, b) => (a.severity === 'hoch' ? 0 : 1) - (b.severity === 'hoch' ? 0 : 1))
    .slice(0, 2);
  if (issues.length === 0) return null;
  return (
    <div className="recommendation__watch">
      <p className="recommendation__label">Darauf achten</p>
      <ul>
        {issues.map((issue) => (
          <li key={issue.title}>
            {issue.title} <span className="recommendation__affects">({issue.affects})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface AdvisorResultsProps {
  answers: AdvisorAnswers;
  onEdit: () => void;
}

export function AdvisorResults({ answers, onEdit }: AdvisorResultsProps) {
  const index = useQuery({
    queryKey: ['advisor-index'],
    queryFn: () => import('@kaufcheck/catalog/advisor-index').then((module) => module.MODEL_INDEX),
    staleTime: Infinity,
    // E.g. an outdated chunk after a deploy: the error boundary offers a reload.
    throwOnError: true,
  });
  if (!index.data) return <PageLoading />;
  const recommendations = recommend(index.data, answers);

  if (recommendations.length === 0) {
    return (
      <div className="advisor-empty">
        <h2 className="section__title">Dazu passt noch keines unserer Modelle</h2>
        <p>
          Wir kennen bisher {index.data.length} Modelle genauer. Versuch es mit einem etwas höheren
          Budget oder weniger strengen Vorgaben – oder such direkt nach deinem Wunschauto.
        </p>
        <div className="button-row">
          <button type="button" className="btn btn--secondary btn--md" onClick={onEdit}>
            <span>Antworten ändern</span>
          </button>
          <Link to="/auto-finden" className="btn btn--primary btn--md">
            <span>Direkt zur Suche</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="advisor-results">
      <div className="advisor-results__head">
        <h2 className="section__title">Diese Modelle passen zu dir</h2>
        <button type="button" className="link-button" onClick={onEdit}>
          Antworten ändern
        </button>
      </div>
      <ol className="recommendations">
        {recommendations.map((recommendation, index) => {
          const { model, generation } = recommendation;
          return (
            <li key={model.id} className="recommendation">
              <p className="recommendation__rank" aria-hidden>
                {index + 1}
              </p>
              <div className="recommendation__body">
                <h3 className="recommendation__title">
                  {model.make} {model.model}
                </h3>
                <p className="recommendation__meta">
                  {generation.name}, {yearsLabel(generation.years)} ·{' '}
                  {SEGMENT_LABELS[model.segment]}
                  {recommendation.fuels.length > 0 &&
                    ` · ${recommendation.fuels
                      .slice(0, 2)
                      .map((fuel) => SEARCH_FUEL_LABELS[fuel])
                      .join(' oder ')}`}
                </p>
                {recommendation.reasons.length > 0 && (
                  <ul className="check-list check-list--compact">
                    {recommendation.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                )}
                <WatchOut recommendation={recommendation} />
                <div className="button-row">
                  <Link
                    to={searchLink(recommendation, answers)}
                    className="btn btn--primary btn--md"
                    onClick={() => track('car_search_started', { placement: 'advisor' })}
                  >
                    <Search aria-hidden size={18} />
                    <span>Angebote finden</span>
                  </Link>
                  <Link to={`/modelle/${model.id}`} className="btn btn--secondary btn--md">
                    <span>Mehr zum Modell</span>
                  </Link>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="advisor-results__note">
        Die Reihenfolge ergibt sich aus deinen Antworten und unserer Einschätzung zu Zuverlässigkeit
        (nach TÜV-Report und ADAC-Pannenstatistik), Kosten, Platz und Komfort. Welche Generation in
        dein Budget passt, schätzen wir grob nach Fahrzeugklasse und Alter – die echten Preise
        zeigen die Börsen. Das ist keine Kaufempfehlung: Wie gut ein Auto ist, zeigt erst die
        Besichtigung.
      </p>
    </div>
  );
}
