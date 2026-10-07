import { DEFAULT_ENTITLEMENTS } from '@kaufcheck/shared';
import { Search } from 'lucide-react';
import { Link } from 'react-router';
import { useConfig } from '../api/queries';
import { EvidenceLegend } from '../components/EvidenceBadge';
import { FeatureGrid, PlatformChips } from '../features/analysis/CheckContent';
import { ListingAnalysisForm } from '../features/analysis/ListingAnalysisForm';
import { STATIC_PAGE_META } from '../seo/pages';
import { usePageMeta } from '../seo/use-page-meta';

/** The listing check on its own page (the homepage shows it as its second tab). */
export function CheckListingPage() {
  const meta = STATIC_PAGE_META['/inserat-pruefen'];
  usePageMeta(meta ?? { title: 'Inserat prüfen | KaufCheck', description: '' });
  const config = useConfig();
  const plans = config.data?.plans ?? DEFAULT_ENTITLEMENTS;
  const retrieval = config.data?.features.urlRetrieval === true;

  return (
    <>
      <section className="hero">
        <div className="container hero__inner">
          <p className="eyebrow">Für Inserate von mobile.de, AutoScout24, Kleinanzeigen & Co.</p>
          <h1 className="hero__title">Gebrauchtwagen-Inserat prüfen</h1>
          <p className="hero__lead">
            {retrieval
              ? 'Füge den Link zu einem Auto-Inserat ein.'
              : 'Füge den Text eines Auto-Inserats ein.'}{' '}
            KaufCheck ordnet die Angaben, zeigt, was fehlt, und stellt dir die passenden Fragen für
            den Verkäufer zusammen.
          </p>
          <ListingAnalysisForm />
          <ul className="hero__facts">
            <li>Ohne Anmeldung</li>
            <li>{plans.anonymous.monthlyAnalyses} Prüfungen im Monat kostenlos</li>
            <li>Kontaktdaten werden entfernt</li>
          </ul>
          <PlatformChips titleId="check-platforms-title" />
        </div>
      </section>

      <section className="section" aria-labelledby="check-how-title">
        <div className="container">
          <h2 id="check-how-title" className="section__title">
            So funktioniert die Prüfung
          </h2>
          <ol className="steps">
            <li className="step">
              <span className="step__number" aria-hidden>
                1
              </span>
              <h3>Inserat einfügen</h3>
              <p>
                {retrieval
                  ? 'Link aus dem Browser oder der App kopieren – oder den Text des Inserats einfügen.'
                  : 'Den Text des Inserats kopieren und oben einfügen – am Smartphone im Browser über „Alles auswählen“.'}
              </p>
            </li>
            <li className="step">
              <span className="step__number" aria-hidden>
                2
              </span>
              <h3>Angaben prüfen lassen</h3>
              <p>
                KaufCheck liest die Details aus, rechnet nach und markiert Lücken und Widersprüche.
              </p>
            </li>
            <li className="step">
              <span className="step__number" aria-hidden>
                3
              </span>
              <h3>Gezielt nachfragen</h3>
              <p>
                Mit den Fragen und der Checkliste gehst du vorbereitet ins Gespräch und zur
                Besichtigung.
              </p>
            </li>
          </ol>
        </div>
      </section>

      <section className="section section--muted" aria-labelledby="check-features-title">
        <div className="container">
          <h2 id="check-features-title" className="section__title">
            Was du bekommst
          </h2>
          <FeatureGrid />
        </div>
      </section>

      <section className="section" aria-labelledby="evidence-title">
        <div className="container two-column">
          <div>
            <h2 id="evidence-title" className="section__title">
              Jede Aussage mit Herkunft
            </h2>
            <p className="section__lead">
              KaufCheck trennt klar zwischen dem, was im Inserat steht, was daraus berechnet wurde
              und was nur eine Einschätzung ist. So verwechselst du eine Vermutung nie mit einer
              Tatsache.
            </p>
          </div>
          <EvidenceLegend />
        </div>
      </section>

      <section className="section section--muted" aria-labelledby="limits-title">
        <div className="container two-column">
          <div>
            <h2 id="limits-title" className="section__title">
              Was KaufCheck nicht kann
            </h2>
            <p className="section__lead">
              Ehrlich gesagt: Ein Inserat verrät nicht alles über ein Auto.
            </p>
          </div>
          <ul className="check-list">
            <li>
              KaufCheck sieht das Auto nicht. Zustand, Unfallspuren und Technik zeigt nur die
              Besichtigung.
            </li>
            <li>
              Angaben im Inserat werden nicht überprüft – auch dann nicht, wenn sie plausibel
              wirken.
            </li>
            <li>
              Einen Marktpreis nennt KaufCheck nur, wenn genügend vergleichbare Inserate vorliegen.
            </li>
            <li>KaufCheck gibt keine Kaufempfehlung. Die Entscheidung triffst du.</li>
          </ul>
        </div>
      </section>

      <section className="section cta-band" aria-labelledby="find-cta-title">
        <div className="container container--narrow cta-band__inner">
          <h2 id="find-cta-title">Noch kein passendes Angebot?</h2>
          <p>Such mit einer Suche auf mobile.de, AutoScout24, Kleinanzeigen & Co.</p>
          <Link to="/auto-finden" className="btn btn--primary btn--lg">
            <Search aria-hidden size={20} />
            <span>Auto finden</span>
          </Link>
        </div>
      </section>
    </>
  );
}
