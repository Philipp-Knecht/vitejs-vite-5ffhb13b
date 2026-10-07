import { EMPTY_SEARCH, toSearchParams } from '@kaufcheck/catalog';
import { KNOWLEDGE_IDS } from '@kaufcheck/catalog/knowledge';
import { DEFAULT_ENTITLEMENTS } from '@kaufcheck/shared';
import { ClipboardCheck, FileSearch, ListChecks, Scale, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useConfig } from '../api/queries';
import { ADVISOR_AVAILABLE } from '../features/advisor/availability';
import { PLATFORM_LIST } from '../features/analysis/check-content';
import { FeatureGrid, PlatformChips } from '../features/analysis/CheckContent';
import { ListingAnalysisForm } from '../features/analysis/ListingAnalysisForm';
import { SearchForm } from '../features/search/SearchForm';
import { track } from '../lib/analytics';
import { cn } from '../lib/format';
import { readJson, writeJson } from '../lib/storage';
import { useHydrated } from '../lib/use-hydrated';
import { STATIC_PAGE_META } from '../seo/pages';
import { usePageMeta } from '../seo/use-page-meta';

interface FaqContext {
  anonymous: number;
  free: number;
  retrieval: boolean;
  ads: boolean;
  retentionDays: number;
}

interface FaqItem {
  question: string;
  answer: (context: FaqContext) => string;
  /** Shown only with (or without) automatic retrieval of listing links, or with model knowledge. */
  when?: 'retrieval' | 'no-retrieval' | 'knowledge';
}

const FAQ: FaqItem[] = [
  {
    question: 'Was kostet KaufCheck?',
    answer: ({ anonymous, free }) =>
      `Die Suche ist kostenlos. Ohne Anmeldung kannst du ${anonymous} Inserate im Monat prüfen, mit einem kostenlosen Konto ${free}. Für mehr Prüfungen, Verlauf und größere Vergleiche gibt es KaufCheck Pro.`,
  },
  {
    question: 'Durchsucht KaufCheck die Plattformen selbst?',
    answer: () =>
      'Nein. KaufCheck baut aus deinen Wünschen die passende Suche für jede Plattform – die Angebote siehst du direkt bei mobile.de, AutoScout24, Kleinanzeigen & Co. Selbst abrufen und anzeigen dürfen wir sie nicht: Die Plattformen erlauben das nur mit ihrer Zustimmung, und daran halten wir uns.',
  },
  {
    question: 'Welche Inserate kann ich prüfen?',
    answer: ({ retrieval }) =>
      `Auto-Inserate von ${PLATFORM_LIST} – und von jeder anderen Seite, deren Text du kopieren kannst. ${
        retrieval
          ? 'Bei Kleinanzeigen reicht der Link, sonst fügst du den Text des Inserats ein.'
          : 'Kopiere den Text des Inserats und füge ihn ein.'
      } Motorräder, Wohnmobile und Nutzfahrzeuge prüft KaufCheck noch nicht.`,
  },
  {
    question: 'Warum reicht der Link nicht?',
    when: 'no-retrieval',
    answer: () =>
      'Die Nutzungsbedingungen von mobile.de, AutoScout24, Kleinanzeigen, eBay und den anderen Plattformen erlauben das automatische Auslesen von Inseraten nicht ohne ausdrückliche Zustimmung. KaufCheck hält sich daran und ruft Inserate deshalb nicht selbst ab. Mit dem kopierten Inseratstext ist die Prüfung genauso ausführlich; den Link kannst du zur Zuordnung dazu speichern.',
  },
  {
    question: 'Warum klappt der Link manchmal nicht?',
    when: 'retrieval',
    answer: () =>
      'KaufCheck ruft Inserate nur ab, wenn das technisch und rechtlich zulässig ist, und umgeht keine Schutzmaßnahmen. Wenn der Abruf nicht möglich ist, fügst du einfach den Inseratstext ein – die Prüfung ist dann genauso ausführlich.',
  },
  {
    question: 'Woher stammt das Wissen über die Modelle?',
    when: 'knowledge',
    answer: () =>
      'Aus ADAC-Pannenstatistik, TÜV-Report, Rückrufen und Fachpresse – bei jeder Schwachstelle steht die Quelle. Nicht jedes Auto ist betroffen; was am Auto vor dir los ist, zeigt erst die Besichtigung.',
  },
  {
    question: 'Bewertet KaufCheck, ob das Auto gut ist?',
    answer: () =>
      'Nein. KaufCheck ordnet die Angaben aus dem Inserat, zeigt Lücken und Widersprüche und hilft dir bei den richtigen Fragen. Ob das Auto in Ordnung ist, zeigt erst die Besichtigung – im Zweifel mit einer Werkstatt oder einem Gutachter.',
  },
  {
    question: 'Was passiert mit meinen Daten?',
    answer: ({ ads, retentionDays }) =>
      `Telefonnummern und E-Mail-Adressen aus dem Inserat werden vor dem Speichern entfernt. Ohne Konto werden Prüfungen nach ${retentionDays} Tagen gelöscht. ${
        ads
          ? 'Werbung von Google zeigen wir nur mit deiner Einwilligung, mit KaufCheck Pro gar nicht'
          : 'Es gibt keine Werbe-Tracker'
      }; Details stehen in der Datenschutzerklärung.`,
  },
  {
    question: 'Kontaktiert KaufCheck den Verkäufer?',
    answer: () =>
      'Nein. KaufCheck formuliert die Nachricht nur vor. Du entscheidest, ob und wie du sie im Chat der jeweiligen Plattform verschickst.',
  },
];

type HomeTab = 'finden' | 'pruefen';
const TABS: readonly { id: HomeTab; label: string; icon: typeof Search }[] = [
  { id: 'finden', label: 'Auto finden', icon: Search },
  { id: 'pruefen', label: 'Inserat prüfen', icon: ClipboardCheck },
];
const TAB_STORAGE_KEY = 'kaufcheck:startseite-reiter';
const isHomeTab = (value: unknown): value is HomeTab => value === 'finden' || value === 'pruefen';

/** The tab asked for in the address (#pruefen) or chosen last in this browser. */
function preferredTab(): HomeTab | null {
  const fromHash = window.location.hash.slice(1);
  return isHomeTab(fromHash) ? fromHash : readJson(TAB_STORAGE_KEY, null, isHomeTab);
}

/** Search first; the preference is applied once the prerendered page runs in the browser. */
function useHomeTab(): [HomeTab, (tab: HomeTab) => void] {
  const hydrated = useHydrated();
  const [chosen, setChosen] = useState<HomeTab | null>(null);
  const preferred = useMemo(() => (hydrated ? preferredTab() : null), [hydrated]);
  const choose = (next: HomeTab) => {
    setChosen(next);
    writeJson(TAB_STORAGE_KEY, next);
  };
  return [chosen ?? preferred ?? 'finden', choose];
}

export function LandingPage() {
  const meta = STATIC_PAGE_META['/'];
  usePageMeta(meta ?? { title: 'KaufCheck', description: '' });
  const config = useConfig();
  const navigate = useNavigate();
  const plans = config.data?.plans ?? DEFAULT_ENTITLEMENTS;
  // Until the configuration has loaded, assume the default: no automatic retrieval.
  const retrieval = config.data?.features.urlRetrieval === true;
  const faq = FAQ.filter((item) =>
    item.when === 'knowledge'
      ? KNOWLEDGE_IDS.length > 0
      : !item.when || item.when === (retrieval ? 'retrieval' : 'no-retrieval'),
  );
  const [tab, setTab] = useHomeTab();
  const tabRefs = useRef<Record<HomeTab, HTMLButtonElement | null>>({
    finden: null,
    pruefen: null,
  });

  useEffect(() => track('landing_page_view'), []);

  const selectTab = (next: HomeTab, focus = false) => {
    setTab(next);
    if (focus) tabRefs.current[next]?.focus();
  };

  // Arrow keys move between the tabs (WAI-ARIA tabs pattern).
  const onTabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = TABS.findIndex((item) => item.id === tab);
    const next =
      event.key === 'Home'
        ? TABS[0]
        : event.key === 'End'
          ? TABS[TABS.length - 1]
          : TABS[(index + (event.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
    if (next) selectTab(next.id, true);
  };

  return (
    <>
      <section className="hero">
        <div className="container hero__inner">
          <p className="eyebrow">Für mobile.de, AutoScout24, Kleinanzeigen & Co.</p>
          <h1 className="hero__title">
            Gebrauchtwagen finden.
            <br />
            Prüfen. Besser entscheiden.
          </h1>
          <p className="hero__lead">
            Eine Suche für alle großen Börsen – und jedes Angebot geprüft, bevor du anrufst.
          </p>

          <div className="home-tabs">
            <div
              className="home-tabs__list"
              role="tablist"
              aria-label="Was möchtest du tun?"
              onKeyDown={onTabKeyDown}
            >
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  ref={(element) => {
                    tabRefs.current[id] = element;
                  }}
                  type="button"
                  role="tab"
                  id={`tab-${id}`}
                  aria-selected={tab === id}
                  aria-controls={`panel-${id}`}
                  tabIndex={tab === id ? 0 : -1}
                  className={cn('home-tabs__tab', tab === id && 'is-active')}
                  onClick={() => selectTab(id)}
                >
                  <Icon aria-hidden size={18} />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            <div
              role="tabpanel"
              id="panel-finden"
              aria-labelledby="tab-finden"
              className="home-tabs__panel"
              hidden={tab !== 'finden'}
            >
              <SearchForm
                variant="compact"
                initial={EMPTY_SEARCH}
                onSearch={(query) => {
                  track('car_search_started', { placement: 'home' });
                  void navigate(`/auto-finden?${toSearchParams(query).toString()}`);
                }}
              />
              <p className="home-tabs__more">
                <Link to="/auto-finden">Mehr Filter</Link>
                {ADVISOR_AVAILABLE && (
                  <>
                    <span aria-hidden>·</span>
                    <span>
                      Noch unsicher, welches Auto?{' '}
                      <Link to="/auto-berater">Auto-Berater (2 Min.)</Link>
                    </span>
                  </>
                )}
                <span aria-hidden>·</span>
                <span>
                  Schon ein Auto gefunden?{' '}
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => selectTab('pruefen', true)}
                  >
                    Lass es hier checken
                  </button>
                </span>
              </p>
            </div>

            <div
              role="tabpanel"
              id="panel-pruefen"
              aria-labelledby="tab-pruefen"
              className="home-tabs__panel"
              hidden={tab !== 'pruefen'}
            >
              <p className="home-tabs__intro">
                {retrieval
                  ? 'Füge den Link oder Text eines Auto-Inserats ein.'
                  : 'Füge den Text eines Auto-Inserats ein.'}{' '}
                KaufCheck ordnet die Angaben, zeigt, was fehlt, und stellt dir die passenden Fragen
                für den Verkäufer zusammen.
              </p>
              <ListingAnalysisForm />
              <ul className="hero__facts">
                <li>Ohne Anmeldung</li>
                <li>{plans.anonymous.monthlyAnalyses} Prüfungen im Monat kostenlos</li>
                <li>Kontaktdaten werden entfernt</li>
              </ul>
            </div>
          </div>

          <PlatformChips titleId="platforms-title" />
        </div>
      </section>

      <section className="section" aria-labelledby="how-title">
        <div className="container">
          <h2 id="how-title" className="section__title">
            Vom ersten Suchen bis zur Besichtigung
          </h2>
          <ol className="steps">
            <li className="step">
              <span className="step__number" aria-hidden>
                1
              </span>
              <h3>Finden</h3>
              <p>
                Eine Suche für alle großen Börsen – deine Filter gehen direkt an mobile.de,
                AutoScout24 & Co.
                {KNOWLEDGE_IDS.length > 0 &&
                  ' Für viele Modelle dazu die bekannten Schwachstellen mit Quelle.'}
              </p>
              <Link to="/auto-finden" className="step__link">
                Auto finden
              </Link>
              {ADVISOR_AVAILABLE && (
                <>
                  {' · '}
                  <Link to="/auto-berater" className="step__link">
                    Auto-Berater
                  </Link>
                </>
              )}
            </li>
            <li className="step">
              <span className="step__number" aria-hidden>
                2
              </span>
              <h3>Prüfen</h3>
              <p>
                Inserat einfügen: Angaben geordnet, Lücken und Widersprüche sichtbar, Fragen an den
                Verkäufer fertig formuliert.
              </p>
              <Link to="/inserat-pruefen" className="step__link">
                Inserat prüfen
              </Link>
            </li>
            <li className="step">
              <span className="step__number" aria-hidden>
                3
              </span>
              <h3>Entscheiden</h3>
              <p>
                Angebote speichern, nebeneinander vergleichen und mit der Checkliste vorbereitet zur
                Besichtigung gehen.
              </p>
              <Link to="/meine-angebote" className="step__link">
                Meine Angebote
              </Link>
            </li>
          </ol>
        </div>
      </section>

      <section className="section section--muted" aria-labelledby="features-title">
        <div className="container">
          <h2 id="features-title" className="section__title">
            Was die Prüfung zeigt
          </h2>
          <FeatureGrid />
        </div>
      </section>

      <section className="section" aria-labelledby="guides-title">
        <div className="container">
          <h2 id="guides-title" className="section__title">
            Ratgeber für den Gebrauchtwagenkauf
          </h2>
          <div className="guide-cards">
            <Link to="/gebrauchtwagen-kaufen" className="guide-card">
              <ClipboardCheck aria-hidden size={22} />
              <span className="guide-card__title">Gebrauchtwagen privat kaufen</span>
              <span className="guide-card__text">
                Vom Budget bis zum Kaufvertrag – und woran du Betrugsmaschen erkennst.
              </span>
            </Link>
            <Link to="/gebrauchtwagen-checkliste" className="guide-card">
              <ListChecks aria-hidden size={22} />
              <span className="guide-card__title">Checkliste zum Abhaken</span>
              <span className="guide-card__text">
                Unterlagen, Technik, Probefahrt und Vertrag in einer Liste.
              </span>
            </Link>
            <Link to="/auto-besichtigung-checkliste" className="guide-card">
              <FileSearch aria-hidden size={22} />
              <span className="guide-card__title">Auto richtig besichtigen</span>
              <span className="guide-card__text">
                Lack, Rost, Motor, Reifen und eine aussagekräftige Probefahrt.
              </span>
            </Link>
          </div>
        </div>
      </section>

      <section className="section section--muted" aria-labelledby="faq-title">
        <div className="container container--narrow">
          <h2 id="faq-title" className="section__title">
            Häufige Fragen
          </h2>
          <div className="faq">
            {faq.map((item) => (
              <details key={item.question} className="faq__item">
                <summary>{item.question}</summary>
                <p>
                  {item.answer({
                    anonymous: plans.anonymous.monthlyAnalyses,
                    free: plans.free.monthlyAnalyses,
                    retrieval,
                    ads: config.data?.ads != null,
                    retentionDays: config.data?.privacy.anonymousRetentionDays ?? 90,
                  })}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="section cta-band" aria-labelledby="cta-title">
        <div className="container container--narrow cta-band__inner">
          <h2 id="cta-title">Bereit für die Suche?</h2>
          <p>Wünsche eingeben, Angebote auf allen Börsen ansehen, das beste prüfen lassen.</p>
          <div className="cta-band__actions">
            <Link to="/auto-finden" className="btn btn--primary btn--lg">
              <Search aria-hidden size={20} />
              <span>Auto finden</span>
            </Link>
            <Link to="/inserat-pruefen" className="btn btn--secondary btn--lg">
              <Scale aria-hidden size={20} />
              <span>Inserat prüfen</span>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
