import { Link } from 'react-router';
import { useConfig } from '../../api/queries';
import { Alert } from '../../components/ui/Alert';
import { STATIC_PAGE_META } from '../../seo/pages';
import { usePageMeta } from '../../seo/use-page-meta';
import { IMPRINT, IMPRINT_COMPLETE } from './site-info';

function Operator() {
  if (!IMPRINT_COMPLETE) {
    return (
      <Alert tone="warning" title="Angaben zum Betreiber fehlen">
        <p>
          Hier müssen Name, Anschrift und Kontakt des Betreibers stehen. Sie werden über die
          Umgebungsvariablen VITE_IMPRINT_NAME, VITE_IMPRINT_ADDRESS und VITE_CONTACT_EMAIL
          eingetragen.
        </p>
      </Alert>
    );
  }
  return (
    <address className="imprint">
      {IMPRINT.name}
      {IMPRINT.address.map((line) => (
        <span key={line}>
          <br />
          {line}
        </span>
      ))}
      <br />
      E-Mail: <a href={`mailto:${IMPRINT.email}`}>{IMPRINT.email}</a>
    </address>
  );
}

export function ImprintPage() {
  usePageMeta(
    STATIC_PAGE_META['/impressum'] ?? { title: 'Impressum', description: '', noindex: true },
  );
  return (
    <div className="container page page--narrow prose">
      <h1>Impressum</h1>
      <h2>Angaben gemäß § 5 DDG</h2>
      <Operator />
      <h2>Verantwortlich für den Inhalt</h2>
      <p>Verantwortlich für die redaktionellen Inhalte (Ratgeber) ist die oben genannte Person.</p>
      <h2>Hinweis zu Kleinanzeigen</h2>
      <p>
        KaufCheck ist ein unabhängiges Angebot und steht in keiner Verbindung zur Kleinanzeigen
        GmbH. „Kleinanzeigen“ ist eine Marke ihrer Inhaber.
      </p>
      <h2>Haftung für Inhalte</h2>
      <p>
        Die Auswertungen von KaufCheck beruhen auf den Angaben in den jeweiligen Inseraten und
        werden automatisch erstellt. Sie ersetzen weder eine Besichtigung noch eine technische
        Prüfung des Fahrzeugs. Für die Richtigkeit der Angaben in Inseraten sind die jeweiligen
        Verkäufer verantwortlich.
      </p>
    </div>
  );
}

const PRIVACY_POLICY_DATE = '1. Oktober 2026';
const AI_PROVIDER_NAMES = { anthropic: 'Anthropic', openai: 'OpenAI' } as const;

/**
 * The privacy policy follows the server configuration (`/api/config`):
 * sections for optional features appear only when they are active. Before
 * the configuration has loaded (prerendered HTML), optional features that
 * are off by default are left out and the analytics section is shown.
 */
export function PrivacyPage() {
  usePageMeta(
    STATIC_PAGE_META['/datenschutz'] ?? { title: 'Datenschutz', description: '', noindex: true },
  );
  const config = useConfig().data;
  const features = config?.features;
  const hosting = config?.privacy.hosting ?? null;
  const retentionDays = config?.privacy.anonymousRetentionDays ?? 90;
  const aiProvider = features?.aiProvider ? AI_PROVIDER_NAMES[features.aiProvider] : null;

  return (
    <div className="container page page--narrow prose">
      <h1>Datenschutzerklärung</h1>
      <p className="page__lead">Stand: {PRIVACY_POLICY_DATE}</p>

      <h2>Verantwortlicher</h2>
      <Operator />

      <h2>Grundsatz</h2>
      <p>
        KaufCheck verarbeitet nur die Daten, die für die Prüfung von Inseraten und für dein Konto
        nötig sind. Es gibt keine Werbe-Tracker, keine Profilbildung und keinen Verkauf von Daten.
        Du musst keine Angaben zu deiner Person machen, um Inserate zu prüfen.
      </p>

      <h2>Hosting</h2>
      {hosting === 'render' ? (
        <>
          <p>
            KaufCheck wird bei Render Services, Inc. (San Francisco, USA) betrieben. Server und
            Datenbank stehen in einem Rechenzentrum in Frankfurt am Main. Render setzt dafür weitere
            Dienstleister ein, darunter Amazon Web Services, Google Cloud und Cloudflare; über das
            Netzwerk von Cloudflare wird die Seite ausgeliefert und vor Angriffen geschützt.
          </p>
          <p>
            Beim Aufruf der Seite verarbeiten Render und diese Dienstleister technisch notwendige
            Verbindungsdaten wie deine IP-Adresse, den Zeitpunkt und die aufgerufene Adresse. Mit
            Render besteht ein Vertrag zur Auftragsverarbeitung (Art. 28 DSGVO). Render ist nach dem
            EU-US Data Privacy Framework zertifiziert; Übermittlungen in die USA stützen sich auf
            den Angemessenheitsbeschluss der EU-Kommission (Art. 45 DSGVO), ergänzend auf die
            EU-Standardvertragsklauseln (Art. 46 Abs. 2 lit. c DSGVO). Rechtsgrundlage ist unser
            berechtigtes Interesse an einer sicheren und zuverlässigen Bereitstellung (Art. 6 Abs. 1
            lit. f DSGVO).
          </p>
        </>
      ) : (
        <p>
          Beim Aufruf der Seite verarbeitet der Server technisch notwendige Verbindungsdaten wie
          deine IP-Adresse, den Zeitpunkt und die aufgerufene Adresse, um die Seite auszuliefern und
          vor Angriffen zu schützen. Rechtsgrundlage ist unser berechtigtes Interesse an einer
          sicheren und zuverlässigen Bereitstellung (Art. 6 Abs. 1 lit. f DSGVO).
        </p>
      )}

      <h2>Schutz vor Missbrauch</h2>
      <p>
        Damit niemand den Dienst überlastet, begrenzt unser Server die Zahl der Anfragen je
        IP-Adresse, zum Beispiel Prüfungen pro Minute und Anmeldeversuche. Dafür hält er deine
        IP-Adresse höchstens eine Stunde im Arbeitsspeicher; sie wird nicht gespeichert.
        Rechtsgrundlage ist unser berechtigtes Interesse an einem sicheren Betrieb (Art. 6 Abs. 1
        lit. f DSGVO).
      </p>

      <h2>Geprüfte Inserate</h2>
      <p>
        Wenn du ein Inserat prüfst, verarbeiten wir die Angaben daraus, zum Beispiel Titel, Preis,
        Standort, Fahrzeugdaten und Beschreibung. Einen Link zum Inserat speichern wir zur
        Zuordnung.
        {features?.urlRetrieval === true && (
          <>
            {' '}
            Fügst du nur einen Link ein, ruft KaufCheck die öffentliche Seite dieses einen Inserats
            ab (mehr dazu unter <Link to="/bot">KaufCheckBot</Link>).
          </>
        )}
        {features?.urlRetrieval === false && ' KaufCheck ruft den Link nicht ab.'}
      </p>
      <p>
        Telefonnummern, E-Mail-Adressen und Bankverbindungen werden vor dem Speichern automatisch
        entfernt. Aus den Angaben zum Anbieter übernehmen wir nur, ob privat oder gewerblich
        verkauft wird und seit wann das Konto besteht, nicht den Namen.
      </p>
      <p>
        Prüfungen ohne Konto löschen wir nach {retentionDays} Tagen, Prüfungen mit Konto bewahren
        wir bis zur Löschung des Kontos auf. Eine Ergebnisseite kann öffnen, wer ihren Link kennt;
        für Suchmaschinen sind Ergebnisseiten gesperrt.
      </p>
      <p>
        Rechtsgrundlage ist die Bereitstellung des von dir angefragten Dienstes (Art. 6 Abs. 1 lit.
        b DSGVO). Soweit ein Inserat Angaben zum Verkäufer enthält, etwa den Standort, ist
        Rechtsgrundlage das berechtigte Interesse, ein öffentlich angebotenes Fahrzeug vor dem Kauf
        zu prüfen (Art. 6 Abs. 1 lit. f DSGVO).
      </p>

      <h2>Konto</h2>
      <p>
        Ein Konto ist freiwillig. Dafür speichern wir deine E-Mail-Adresse und einen Hash deines
        Passworts (nicht das Passwort selbst), dazu deine gespeicherten Angebote und Prüfungen. Ohne
        E-Mail-Adresse und Passwort kann kein Konto angelegt werden. Du kannst dein Konto jederzeit
        selbst in den Kontoeinstellungen löschen; dabei werden alle zugehörigen Daten entfernt.
        {features?.passwordReset === true &&
          ' Wenn du dein Passwort zurücksetzt, schicken wir dir eine E-Mail über unseren E-Mail-Anbieter.'}{' '}
        Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.
      </p>

      <h2>Cookies und lokaler Speicher</h2>
      <ul>
        <li>
          <strong>kc_anon</strong> – eine zufällige Kennung ohne Bezug zu Name oder Kontaktdaten.
          Sie wird erst gesetzt, wenn du eine Prüfung startest, und dient dazu, das kostenlose
          Kontingent einzuhalten: Wir zählen, wie viele Prüfungen im Monat mit dieser Kennung
          gestartet wurden. Speicherdauer bis zu 400 Tage.
        </li>
        <li>
          <strong>kc_session</strong> – hält dich nach der Anmeldung angemeldet. Speicherdauer 30
          Tage, verlängert sich bei Nutzung.
        </li>
        <li>
          Im lokalen Speicher deines Browsers merkt sich KaufCheck den Fortschritt deiner
          Checklisten und die gewählte Anrede (Sie/du). Diese Daten verlassen deinen Browser nicht.
        </li>
      </ul>
      <p>
        Beide Cookies sind für den von dir angefragten Dienst unbedingt erforderlich (§ 25 Abs. 2
        Nr. 2 TDDDG); eine Einwilligung ist dafür nicht nötig. Die Monatszähler löschen wir nach
        spätestens 400 Tagen.
      </p>

      {features?.analytics !== false && (
        <>
          <h2>Nutzungsstatistik</h2>
          <p>
            Um KaufCheck zu verbessern, zählen wir einzelne Ereignisse, etwa „Prüfung gestartet“
            oder „Fragen kopiert“. Gespeichert werden nur der Name des Ereignisses, wenige feste
            Merkmale (zum Beispiel die Art der Eingabe) und der Zeitpunkt – ohne Kennungen,
            IP-Adressen oder Cookies. Sendet dein Browser „Do Not Track“ oder „Global Privacy
            Control“, zählen wir nichts. Die Ereignisse löschen wir nach spätestens 400 Tagen.
            Rechtsgrundlage ist unser berechtigtes Interesse an einem funktionierenden Angebot (Art.
            6 Abs. 1 lit. f DSGVO).
          </p>
        </>
      )}

      {features?.urlRetrieval === true && features.listingPhotos && (
        <>
          <h2>Fotos aus Inseraten</h2>
          <p>
            Fotos werden direkt von den Bildservern von Kleinanzeigen in deinen Browser geladen.
            Dabei erhält der Bildserver technisch bedingt deine IP-Adresse; die Adresse der
            KaufCheck-Seite wird nicht übermittelt.
          </p>
        </>
      )}

      {aiProvider && (
        <>
          <h2>KI-Einschätzung</h2>
          <p>
            Für die KI-Einschätzung übermitteln wir den Inseratstext ohne Kontaktdaten
            {features?.photoAnalysis
              ? ' und – bei der Fotoanalyse – einige Fotos des Inserats'
              : ''}{' '}
            an den KI-Anbieter {aiProvider}. Angaben zu deiner Person werden dabei nicht
            übermittelt. Der Anbieter kann die Daten außerhalb der EU verarbeiten; die Übermittlung
            erfolgt auf Grundlage geeigneter Garantien wie der EU-Standardvertragsklauseln (Art. 46
            Abs. 2 lit. c DSGVO). Rechtsgrundlage ist die Bereitstellung des angefragten Dienstes
            (Art. 6 Abs. 1 lit. b DSGVO).
          </p>
        </>
      )}

      {features?.billing === true && (
        <>
          <h2>Bezahlung</h2>
          <p>
            Wenn du KaufCheck Pro buchst, wickelt der Zahlungsdienstleister Stripe die Zahlung ab.
            Deine Zahlungsdaten gibst du direkt bei Stripe ein; wir erhalten nur den Status deines
            Abos. Rechtsgrundlage ist die Erfüllung des Vertrags (Art. 6 Abs. 1 lit. b DSGVO).
          </p>
        </>
      )}

      <h2>Server-Protokolle</h2>
      <p>
        Unser Server protokolliert technische Abläufe wie aufgerufene Pfade, Statuscodes und Fehler,
        ohne IP-Adressen, Cookies und Inhalte von Inseraten.
        {hosting === 'render' &&
          ' Die Protokolle liegen bei Render und werden je nach Tarif nach 7 bis 30 Tagen gelöscht.'}
      </p>

      <h2>Keine automatisierten Entscheidungen</h2>
      <p>
        KaufCheck wertet Inserate automatisch aus. Das betrifft Fahrzeuge und Angebote, nicht dich:
        Es gibt weder Profiling noch automatisierte Entscheidungen im Sinne von Art. 22 DSGVO.
      </p>

      <h2>Deine Rechte</h2>
      <p>
        Du hast das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16 DSGVO), Löschung (Art.
        17 DSGVO), Einschränkung der Verarbeitung (Art. 18 DSGVO) und Datenübertragbarkeit (Art. 20
        DSGVO). Verarbeitungen, die auf unserem berechtigten Interesse beruhen, kannst du
        widersprechen (Art. 21 DSGVO). Außerdem kannst du dich bei einer
        Datenschutz-Aufsichtsbehörde beschweren, zum Beispiel an deinem Wohnort. Für Anfragen
        erreichst du uns über die Angaben im <Link to="/impressum">Impressum</Link>.
      </p>

      <h2>Änderungen</h2>
      <p>
        Wir passen diese Erklärung an, wenn sich KaufCheck oder die Rechtslage ändert. Es gilt die
        hier veröffentlichte Fassung.
      </p>
    </div>
  );
}

export function BotPage() {
  usePageMeta(
    STATIC_PAGE_META['/bot'] ?? { title: 'KaufCheckBot', description: '', noindex: true },
  );
  return (
    <div className="container page page--narrow prose">
      <h1>KaufCheckBot</h1>
      <p className="page__lead">
        Informationen für Betreiber von Websites, deren Seiten KaufCheck abruft.
      </p>

      <h2>Was der Bot tut</h2>
      <ul>
        <li>
          Er ruft ausschließlich einzelne Inseratsseiten ab, deren Link eine Person bei KaufCheck
          ausdrücklich eingegeben hat. Er folgt keinen Links und durchsucht keine Websites.
        </li>
        <li>
          Er identifiziert sich mit dem User-Agent <code>KaufCheckBot/1.0</code> und einem Link auf
          diese Seite.
        </li>
        <li>
          Er beachtet die robots.txt. Ist sie nicht erreichbar, ruft er vorsorglich nichts ab.
        </li>
        <li>
          Er umgeht keine Schutzmaßnahmen: keine Anmeldung, keine CAPTCHA-Lösung, keine wechselnden
          IP-Adressen und keine Wiederholungen nach einer Sperre. Bei einer Sperre wird die Person
          gebeten, den Inseratstext selbst einzufügen.
        </li>
        <li>
          Abrufe werden begrenzt und kurzzeitig zwischengespeichert, damit dieselbe Seite nicht
          mehrfach geladen wird.
        </li>
      </ul>

      <h2>Bot ausschließen</h2>
      <p>
        Wenn du nicht möchtest, dass KaufCheckBot deine Seiten abruft, ergänze deine robots.txt:
      </p>
      <pre className="code-block">
        <code>{'User-agent: KaufCheckBot\nDisallow: /'}</code>
      </pre>

      <h2>Kontakt</h2>
      {IMPRINT.email ? (
        <p>
          Fragen oder Probleme? Schreib uns an{' '}
          <a href={`mailto:${IMPRINT.email}`}>{IMPRINT.email}</a>.
        </p>
      ) : (
        <p>
          Die Kontaktdaten findest du im <Link to="/impressum">Impressum</Link>.
        </p>
      )}
    </div>
  );
}
