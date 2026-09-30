import {
  EVIDENCE_DESCRIPTIONS,
  EVIDENCE_LABELS,
  type EvidenceType,
  type Origin,
} from '@kaufcheck/shared';
import { Calculator, FileText, HelpCircle, Lightbulb, Sparkles } from 'lucide-react';

const ICONS = {
  listing_fact: FileText,
  calculation: Calculator,
  inference: Lightbulb,
  unknown: HelpCircle,
} as const;

/** Where a statement comes from – shown next to every statement in the analysis. */
export function EvidenceBadge({ evidence, origin }: { evidence: EvidenceType; origin?: Origin }) {
  const Icon = ICONS[evidence];
  return (
    <span className="evidence-group">
      <span className={`evidence evidence--${evidence}`} title={EVIDENCE_DESCRIPTIONS[evidence]}>
        <Icon aria-hidden size={13} />
        {EVIDENCE_LABELS[evidence]}
      </span>
      {origin === 'ai' && (
        <span
          className="evidence evidence--ai"
          title="Von einem KI-Modell formuliert und automatisch gegengeprüft."
        >
          <Sparkles aria-hidden size={13} />
          KI
        </span>
      )}
    </span>
  );
}

/** Legend explaining the evidence labels. */
export function EvidenceLegend() {
  const types: EvidenceType[] = ['listing_fact', 'calculation', 'inference', 'unknown'];
  return (
    <dl className="evidence-legend">
      {types.map((type) => (
        <div key={type} className="evidence-legend__item">
          <dt>
            <EvidenceBadge evidence={type} />
          </dt>
          <dd>{EVIDENCE_DESCRIPTIONS[type]}</dd>
        </div>
      ))}
    </dl>
  );
}
