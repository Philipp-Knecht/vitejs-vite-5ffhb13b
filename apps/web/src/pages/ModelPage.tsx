import {
  EMPTY_SEARCH,
  makeById,
  modelById,
  MODELS,
  SEGMENT_LABELS,
  toSearchParams,
  type CarModel,
} from '@kaufcheck/catalog';
import { hasKnowledge, KNOWLEDGE_IDS, loadKnowledge } from '@kaufcheck/catalog/knowledge';
import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck, Search } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { PageLoading } from '../components/ui/Spinner';
import { usePreloadedModel } from '../features/models/preloaded';
import { ModelKnowledgeView } from '../features/search/ModelInsights';
import { modelPageMeta } from '../seo/model-meta';
import { usePageMeta } from '../seo/use-page-meta';
import { NotFoundPage } from './NotFoundPage';

const yearsLabel = ([from, to]: readonly [number, number | null]) =>
  to === null ? `seit ${from}` : `${from}–${to}`;

/** Other researched models of the same class, for comparison. */
function related(model: CarModel) {
  return MODELS.filter(
    (item) =>
      item.segment === model.segment && item.id !== model.id && KNOWLEDGE_IDS.includes(item.id),
  )
    .slice(0, 8)
    .map((item) => ({ id: item.id, name: `${makeById(item.makeId)?.name ?? ''} ${item.model}` }));
}

function ModelContent({ model }: { model: CarModel }) {
  usePageMeta(modelPageMeta(model));
  const entry = modelById(model.id);
  const search = toSearchParams({
    ...EMPTY_SEARCH,
    makeId: entry?.makeId ?? null,
    modelId: model.id,
  });
  const alternatives = related(model);
  const [first] = model.generations;
  const last = model.generations[model.generations.length - 1];

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <nav className="breadcrumbs" aria-label="Brotkrümelnavigation">
            <ol>
              <li>
                <Link to="/">KaufCheck</Link>
              </li>
              <li>
                <Link to="/modelle">Modelle</Link>
              </li>
              <li>
                <span aria-current="page">
                  {model.make} {model.model}
                </span>
              </li>
            </ol>
          </nav>
          <p className="eyebrow">{SEGMENT_LABELS[model.segment]}</p>
          <h1 className="page-hero__title">
            {model.make} {model.model} gebraucht kaufen
          </h1>
          <p className="page-hero__lead">{model.summary}</p>
          {first && last && (
            <p className="model-page__generations">
              {model.generations.length === 1
                ? `Hier: ${first.name} (${yearsLabel(first.years)})`
                : `${model.generations.length} Generationen: ${model.generations
                    .map((generation) => `${generation.name} (${yearsLabel(generation.years)})`)
                    .join(', ')}`}
            </p>
          )}
          <div className="button-row">
            <Link to={`/auto-finden?${search.toString()}`} className="btn btn--primary btn--lg">
              <Search aria-hidden size={20} />
              <span>
                {model.make} {model.model} finden
              </span>
            </Link>
            <Link to="/inserat-pruefen" className="btn btn--secondary btn--lg">
              <ClipboardCheck aria-hidden size={20} />
              <span>Inserat prüfen</span>
            </Link>
          </div>
        </div>
      </section>
      <section className="section" aria-label="Generationen, Schwachstellen und Motoren">
        <div className="container">
          <ModelKnowledgeView model={model} generationHeading="h2" />
        </div>
      </section>
      {alternatives.length > 0 && (
        <section className="section section--muted" aria-labelledby="alternatives-title">
          <div className="container">
            <h2 id="alternatives-title" className="section__title">
              Ähnliche Modelle
            </h2>
            <ul className="model-links">
              {alternatives.map((item) => (
                <li key={item.id}>
                  <Link to={`/modelle/${item.id}`}>{item.name}</Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </>
  );
}

/** One page per researched model: generations, weaknesses with sources, engines, tips. */
export function ModelPage() {
  const { id = '' } = useParams();
  const preloaded = usePreloadedModel();
  const initial = preloaded?.id === id ? preloaded : undefined;
  const known = hasKnowledge(id);
  const knowledge = useQuery({
    queryKey: ['model-knowledge', id],
    queryFn: () => loadKnowledge(id),
    enabled: known && !initial,
    initialData: initial,
    staleTime: Infinity,
    // E.g. an outdated chunk after a deploy: the error boundary offers a reload.
    throwOnError: true,
  });
  if (!known) return <NotFoundPage />;
  if (!knowledge.data) return <PageLoading />;
  return <ModelContent model={knowledge.data} />;
}
