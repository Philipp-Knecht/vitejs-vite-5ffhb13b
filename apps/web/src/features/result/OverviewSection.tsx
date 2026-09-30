import type { OverviewItem } from '@kaufcheck/shared';
import { EvidenceBadge } from '../../components/EvidenceBadge';
import { ResultSection } from './Section';

export function OverviewSection({ items }: { items: OverviewItem[] }) {
  return (
    <ResultSection
      id="ueberblick"
      title="Überblick"
      lead="Die wichtigsten Angaben aus dem Inserat – und woher sie stammen."
    >
      {items.length === 0 ? (
        <p className="muted">Im Inserat wurden keine Fahrzeugangaben erkannt.</p>
      ) : (
        <dl className="overview-grid">
          {items.map((item) => (
            <div key={item.key} className="overview-item">
              <dt className="overview-item__label">{item.label}</dt>
              <dd className="overview-item__value">
                {item.value ?? <span className="not-stated">Nicht angegeben</span>}
              </dd>
              <dd className="overview-item__meta">
                <EvidenceBadge evidence={item.value === null ? 'unknown' : item.evidence} />
                {item.note && <span className="overview-item__note">{item.note}</span>}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </ResultSection>
  );
}
