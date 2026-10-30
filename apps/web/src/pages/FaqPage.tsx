import { KNOWLEDGE_IDS } from '@kaufcheck/catalog/knowledge';
import { DEFAULT_ENTITLEMENTS } from '@kaufcheck/shared';
import { useHydratedConfig } from '../api/queries';
import { PLATFORM_LIST } from '../features/analysis/check-content';
import { CHAT_RETENTION_DAYS } from '../features/chat/chat-store';
import { STATIC_PAGE_META } from '../seo/pages';
import { usePageMeta } from '../seo/use-page-meta';

interface FaqContext {
  anonymous: number;
  free: number;
  /** Messages a day to the assistant without Pro; null when it is off. */
  chatDaily: number | null;
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
    answer: ({ anonymous, free, chatDaily }) =>
      `Die Suche ist kostenlos. Ohne Anmeldung kannst du ${anonymous} Inserate im Monat prüfen, mit einem kostenlosen Konto ${free}.${
        chatDaily !== null
          ? ` Dem Assistenten kannst du ${chatDaily} Nachrichten am Tag schicken.`
          : ''
      } Für mehr Prüfungen, Verlauf und größere Vergleiche gibt es KaufCheck Pro.`,
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
      'Das Auto nicht, aber den Preis: Wenn genug vergleichbare Inserate bei KaufCheck geprüft wurden, zeigt der Preis-Check im Vergleich mit ihnen, ob der Preis gut, fair oder hoch ist und ob sich Verhandeln lohnt – eine Einordnung, keine repräsentative Marktanalyse. Dazu ordnet KaufCheck die Angaben aus dem Inserat, zeigt Lücken und Widersprüche und hilft dir bei den richtigen Fragen. Ob das Auto in Ordnung ist, zeigt erst die Besichtigung – im Zweifel mit einer Werkstatt oder einem Gutachter.',
  },
  {
    question: 'Was passiert mit meinen Daten?',
    answer: ({ ads, retentionDays, chatDaily }) =>
      `Telefonnummern und E-Mail-Adressen aus dem Inserat werden vor dem Speichern entfernt. Ohne Konto werden Prüfungen nach ${retentionDays} Tagen gelöscht.${
        chatDaily !== null
          ? ` Nachrichten an den Assistenten gehen an den KI-Anbieter; deine Chats speichert nur dein Browser auf diesem Gerät, höchstens ${CHAT_RETENTION_DAYS} Tage.`
          : ''
      } ${
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

export function FaqPage() {
  usePageMeta(STATIC_PAGE_META['/haeufige-fragen'] ?? { title: 'Häufige Fragen', description: '' });
  const config = useHydratedConfig();
  const plans = config?.plans ?? DEFAULT_ENTITLEMENTS;
  // Until the configuration has loaded, assume the default: no automatic retrieval.
  const retrieval = config?.features.urlRetrieval === true;
  const chat = config?.features.chat ?? null;
  const faq = FAQ.filter((item) =>
    item.when === 'knowledge'
      ? KNOWLEDGE_IDS.length > 0
      : !item.when || item.when === (retrieval ? 'retrieval' : 'no-retrieval'),
  );

  return (
    <div className="container page page--narrow">
      <h1>Häufige Fragen</h1>
      <div className="faq">
        {faq.map((item) => (
          <details key={item.question} className="faq__item">
            <summary>{item.question}</summary>
            <p>
              {item.answer({
                anonymous: plans.anonymous.monthlyAnalyses,
                free: plans.free.monthlyAnalyses,
                chatDaily: chat?.dailyFree ?? null,
                retrieval,
                ads: config?.ads != null,
                retentionDays: config?.privacy.anonymousRetentionDays ?? 90,
              })}
            </p>
          </details>
        ))}
      </div>
    </div>
  );
}
