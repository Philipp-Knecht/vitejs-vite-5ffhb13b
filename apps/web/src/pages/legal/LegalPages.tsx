import { Link } from 'react-router';
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

export function PrivacyPage() {
  usePageMeta(
    STATIC_PAGE_META['/datenschutz'] ?? { title: 'Datenschutz', description: '', noindex: true },
  );
  return (
    <div className="container page page--narrow prose">
      <h1>Datenschutzerklärung</h1>
      <Alert tone="info" title="Vorlage">
        <p>
          Diese Erklärung beschreibt, wie die KaufCheck-Software Daten verarbeitet. Betreiber müssen
          sie vor dem Livegang an ihren tatsächlichen Betrieb (Hosting, aktivierte Anbieter)
          anpassen und rechtlich prüfen lassen.
        </p>
      </Alert>

      <h2>Verantwortlicher</h2>
      <Operator />

      <h2>Grundsatz</h2>
      <p>
        KaufCheck verarbeitet nur die Daten, die für die Prüfung von Inseraten und für dein Konto
        nötig sind. Es gibt keine Werbe-Tracker, keine Profilbildung und keinen Verkauf von Daten.
      </p>

      <h2>Geprüfte Inserate</h2>
      <p>
        Wenn du einen Link oder einen Inseratstext einfügst, verarbeiten wir die Angaben aus dem
        Inserat (zum Beispiel Titel, Preis, Fahrzeugdaten, Beschreibung und Links zu Fotos).
        Telefonnummern, E-Mail-Adressen und Bankverbindungen werden vor dem Speichern automatisch
        entfernt; Namen von Verkäufern werden nicht gespeichert. Prüfungen ohne Konto werden
        standardmäßig nach 90 Tagen gelöscht, Prüfungen mit Konto bis zur Löschung des Kontos
        aufbewahrt. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Bereitstellung des angefragten
        Dienstes).
      </p>

      <h2>Konto</h2>
      <p>
        Für ein Konto speichern wir deine E-Mail-Adresse und einen Hash deines Passworts (nicht das
        Passwort selbst), dazu deine gespeicherten Angebote und Prüfungen. Du kannst dein Konto
        jederzeit selbst in den Kontoeinstellungen löschen; dabei werden alle zugehörigen Daten
        entfernt. Für das Zurücksetzen des Passworts senden wir dir eine E-Mail über unseren
        E-Mail-Anbieter.
      </p>

      <h2>Cookies und lokaler Speicher</h2>
      <ul>
        <li>
          <strong>kc_anon</strong> – eine zufällige Kennung ohne Personenbezug. Sie wird erst
          gesetzt, wenn du eine Prüfung startest, und dient dazu, das kostenlose Kontingent
          einzuhalten. Speicherdauer bis zu 400 Tage.
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
        Alle Cookies sind für den Dienst technisch erforderlich (§ 25 Abs. 2 TDDDG); eine
        Einwilligung ist dafür nicht nötig.
      </p>

      <h2>Nutzungsstatistik</h2>
      <p>
        Um KaufCheck zu verbessern, zählen wir einzelne Ereignisse, etwa „Prüfung gestartet“ oder
        „Fragen kopiert“. Gespeichert werden nur der Name des Ereignisses, wenige feste Merkmale
        (zum Beispiel die Art der Eingabe) und der Zeitpunkt – ohne Kennungen, IP-Adressen oder
        Cookies. Wenn dein Browser „Do Not Track“ oder „Global Privacy Control“ sendet, erfassen wir
        auch das nicht. Rechtsgrundlage ist unser berechtigtes Interesse an einem funktionierenden
        Angebot (Art. 6 Abs. 1 lit. f DSGVO).
      </p>

      <h2>Fotos aus Inseraten</h2>
      <p>
        Fotos werden direkt von den Bildservern von Kleinanzeigen in deinen Browser geladen. Dabei
        erhält der Bildserver technisch bedingt deine IP-Adresse; die Adresse der KaufCheck-Seite
        wird nicht übermittelt.
      </p>

      <h2>KI-Einschätzung</h2>
      <p>
        Wenn der Betreiber eine KI-Einschätzung aktiviert hat, werden der Inseratstext ohne
        Kontaktdaten und – bei der Fotoanalyse – einige Fotos an den eingesetzten KI-Anbieter (zum
        Beispiel Anthropic oder OpenAI) übermittelt, um die Einschätzung zu erstellen. Diese
        Anbieter können ihren Sitz außerhalb der EU haben; die Übermittlung erfolgt auf Grundlage
        geeigneter Garantien wie Standardvertragsklauseln. Persönliche Daten von dir werden dabei
        nicht übermittelt.
      </p>

      <h2>Bezahlung</h2>
      <p>
        Wenn du KaufCheck Pro buchst, wickelt der Zahlungsdienstleister Stripe die Zahlung ab. Deine
        Zahlungsdaten gibst du direkt bei Stripe ein; wir erhalten nur den Status deines Abos.
      </p>

      <h2>Server-Protokolle</h2>
      <p>
        Unser Server protokolliert technische Abläufe ohne IP-Adressen, Cookies und Inhalte von
        Inseraten. Beim Hosting-Anbieter können technisch bedingt Verbindungsdaten anfallen.
      </p>

      <h2>Deine Rechte</h2>
      <p>
        Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung,
        Datenübertragbarkeit und Widerspruch. Außerdem kannst du dich bei einer
        Datenschutz-Aufsichtsbehörde beschweren. Für Anfragen erreichst du uns über die Angaben im{' '}
        <Link to="/impressum">Impressum</Link>.
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
