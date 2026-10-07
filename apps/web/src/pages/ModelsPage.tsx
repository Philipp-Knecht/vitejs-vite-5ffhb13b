import { makeById, MODELS, SEGMENT_LABELS } from '@kaufcheck/catalog';
import { KNOWLEDGE_IDS } from '@kaufcheck/catalog/knowledge';
import { Link } from 'react-router';
import { STATIC_PAGE_META } from '../seo/pages';
import { usePageMeta } from '../seo/use-page-meta';

/** Researched models grouped by make, in the order of the catalog. */
function modelsByMake() {
  const groups = new Map<string, { make: string; models: typeof MODELS }>();
  for (const model of MODELS) {
    if (!KNOWLEDGE_IDS.includes(model.id)) continue;
    const make = makeById(model.makeId)?.name ?? model.makeId;
    const group = groups.get(model.makeId) ?? { make, models: [] };
    groups.set(model.makeId, { make, models: [...group.models, model] });
  }
  return [...groups.entries()]
    .map(([makeId, group]) => ({ makeId, ...group }))
    .sort((a, b) => a.make.localeCompare(b.make, 'de'));
}

/** Overview of all model pages. */
export function ModelsPage() {
  const meta = STATIC_PAGE_META['/modelle'];
  usePageMeta(meta ?? { title: 'Modelle | KaufCheck', description: '' });
  const groups = modelsByMake();

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <p className="eyebrow">Modellwissen</p>
          <h1 className="page-hero__title">Gebrauchtwagen-Modelle im Überblick</h1>
          <p className="page-hero__lead">
            Bekannte Schwachstellen je Generation mit Quelle, empfehlenswerte Motoren und Tipps für
            die Besichtigung – für {KNOWLEDGE_IDS.length}{' '}
            {KNOWLEDGE_IDS.length === 1 ? 'Modell' : 'Modelle'}. Laufend kommen weitere dazu.
          </p>
        </div>
      </section>
      <section className="section">
        <div className="container">
          {groups.length === 0 ? (
            <p>
              Hier entstehen gerade Seiten zu beliebten Modellen. Bis dahin hilft dir die{' '}
              <Link to="/auto-finden">Suche auf allen Börsen</Link>.
            </p>
          ) : (
            <div className="model-directory">
              {groups.map((group) => (
                <section key={group.makeId} aria-labelledby={`make-${group.makeId}`}>
                  <h2 id={`make-${group.makeId}`} className="model-directory__make">
                    {group.make}
                  </h2>
                  <ul className="model-directory__list">
                    {group.models.map((model) => (
                      <li key={model.id}>
                        <Link to={`/modelle/${model.id}`}>
                          {group.make} {model.model}
                        </Link>{' '}
                        <span className="model-directory__segment">
                          {SEGMENT_LABELS[model.segment]}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
