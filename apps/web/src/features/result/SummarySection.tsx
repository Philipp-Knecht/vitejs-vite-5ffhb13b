import type { AnalysisResult, Highlight } from '@kaufcheck/shared';
import { CircleHelp, ThumbsUp } from 'lucide-react';
import { EvidenceBadge } from '../../components/EvidenceBadge';
import { Quote, ResultSection } from './Section';

function HighlightList({ items, empty }: { items: Highlight[]; empty: string }) {
  if (items.length === 0) return <p className="muted">{empty}</p>;
  return (
    <ul className="highlight-list">
      {items.map((item) => (
        <li key={`${item.origin}:${item.text}`} className="highlight">
          <p className="highlight__text">{item.text}</p>
          {item.quote && (
            <p className="highlight__quote">
              Im Inserat: <Quote>{item.quote}</Quote>
            </p>
          )}
          <EvidenceBadge evidence={item.evidence} origin={item.origin} />
        </li>
      ))}
    </ul>
  );
}

export function SummarySection({ analysis }: { analysis: AnalysisResult }) {
  const { summary, ai } = analysis;
  return (
    <ResultSection id="zusammenfassung" title="Das Wichtigste in Kürze">
      <p className="summary-text">{summary.text}</p>
      <div className="summary-columns">
        <div className="summary-column summary-column--positive">
          <h3>
            <ThumbsUp aria-hidden size={18} /> Spricht dafür
          </h3>
          <HighlightList
            items={summary.positives}
            empty="Das Inserat nennt dazu keine belastbaren Angaben."
          />
        </div>
        <div className="summary-column summary-column--open">
          <h3>
            <CircleHelp aria-hidden size={18} /> Offen oder unklar
          </h3>
          <HighlightList
            items={summary.openPoints}
            empty="Keine offenen Punkte in den Angaben gefunden."
          />
        </div>
      </div>
      {summary.ai && (
        <aside className="ai-summary" aria-label="KI-Einschätzung">
          <p className="ai-summary__label">
            {ai.isMock
              ? 'Simulierte KI-Einschätzung (Entwicklungsmodus)'
              : 'Ergänzende KI-Einschätzung'}
          </p>
          <p>{summary.ai.text}</p>
          <EvidenceBadge evidence="inference" origin="ai" />
        </aside>
      )}
    </ResultSection>
  );
}
