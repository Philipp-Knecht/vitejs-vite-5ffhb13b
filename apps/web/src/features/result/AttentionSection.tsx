import type { CheckItem, Observation } from '@kaufcheck/shared';
import { AlertTriangle, Info, SearchCheck, TriangleAlert } from 'lucide-react';
import { EvidenceBadge } from '../../components/EvidenceBadge';
import { cn } from '../../lib/format';
import { Quote, ResultSection } from './Section';

const SEVERITY_ORDER = { warning: 0, notice: 1, info: 2 } as const;
const SEVERITY_LABELS = { warning: 'Wichtig', notice: 'Beachten', info: 'Hinweis' } as const;
const SEVERITY_ICONS = { warning: TriangleAlert, notice: AlertTriangle, info: Info } as const;

export function AttentionSection({
  observations,
  checks,
}: {
  observations: Observation[];
  checks: CheckItem[];
}) {
  const sorted = [...observations].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );
  return (
    <ResultSection
      id="darauf-achten"
      title="Darauf solltest du achten"
      lead="Auffälligkeiten stützen sich auf konkrete Stellen im Inserat. Prüfhinweise sagen dir, was du vor Ort kontrollieren solltest."
    >
      <h3 className="subsection-title">Auffälligkeiten</h3>
      {sorted.length === 0 ? (
        <p className="muted">
          In den Angaben ist nichts Auffälliges erkannt worden. Das heißt nicht, dass das Auto frei
          von Mängeln ist.
        </p>
      ) : (
        <ul className="observation-list">
          {sorted.map((item) => {
            const Icon = SEVERITY_ICONS[item.severity];
            return (
              <li key={item.id} className={cn('observation', `observation--${item.severity}`)}>
                <div className="observation__head">
                  <Icon aria-hidden size={18} className="observation__icon" />
                  <span className="observation__severity">{SEVERITY_LABELS[item.severity]}</span>
                </div>
                <h4 className="observation__title">{item.title}</h4>
                <p className="observation__detail">{item.detail}</p>
                {item.quotes.map((quote) => (
                  <p key={quote} className="observation__quote">
                    Im Inserat: <Quote>{quote}</Quote>
                  </p>
                ))}
                <EvidenceBadge evidence={item.evidence} origin={item.origin} />
              </li>
            );
          })}
        </ul>
      )}

      <h3 className="subsection-title">Prüfhinweise</h3>
      {checks.length === 0 ? (
        <p className="muted">
          Keine besonderen Prüfhinweise – die allgemeine Checkliste unten gilt trotzdem.
        </p>
      ) : (
        <ul className="check-items">
          {checks.map((item) => (
            <li key={item.id} className="check-item">
              <SearchCheck aria-hidden size={18} className="check-item__icon" />
              <div>
                <h4 className="check-item__title">{item.title}</h4>
                <p className="check-item__detail">{item.detail}</p>
                {item.basis && <p className="check-item__basis">Grund: {item.basis}</p>}
                {(item.evidence || item.origin === 'ai') && (
                  <EvidenceBadge evidence={item.evidence ?? 'inference'} origin={item.origin} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </ResultSection>
  );
}
