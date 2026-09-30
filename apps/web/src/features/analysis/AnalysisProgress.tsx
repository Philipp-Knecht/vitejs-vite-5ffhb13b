import type { AnalysisStage } from '@kaufcheck/shared';
import { Check, Circle } from 'lucide-react';
import type { AnalysisRequest } from '../../api/analysis-stream';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { cn } from '../../lib/format';
import type { StageView } from './use-analysis-runner';

function stageLabel(stage: AnalysisStage, kind: AnalysisRequest['kind']): string {
  switch (stage) {
    case 'validate':
      return kind === 'url' ? 'Link prüfen' : 'Eingabe prüfen';
    case 'retrieve':
      return kind === 'text'
        ? 'Text übernehmen'
        : kind === 'example'
          ? 'Beispiel laden'
          : kind === 'reanalysis'
            ? 'Inserat erneut laden'
            : 'Inserat abrufen';
    case 'extract':
      return 'Angaben erkennen';
    case 'analyze':
      return 'Angaben auswerten';
    case 'questions':
      return 'Fragen und Checkliste erstellen';
    case 'ai':
      return 'KI-Einschätzung ergänzen';
  }
}

/** Shows the pipeline stages exactly as the server reports them – no simulated progress. */
export function AnalysisProgress({
  stages,
  kind,
  onCancel,
}: {
  stages: StageView[];
  kind: AnalysisRequest['kind'];
  onCancel: () => void;
}) {
  const active = stages.find((item) => item.state === 'active');
  return (
    <section className="progress-card" aria-labelledby="progress-title">
      <div className="progress-card__header">
        <h2 id="progress-title" className="progress-card__title">
          {kind === 'example' ? 'Beispiel wird geprüft' : 'Inserat wird geprüft'}
        </h2>
        <Button variant="quiet" size="sm" onClick={onCancel}>
          Abbrechen
        </Button>
      </div>
      <ol className="progress-steps">
        {stages.map((item) => (
          <li key={item.stage} className={cn('progress-step', `progress-step--${item.state}`)}>
            <span className="progress-step__icon" aria-hidden>
              {item.state === 'done' ? (
                <Check size={16} />
              ) : item.state === 'active' ? (
                <Spinner size="sm" />
              ) : (
                <Circle size={10} />
              )}
            </span>
            <span className="progress-step__label">{stageLabel(item.stage, kind)}</span>
            <span className="visually-hidden">
              {item.state === 'done'
                ? ' – erledigt'
                : item.state === 'active'
                  ? ' – läuft'
                  : ' – ausstehend'}
            </span>
          </li>
        ))}
      </ol>
      <p className="visually-hidden" aria-live="polite">
        {active ? `${stageLabel(active.stage, kind)} …` : ''}
      </p>
    </section>
  );
}
