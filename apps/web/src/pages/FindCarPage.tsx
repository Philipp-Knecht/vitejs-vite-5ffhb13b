import {
  buildPlatformLinks,
  EMPTY_SEARCH,
  isEmptySearch,
  makeById,
  modelById,
  parseSearchParams,
  requestedFields,
  SEARCH_PLATFORMS,
  toSearchParams,
  type SearchQuery,
} from '@kaufcheck/catalog';
import { KNOWLEDGE_IDS } from '@kaufcheck/catalog/knowledge';
import { ClipboardCheck } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ADVISOR_AVAILABLE } from '../features/advisor/availability';
import { ModelInsights } from '../features/search/ModelInsights';
import { PlatformResults } from '../features/search/PlatformResults';
import { describeSearch, isModelId } from '../features/search/describe-search';
import { SaveSearch } from '../features/search/SaveSearch';
import { SearchForm } from '../features/search/SearchForm';
import { track } from '../lib/analytics';
import { useHydrated } from '../lib/use-hydrated';
import { STATIC_PAGE_META } from '../seo/pages';
import { usePageMeta } from '../seo/use-page-meta';

const TIPS = [
  'Such auf mehreren Plattformen: Händler stellen ihre Autos oft überall ein, Privatleute meist nur auf einer.',
  'Filter nicht zu eng setzen – ein Jahr älter oder etwas mehr Kilometer bringen oft deutlich mehr Auswahl.',
  'Ein Preis weit unter allen anderen ist ein Warnzeichen: Frag nach dem Grund und zahl nie im Voraus.',
  'Kopiere interessante Inserate und lass sie hier prüfen – so siehst du Lücken, bevor du anrufst.',
];

export function FindCarPage() {
  const meta = STATIC_PAGE_META['/auto-finden'];
  usePageMeta(meta ?? { title: 'Auto finden | KaufCheck', description: '' });
  const hydrated = useHydrated();
  const [params, setParams] = useSearchParams();
  const results = useRef<HTMLElement>(null);
  // Prerendered without parameters; the search is read once the page runs in the browser.
  const query = useMemo(
    () => (hydrated ? parseSearchParams(params, isModelId) : EMPTY_SEARCH),
    [hydrated, params],
  );
  const searched = !isEmptySearch(query);
  const links = useMemo(
    () =>
      buildPlatformLinks(query, {
        make: makeById(query.makeId),
        model: modelById(query.modelId),
        modelText: query.modelText,
      }),
    [query],
  );
  const scrollToResults = useRef(false);

  useEffect(() => {
    if (!scrollToResults.current || !searched) return;
    scrollToResults.current = false;
    results.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    results.current?.focus({ preventScroll: true });
  }, [searched, query]);

  const search = (next: SearchQuery) => {
    track('car_search_started', { placement: 'search_page' });
    scrollToResults.current = true;
    setParams(toSearchParams(next));
  };

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <p className="eyebrow">Eine Suche für alle Börsen</p>
          <h1 className="page-hero__title">Gebrauchtwagen finden</h1>
          <p className="page-hero__lead">
            Gib deine Wünsche einmal ein – KaufCheck öffnet die passenden Treffer bei mobile.de,
            AutoScout24, Kleinanzeigen und {SEARCH_PLATFORMS.length - 3} weiteren Plattformen.
            {KNOWLEDGE_IDS.length > 0 &&
              ' Für viele beliebte Modelle siehst du dazu, worauf du achten musst.'}
          </p>
          <SearchForm
            key={`${hydrated}-${params.toString()}`}
            initial={query}
            onSearch={search}
            variant="full"
          />
          <p className="search-note">
            Die Angebote siehst du direkt auf den Plattformen – KaufCheck lädt ihre Seiten nicht
            selbst.
          </p>
          {ADVISOR_AVAILABLE && (
            <p className="search-note">
              Noch unsicher, welches Modell? <Link to="/auto-berater">Der Auto-Berater</Link>{' '}
              schlägt dir in zwei Minuten passende Autos vor.
            </p>
          )}
        </div>
      </section>

      {searched && (
        <section
          ref={results}
          tabIndex={-1}
          className="section search-results"
          aria-labelledby="results-title"
        >
          <div className="container">
            <h2 id="results-title" className="section__title">
              Deine Suche auf {links.length} Plattformen
            </h2>
            <p className="search-results__query">{describeSearch(query)}</p>
            <div className="save-search-row">
              <SaveSearch key={params.toString()} query={query} />
            </div>
            <PlatformResults links={links} requested={requestedFields(query)} />
          </div>
        </section>
      )}

      {searched && query.modelId && (
        <ModelInsights modelId={query.modelId} yearMin={query.yearMin} yearMax={query.yearMax} />
      )}

      <section className="section" aria-labelledby="check-title">
        <div className="container two-column">
          <div>
            <h2 id="check-title" className="section__title">
              Angebot gefunden? Lass es prüfen
            </h2>
            <p className="section__lead">
              Kopiere den Text des Inserats und füge ihn bei KaufCheck ein: Du siehst die Angaben
              geordnet, was fehlt, und bekommst passende Fragen an den Verkäufer.
            </p>
            <Link to="/inserat-pruefen" className="btn btn--primary btn--lg">
              <ClipboardCheck aria-hidden size={20} />
              <span>Inserat prüfen</span>
            </Link>
          </div>
          <div>
            <h3>Tipps für die Suche</h3>
            <ul className="check-list">
              {TIPS.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}
