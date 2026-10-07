import { EVIDENCE_LABELS, type ComparisonDto, type ComparisonRow } from '@kaufcheck/shared';
import { Check, Minus } from 'lucide-react';
import { Fragment, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ApiRequestError } from '../../api/client';
import { useComparison, useMe } from '../../api/queries';
import { Alert } from '../../components/ui/Alert';
import { ButtonLink } from '../../components/ui/Button';
import { PageLoading } from '../../components/ui/Spinner';
import { cn } from '../../lib/format';
import { DecisionPanel } from './DecisionPanel';
import { appPageMeta } from '../../seo/pages';
import { usePageMeta } from '../../seo/use-page-meta';

const META = appPageMeta('Angebote vergleichen');

function groupRows(rows: ComparisonRow[]): [string, ComparisonRow[]][] {
  const groups = new Map<string, ComparisonRow[]>();
  for (const row of rows) groups.set(row.group, [...(groups.get(row.group) ?? []), row]);
  return [...groups];
}

function ComparisonTable({
  comparison,
  onlyDifferences,
}: {
  comparison: ComparisonDto;
  onlyDifferences: boolean;
}) {
  const rows = onlyDifferences ? comparison.rows.filter((row) => row.differs) : comparison.rows;
  const columns = comparison.items.length;
  return (
    <div className="table-scroll" tabIndex={0} role="region" aria-label="Vergleichstabelle">
      <table className="compare-table">
        <thead>
          <tr>
            <th scope="col" className="compare-table__corner">
              <span className="visually-hidden">Merkmal</span>
            </th>
            {comparison.items.map((item) => (
              <th key={item.savedListingId} scope="col">
                <Link to={`/analyse/${item.analysisId}`}>{item.title}</Link>
                {item.isExample && <span className="tag">Beispiel</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groupRows(rows).map(([group, groupRowsList]) => (
            <Fragment key={group}>
              <tr className="compare-table__group">
                <th scope="colgroup" colSpan={columns + 1}>
                  {group}
                </th>
              </tr>
              {groupRowsList.map((row) => (
                <tr key={row.key} className={cn(row.differs && 'compare-table__row--differs')}>
                  <th scope="row">{row.label}</th>
                  {row.cells.map((cell, index) => (
                    <td key={index}>
                      {cell.value ?? <span className="not-stated">Nicht angegeben</span>}
                      {cell.marker && <span className="marker">{cell.marker}</span>}
                      {cell.value !== null && cell.evidence !== 'listing_fact' && (
                        <span
                          className={`evidence-dot evidence-dot--${cell.evidence}`}
                          title={EVIDENCE_LABELS[cell.evidence]}
                        >
                          <span className="visually-hidden">
                            {' '}
                            ({EVIDENCE_LABELS[cell.evidence]})
                          </span>
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EquipmentTable({ comparison }: { comparison: ComparisonDto }) {
  if (comparison.equipment.length === 0) return null;
  return (
    <section className="page__section" aria-labelledby="equipment-title">
      <h2 id="equipment-title">Ausstattung laut Inserat</h2>
      <div className="table-scroll" tabIndex={0} role="region" aria-label="Ausstattung">
        <table className="compare-table compare-table--compact">
          <thead>
            <tr>
              <th scope="col">
                <span className="visually-hidden">Ausstattung</span>
              </th>
              {comparison.items.map((item) => (
                <th key={item.savedListingId} scope="col">
                  {item.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {comparison.equipment.map((row) => (
              <tr key={row.name}>
                <th scope="row">{row.name}</th>
                {row.presentIn.map((present, index) => (
                  <td key={index}>
                    {present ? (
                      <Check aria-label="genannt" size={18} />
                    ) : (
                      <Minus aria-label="nicht genannt" size={18} className="muted" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted">
        „Nicht genannt“ heißt nur, dass die Ausstattung im Inserat nicht erwähnt wird.
      </p>
    </section>
  );
}

export function ComparePage() {
  usePageMeta(META);
  const [params] = useSearchParams();
  const ids = [
    ...new Set(
      (params.get('ids') ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ].slice(0, 10);
  const me = useMe();
  const comparison = useComparison(me.data?.user ? ids : []);
  const [onlyDifferences, setOnlyDifferences] = useState(false);

  if (me.isPending) return <PageLoading />;
  if (!me.data?.user) {
    return (
      <div className="container page page--narrow">
        <h1>Angebote vergleichen</h1>
        <Alert
          tone="info"
          title="Zum Vergleichen brauchst du ein Konto"
          actions={
            <ButtonLink to="/anmelden" state={{ returnTo: '/meine-angebote' }}>
              Anmelden
            </ButtonLink>
          }
        >
          <p>Speichere Angebote in „Meine Angebote“ und vergleiche sie dort nebeneinander.</p>
        </Alert>
      </div>
    );
  }
  if (ids.length < 2) {
    return (
      <div className="container page page--narrow">
        <h1>Angebote vergleichen</h1>
        <Alert
          tone="info"
          title="Wähle mindestens zwei Angebote aus"
          actions={<ButtonLink to="/meine-angebote">Zu meinen Angeboten</ButtonLink>}
        />
      </div>
    );
  }

  return (
    <div className="container page">
      <div className="page__header">
        <div>
          <h1>Angebote vergleichen</h1>
          <p className="page__lead">
            Die Angaben aus den Inseraten nebeneinander – und eine Reihenfolge, die sich allein nach
            deinen Prioritäten richtet.
          </p>
        </div>
        <ButtonLink to="/meine-angebote" variant="secondary">
          Auswahl ändern
        </ButtonLink>
      </div>

      {comparison.isPending ? (
        <PageLoading />
      ) : comparison.isError ? (
        <Alert tone="error" title="Der Vergleich ist nicht möglich">
          <p>
            {comparison.error instanceof ApiRequestError
              ? comparison.error.message
              : 'Bitte versuche es erneut.'}
          </p>
        </Alert>
      ) : (
        <>
          <DecisionPanel comparison={comparison.data} />
          <h2 className="compare-table-title">Alle Angaben im Vergleich</h2>
          <label className="toggle">
            <input
              type="checkbox"
              checked={onlyDifferences}
              onChange={(event) => setOnlyDifferences(event.target.checked)}
            />
            Nur Unterschiede zeigen
          </label>
          <ComparisonTable comparison={comparison.data} onlyDifferences={onlyDifferences} />
          <p className="muted compare-legend">
            Markierungen wie „niedrigster Preis“ beschreiben nur die Zahlen. Werte mit Punkt sind
            berechnet oder eingeschätzt.
          </p>
          <EquipmentTable comparison={comparison.data} />
          {comparison.data.missingInformation.some((list) => list.length > 0) && (
            <section className="page__section" aria-labelledby="missing-title">
              <h2 id="missing-title">Fehlende Angaben</h2>
              <div className="missing-grid">
                {comparison.data.items.map((item, index) => (
                  <div key={item.savedListingId} className="missing-card">
                    <h3>{item.title}</h3>
                    {(comparison.data.missingInformation[index] ?? []).length === 0 ? (
                      <p className="muted">Alle wichtigen Angaben vorhanden.</p>
                    ) : (
                      <ul className="bullet-list">
                        {(comparison.data.missingInformation[index] ?? []).map((label) => (
                          <li key={label}>{label}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
          {comparison.data.notes.length > 0 && (
            <ul className="bullet-list muted">
              {comparison.data.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
