import {
  EMPTY_ANSWERS,
  isComplete,
  parseAdvisorParams,
  toAdvisorParams,
  type AdvisorAnswers,
} from '@kaufcheck/catalog';
import { KNOWLEDGE_IDS } from '@kaufcheck/catalog/knowledge';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { AdvisorResults } from '../features/advisor/AdvisorResults';
import { AdvisorWizard } from '../features/advisor/AdvisorWizard';
import { ADVISOR_AVAILABLE } from '../features/advisor/availability';
import { track } from '../lib/analytics';
import { useHydrated } from '../lib/use-hydrated';
import { STATIC_PAGE_META } from '../seo/pages';
import { usePageMeta } from '../seo/use-page-meta';

/** The decision mode: a few questions about needs, then suitable models and their searches. */
export function AdvisorPage() {
  const meta = STATIC_PAGE_META['/auto-berater'];
  usePageMeta(meta ?? { title: 'Auto-Berater | KaufCheck', description: '' });
  const hydrated = useHydrated();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState(false);
  // Prerendered without answers; answers in the address are read in the browser.
  const answers = useMemo(
    () => (hydrated ? parseAdvisorParams(params) : EMPTY_ANSWERS),
    [hydrated, params],
  );
  const showResults = isComplete(answers) && !editing;

  const complete = (next: AdvisorAnswers) => {
    track('car_search_started', { placement: 'advisor_answers' });
    setEditing(false);
    setParams(toAdvisorParams(next));
    window.scrollTo({ top: 0 });
  };

  return (
    <>
      <section className="page-hero">
        <div className="container container--narrow">
          <p className="eyebrow">Auto-Berater</p>
          <h1 className="page-hero__title">Welches Auto passt zu mir?</h1>
          <p className="page-hero__lead">
            Ein paar kurze Fragen – danach zeigt KaufCheck dir passende Modelle mit ihren Stärken
            und bekannten Schwachstellen und öffnet die Suche auf allen großen Börsen.
          </p>
          <p className="advisor-shortcut">
            Du weißt schon, was du willst? <Link to="/auto-finden">Direkt zur Suche</Link>
          </p>
        </div>
      </section>
      <section className="section">
        <div className="container container--narrow">
          {!ADVISOR_AVAILABLE ? (
            <div className="advisor-empty">
              <h2 className="section__title">Der Auto-Berater startet in Kürze</h2>
              <p>
                Er schlägt nur Modelle vor, die KaufCheck genau kennt – mit Stärken und bekannten
                Schwachstellen. Dafür recherchieren wir gerade die beliebtesten Gebrauchtwagen.
              </p>
              <div className="button-row">
                <Link to="/auto-finden" className="btn btn--primary btn--md">
                  <span>Direkt zur Suche</span>
                </Link>
                {KNOWLEDGE_IDS.length > 0 && (
                  <Link to="/modelle" className="btn btn--secondary btn--md">
                    <span>Modelle ansehen</span>
                  </Link>
                )}
              </div>
            </div>
          ) : showResults ? (
            <AdvisorResults answers={answers} onEdit={() => setEditing(true)} />
          ) : (
            <AdvisorWizard
              key={`${hydrated}-${params.toString()}`}
              initial={answers}
              onComplete={complete}
            />
          )}
          {ADVISOR_AVAILABLE && (
            <p className="advisor-coverage">
              KaufCheck kennt bisher {KNOWLEDGE_IDS.length} Modelle genauer – laufend kommen weitere
              dazu. <Link to="/modelle">Alle Modelle</Link>
            </p>
          )}
        </div>
      </section>
    </>
  );
}
