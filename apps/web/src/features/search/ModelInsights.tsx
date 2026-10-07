import {
  makeById,
  modelById,
  SEGMENT_LABELS,
  type CarModel,
  type Generation,
} from '@kaufcheck/catalog';
import { hasKnowledge, loadKnowledge } from '@kaufcheck/catalog/knowledge';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { cn } from '../../lib/format';

const SEVERITY_LABELS = { hoch: 'Wichtig', mittel: 'Beachten', gering: 'Am Rande' } as const;

const yearsLabel = ([from, to]: readonly [number, number | null]) =>
  to === null ? `seit ${from}` : from === to ? String(from) : `${from}–${to}`;

/** The generation that fits the searched years best, else the newest one older than 3 years. */
function defaultGeneration(
  model: CarModel,
  yearMin: number | null,
  yearMax: number | null,
): Generation | undefined {
  const generations = model.generations;
  if (yearMin !== null || yearMax !== null) {
    const from = yearMin ?? 1990;
    const to = yearMax ?? new Date().getFullYear();
    const overlap = (generation: Generation) => {
      const end = generation.years[1] ?? new Date().getFullYear();
      return Math.min(end, to) - Math.max(generation.years[0], from);
    };
    const best = [...generations].sort((a, b) => overlap(b) - overlap(a))[0];
    if (best && overlap(best) >= 0) return best;
  }
  const usedAge = new Date().getFullYear() - 3;
  return (
    [...generations].reverse().find((generation) => generation.years[0] <= usedAge) ??
    generations[generations.length - 1]
  );
}

function GenerationDetails({ generation }: { generation: Generation }) {
  return (
    <div className="model-generation">
      {generation.strengths.length > 0 && (
        <section aria-label="Stärken">
          <h4>Stärken</h4>
          <ul className="check-list">
            {generation.strengths.map((strength) => (
              <li key={strength}>{strength}</li>
            ))}
          </ul>
        </section>
      )}
      {generation.issues.length > 0 && (
        <section aria-label="Bekannte Schwachstellen">
          <h4>Bekannte Schwachstellen</h4>
          <ul className="issue-list">
            {generation.issues.map((issue) => (
              <li key={issue.title} className="issue">
                <p className="issue__head">
                  <span className={cn('issue__severity', `issue__severity--${issue.severity}`)}>
                    {SEVERITY_LABELS[issue.severity]}
                  </span>
                  <strong>{issue.title}</strong>
                </p>
                <p className="issue__affects">Betrifft: {issue.affects}</p>
                <p>{issue.detail}</p>
                <p className="issue__check">
                  <strong>Darauf achten:</strong> {issue.check}
                </p>
                <p className="issue__sources">
                  Quelle{issue.sources.length > 1 ? 'n' : ''}:{' '}
                  {issue.sources.map((source, index) => (
                    <span key={source.url}>
                      {index > 0 && ', '}
                      <a href={source.url} target="_blank" rel="noopener nofollow">
                        {source.label}
                      </a>
                    </span>
                  ))}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
      {(generation.engines.recommended.length > 0 || generation.engines.caution.length > 0) && (
        <section aria-label="Motoren" className="engine-notes">
          {generation.engines.recommended.length > 0 && (
            <div>
              <h4>Empfehlenswert</h4>
              <ul>
                {generation.engines.recommended.map((engine) => (
                  <li key={engine.name}>
                    <strong>{engine.name}</strong> – {engine.why}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {generation.engines.caution.length > 0 && (
            <div>
              <h4>Mit Vorsicht</h4>
              <ul>
                {generation.engines.caution.map((engine) => (
                  <li key={engine.name}>
                    <strong>{engine.name}</strong> – {engine.why}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
      {generation.tips.length > 0 && (
        <section aria-label="Tipps für die Besichtigung">
          <h4>Tipps für die Besichtigung</h4>
          <ul className="check-list">
            {generation.tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

interface ModelKnowledgeViewProps {
  model: CarModel;
  yearMin?: number | null;
  yearMax?: number | null;
  /** Heading level of the generation title (below the page or section heading). */
  generationHeading?: 'h2' | 'h3';
}

/** Generations with strengths, weaknesses (with sources), engines and inspection tips. */
export function ModelKnowledgeView({
  model,
  yearMin = null,
  yearMax = null,
  generationHeading: GenerationHeading = 'h3',
}: ModelKnowledgeViewProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const generation =
    model.generations.find((item) => item.id === selected) ??
    defaultGeneration(model, yearMin, yearMax);
  const twin = model.twinOf ? modelById(model.twinOf) : null;
  const twinName = twin ? `${makeById(twin.makeId)?.name ?? ''} ${twin.model}`.trim() : '';

  return (
    <div className="model-knowledge">
      {twin && (
        <p className="model-insights__note">
          Technisch weitgehend baugleich mit{' '}
          {hasKnowledge(twin.id) ? <Link to={`/modelle/${twin.id}`}>{twinName}</Link> : twinName} –
          die dort bekannten Schwachstellen gelten meist auch hier.
        </p>
      )}
      {model.generations.length > 1 && (
        <div className="segmented" role="group" aria-label="Generation wählen">
          {model.generations.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cn('segmented__option', item.id === generation?.id && 'is-active')}
              aria-pressed={item.id === generation?.id}
              onClick={() => setSelected(item.id)}
            >
              {item.name} <span className="segmented__meta">{yearsLabel(item.years)}</span>
            </button>
          ))}
        </div>
      )}
      {generation && (
        <>
          <GenerationHeading className="model-insights__generation">
            {generation.name}
            {generation.code ? ` (${generation.code})` : ''}, {yearsLabel(generation.years)}
          </GenerationHeading>
          <GenerationDetails generation={generation} />
        </>
      )}
      <p className="model-insights__disclaimer">
        Bekannte Schwachstellen laut ADAC, TÜV-Report und Fachpresse – sie treten nicht bei jedem
        Auto auf. Wie es um das Auto vor dir steht, zeigt erst die Besichtigung, im Zweifel mit
        einer Werkstatt.{' '}
        <Link to="/auto-besichtigung-checkliste">Zur Besichtigungs-Checkliste</Link>
      </p>
    </div>
  );
}

interface ModelInsightsProps {
  modelId: string;
  yearMin: number | null;
  yearMax: number | null;
}

/** Researched knowledge about the searched model (loaded on demand), on the search page. */
export function ModelInsights({ modelId, yearMin, yearMax }: ModelInsightsProps) {
  const entry = modelById(modelId);
  const knowledge = useQuery({
    queryKey: ['model-knowledge', modelId],
    queryFn: () => loadKnowledge(modelId),
    enabled: hasKnowledge(modelId),
    staleTime: Infinity,
  });
  if (!entry || !hasKnowledge(modelId) || !knowledge.data) return null;
  const model = knowledge.data;
  const headingId = `insights-${model.id}`;

  return (
    <section className="section section--muted model-insights" aria-labelledby={headingId}>
      <div className="container">
        <p className="eyebrow">{SEGMENT_LABELS[model.segment]}</p>
        <h2 id={headingId} className="section__title">
          {model.make} {model.model}: Das solltest du wissen
        </h2>
        <p className="section__lead">{model.summary}</p>
        <ModelKnowledgeView model={model} yearMin={yearMin} yearMax={yearMax} />
        <p>
          <Link to={`/modelle/${model.id}`}>
            Alle Infos zu {model.make} {model.model}
          </Link>
        </p>
      </div>
    </section>
  );
}
