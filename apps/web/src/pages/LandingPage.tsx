import {
  ClipboardCheck,
  FileSearch,
  HelpCircle,
  ListChecks,
  MessageSquareText,
  Scale,
  ShieldCheck,
} from 'lucide-react';
import { useEffect } from 'react';
import { Link } from 'react-router';
import { EvidenceLegend } from '../components/EvidenceBadge';
import { UrlAnalysisForm } from '../features/analysis/UrlAnalysisForm';
import { track } from '../lib/analytics';
import { STATIC_PAGE_META } from '../seo/pages';
import { usePageMeta } from '../seo/use-page-meta';
import { useConfig } from '../api/queries';
import { DEFAULT_ENTITLEMENTS } from '@kaufcheck/shared';

const FEATURES = [
  {
    icon: FileSearch,
    title: 'Angaben geordnet',
    text: 'Kilometerstand, Erstzulassung, HU, Vorbesitzer, Scheckheft: Alles Wichtige auf einen Blick – mit Hinweis, woher jede Angabe stammt.',
  },
  {
    icon: HelpCircle,
    title: 'Lücken sichtbar',
    text: 'Was im Inserat fehlt, steht ausdrücklich als „Nicht angegeben“ da. So siehst du sofort, wonach du fragen musst.',
  },
  {
    icon: ShieldCheck,
    title: 'Auffälligkeiten mit Beleg',
    text: 'Widersprüche wie zwei verschiedene Kilometerstände oder erwähnte Schäden – immer mit der Stelle aus dem Inserat.',
  },
  {
    icon: MessageSquareText,
    title: 'Fragen an den Verkäufer',
    text: 'Passende Fragen in der Sie- oder Du-Form, fertig zum Kopieren oder als Nachricht für den Chat.',
  },
  {
    icon: ListChecks,
    title: 'Checkliste für die Besichtigung',
    text: 'Unterlagen, Karosserie, Innenraum und Probefahrt – zum Abhaken direkt auf dem Smartphone.',
  },
  {
    icon: Scale,
    title: 'Preis mit Augenmaß',
    text: 'Rechnungen wie Preis pro Jahr oder pro 10.000 km. Eine Marktpreis-Einschätzung gibt es nur mit genügend echten Vergleichsdaten.',
  },
];

const FAQ = [
  {
    question: 'Was kostet KaufCheck?',
    answer: (anonymous: number, free: number) =>
      `Ohne Anmeldung kannst du ${anonymous} Inserate im Monat prüfen, mit einem kostenlosen Konto ${free}. Für mehr Prüfungen, Verlauf und größere Vergleiche gibt es KaufCheck Pro.`,
  },
  {
    question: 'Welche Inserate kann ich prüfen?',
    answer: () =>
      'Derzeit Auto-Inserate von Kleinanzeigen. Du kannst den Link einfügen oder den Text des Inserats kopieren. Weitere Kategorien sind in Planung.',
  },
  {
    question: 'Warum klappt der Link manchmal nicht?',
    answer: () =>
      'KaufCheck ruft Inserate nur ab, wenn das technisch und rechtlich zulässig ist, und umgeht keine Schutzmaßnahmen. Wenn der Abruf nicht möglich ist, fügst du einfach den Inseratstext ein – die Prüfung ist dann genauso ausführlich.',
  },
  {
    question: 'Bewertet KaufCheck, ob das Auto gut ist?',
    answer: () =>
      'Nein. KaufCheck ordnet die Angaben aus dem Inserat, zeigt Lücken und Widersprüche und hilft dir bei den richtigen Fragen. Ob das Auto in Ordnung ist, zeigt erst die Besichtigung – im Zweifel mit einer Werkstatt oder einem Gutachter.',
  },
  {
    question: 'Was passiert mit meinen Daten?',
    answer: () =>
      'Telefonnummern und E-Mail-Adressen aus dem Inserat werden vor dem Speichern entfernt. Ohne Konto werden Prüfungen nach 90 Tagen gelöscht. Es gibt keine Werbe-Tracker; Details stehen in der Datenschutzerklärung.',
  },
  {
    question: 'Kontaktiert KaufCheck den Verkäufer?',
    answer: () =>
      'Nein. KaufCheck formuliert die Nachricht nur vor. Du entscheidest, ob und wie du sie im Chat auf Kleinanzeigen verschickst.',
  },
];

export function LandingPage() {
  const meta = STATIC_PAGE_META['/'];
  usePageMeta(meta ?? { title: 'KaufCheck', description: '' });
  const config = useConfig();
  const plans = config.data?.plans ?? DEFAULT_ENTITLEMENTS;

  useEffect(() => track('landing_page_view'), []);

  return (
    <>
      <section className="hero">
        <div className="container hero__inner">
          <p className="eyebrow">Für Auto-Inserate auf Kleinanzeigen</p>
          <h1 className="hero__title">
            Gebraucht kaufen.
            <br />
            Besser entscheiden.
          </h1>
          <p className="hero__lead">
            Füge den Link zu einem Auto-Inserat ein. KaufCheck ordnet die Angaben, zeigt, was fehlt,
            und stellt dir die passenden Fragen für den Verkäufer zusammen.
          </p>
          <UrlAnalysisForm />
          <ul className="hero__facts">
            <li>Ohne Anmeldung</li>
            <li>{plans.anonymous.monthlyAnalyses} Prüfungen im Monat kostenlos</li>
            <li>Kontaktdaten werden entfernt</li>
          </ul>
        </div>
      </section>

      <section className="section" aria-labelledby="how-title">
        <div className="container">
          <h2 id="how-title" className="section__title">
            So funktioniert’s
          </h2>
          <ol className="steps">
            <li className="step">
              <span className="step__number" aria-hidden>
                1
              </span>
              <h3>Inserat einfügen</h3>
              <p>
                Link aus dem Browser oder der App kopieren – oder den Text des Inserats einfügen.
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

      <section className="section section--muted" aria-labelledby="features-title">
        <div className="container">
          <h2 id="features-title" className="section__title">
            Was du bekommst
          </h2>
          <div className="feature-grid">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <article key={title} className="feature">
                <Icon className="feature__icon" aria-hidden size={24} />
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
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
            {FAQ.map((item) => (
              <details key={item.question} className="faq__item">
                <summary>{item.question}</summary>
                <p>{item.answer(plans.anonymous.monthlyAnalyses, plans.free.monthlyAnalyses)}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="section cta-band" aria-labelledby="cta-title">
        <div className="container container--narrow cta-band__inner">
          <h2 id="cta-title">Bereit für das nächste Inserat?</h2>
          <p>Link einfügen, Angaben prüfen, gezielt nachfragen.</p>
          <a
            href="#inserat-link"
            className="btn btn--primary btn--lg"
            onClick={() =>
              window.setTimeout(() => document.getElementById('inserat-link')?.focus(), 0)
            }
          >
            <span>Jetzt Inserat prüfen</span>
          </a>
        </div>
      </section>
    </>
  );
}
