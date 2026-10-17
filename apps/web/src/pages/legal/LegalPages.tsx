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
      {IMPRINT.phone && (
        <>
          <br />
          Telefon: <a href={`tel:${IMPRINT.phone.replace(/[^\d+]/g, '')}`}>{IMPRINT.phone}</a>
        </>
      )}
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
      <h2>Hinweis zu den Plattformen</h2>
      <p>
        KaufCheck ist ein unabhängiges Angebot und steht in keiner Verbindung zu den Plattformen,
        deren Inserate du prüfen kannst, etwa mobile.de, AutoScout24, Kleinanzeigen, eBay, Autohero,
        pkw.de oder Facebook Marketplace. Die Namen nennen wir nur, um zu beschreiben, woher ein
        Inserat stammt; sie sind Marken ihrer jeweiligen Inhaber.
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

const PRIVACY_POLICY_DATE = '17. Oktober 2026';
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
  const emailProvider = config?.privacy.emailProvider ?? null;
  const ads = config?.ads ?? null;

  return (
    <div className="container page page--narrow prose">
      <h1>Datenschutzerklärung</h1>
      <p className="page__lead">Stand: {PRIVACY_POLICY_DATE}</p>

      <h2>Verantwortlicher</h2>
      <Operator />

      <h2>Grundsatz</h2>
      <p>
        KaufCheck verarbeitet nur die Daten, die für die Prüfung von Inseraten und für dein Konto
        nötig sind.{' '}
        {ads
          ? 'Werbung von Google zeigen wir nur, wenn du einwilligst (siehe „Werbung“); wir selbst bilden keine Profile und verkaufen keine Daten.'
          : 'Es gibt keine Werbe-Tracker, keine Profilbildung und keinen Verkauf von Daten.'}{' '}
        Du musst keine Angaben zu deiner Person machen, um Inserate zu prüfen.
      </p>

      <h2>Hosting</h2>
      {hosting === 'render' ? (
        <>
          <p>
            KaufCheck wird bei Render Services, Inc. (San Francisco, USA) betrieben. Server und
            Datenbank stehen in einem Rechenzentrum in Frankfurt am Main; in der Datenbank speichert
            Render in unserem Auftrag auch deine Kontodaten, etwa gespeicherte Angebote, „Mein Auto“
            und das Kostenbuch. Render setzt dafür weitere Dienstleister ein, darunter Amazon Web
            Services, Google Cloud und Cloudflare; über das Netzwerk von Cloudflare wird die Seite
            ausgeliefert und vor Angriffen geschützt.
          </p>
          <p>
            Beim Aufruf der Seite verarbeiten Render und diese Dienstleister technisch notwendige
            Verbindungsdaten wie deine IP-Adresse, den Zeitpunkt und die aufgerufene Adresse, um die
            Seite auszuliefern und vor Angriffen zu schützen. Mit Render besteht ein Vertrag zur
            Auftragsverarbeitung (Art. 28 DSGVO). Render ist nach dem EU-US Data Privacy Framework
            zertifiziert; Übermittlungen in die USA stützen sich auf den Angemessenheitsbeschluss
            der EU-Kommission (Art. 45 DSGVO), ergänzend auf die EU-Standardvertragsklauseln (Art.
            46 Abs. 2 lit. c DSGVO). Rechtsgrundlage ist unser berechtigtes Interesse an einer
            sicheren und zuverlässigen Bereitstellung (Art. 6 Abs. 1 lit. f DSGVO).
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
        Passworts (nicht das Passwort selbst), dazu deine gespeicherten Angebote, Prüfungen und –
        mit KaufCheck Pro – gespeicherten Suchen (nur deine Suchangaben wie Marke, Preis und PLZ).
        Unter „Mein Auto“ speichern wir, was du zu deinem Auto einträgst (Name, Marke, Modell und
        Generation, Kraftstoff, Erstzulassung, Kilometerstand und HU-Monat – keine FIN und kein
        Kennzeichen), damit wir dir den HU-Termin und das Wissen zu deinem Modell zeigen können. Mit
        KaufCheck Pro kommt das Kostenbuch dazu, damit du Kosten und Wartung festhalten, auswerten
        und exportieren kannst: Datum, Art, Kilometerstand, Betrag, Menge, bei Tankungen, ob
        vollgetankt wurde und ob eine Tankung fehlt, Werkstatt, Notiz und ob eine Rechnung vorliegt
        – Belege selbst laden wir nicht hoch. Die Einträge löschen wir, wenn du einen Eintrag, das
        Auto oder dein Konto löschst; endet Pro, bleiben sie lesbar, bis du sie löschst. Den
        CSV-Export und das Serviceheft als PDF erstellt dein Browser. Ohne E-Mail-Adresse und
        Passwort kann kein Konto angelegt werden. Du kannst dein Konto jederzeit selbst in den
        Kontoeinstellungen löschen; dabei werden alle zugehörigen Daten entfernt.
        {features?.passwordReset === true &&
          ' Wenn du dein Passwort zurücksetzt, schicken wir dir eine E-Mail (siehe „E-Mails“).'}{' '}
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
          Checklisten, deine Notizen für die Preisverhandlung, deine Annahmen für die Kosten pro
          Monat im Vergleich (Pro) und die gewählte Anrede (Sie/du). Diese Daten verlassen deinen
          Browser nicht. Die Annahmen für die Kosten speichert er je Konto; sie bleiben, bis du dich
          in diesem Browser bei KaufCheck abmeldest, dich mit einem anderen Konto anmeldest, hier
          dein Konto löschst oder die Websitedaten deines Browsers löschst – auch wenn deine
          Anmeldung vorher abläuft. Für diese Speicherung in deinem Browser ist nach § 25 Abs. 2 Nr.
          2 TDDDG keine Einwilligung nötig, weil sie für die Funktionen, die du nutzt, unbedingt
          erforderlich ist.
        </li>
        <li>
          Nur wenn du bei einer Prüfung „Offline verfügbar machen“ wählst, speichert dein Browser
          diese Prüfung, die Angaben, mit denen sie angezeigt wird (mit Konto auch deine
          E-Mail-Adresse, deinen Tarif, deine Nutzung im laufenden Monat und die Eckdaten deines
          Pro-Vertrags), und die Programmdateien von KaufCheck, damit die Prüfung auch ohne Empfang
          funktioniert. Die Kopie verlässt dein Gerät nicht und gilt nur in diesem Browser. Sie
          bleibt, bis du sie mit „Offline-Kopie löschen“ entfernst, dich abmeldest, mit einem
          anderen Konto anmeldest, deine Anmeldung abläuft, dein Konto löschst oder die Websitedaten
          in deinem Browser löschst; Safari kann sie auch von selbst löschen, wenn du Safari sieben
          Tage lang nutzt, ohne KaufCheck aufzurufen. Ist keine Prüfung mehr gespeichert, löscht
          KaufCheck auch die Programmdateien. Eine Einwilligung ist nach § 25 Abs. 2 Nr. 2 TDDDG
          nicht nötig, weil du die Funktion ausdrücklich wählst; Rechtsgrundlage für die
          Verarbeitung ist Art. 6 Abs. 1 lit. b DSGVO.
        </li>
        <li>
          Was du in den Kaufvertrag einträgst, bleibt im geöffneten Browser-Tab: KaufCheck speichert
          es weder in deinem Browser noch auf unseren Servern und sendet es nirgendwohin; auch das
          PDF entsteht auf deinem Gerät. Schließt du den Tab, ist alles weg.
        </li>
        <li>
          Ebenso bleibt, was du für einen Inseratstext zum Verkauf deines Autos einträgst, im
          geöffneten Browser-Tab; der Text entsteht auf deinem Gerät. Kommst du von „Mein Auto“,
          lädt die Seite dafür deine Autos, die dort schon gespeichert sind.
        </li>
      </ul>
      <p>
        Beide Cookies sind für den von dir angefragten Dienst unbedingt erforderlich (§ 25 Abs. 2
        Nr. 2 TDDDG); eine Einwilligung ist dafür nicht nötig. Die Monatszähler löschen wir nach
        spätestens 400 Tagen.
        {ads &&
          ' Cookies und ähnliche Techniken von Google und seinen Werbepartnern kommen nur mit deiner Einwilligung zum Einsatz (siehe „Werbung“).'}
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

      <h2>E-Mail-Erinnerungen</h2>
      <p>
        Mit deinem Konto kannst du dich für jedes Auto in „Mein Auto“ an die HU erinnern lassen, mit
        KaufCheck Pro auch an Inspektion, Wechsel der Bremsflüssigkeit und Reifenwechsel. Das ist
        freiwillig und für jede Erinnerung einzeln ausgeschaltet, bis du sie einschaltest. Vor der
        ersten Erinnerung bestätigst du deine E-Mail-Adresse über einen Link, der 48 Stunden gilt.
        Dafür speichern wir, welche Erinnerung du wann eingeschaltet hast, die Monate, die du dazu
        einträgst (nächste Inspektion, letzter Wechsel der Bremsflüssigkeit), wann du deine Adresse
        bestätigt hast und welche Erinnerung wir zuletzt wann verschickt haben, damit jede nur
        einmal kommt. Die E-Mails gehen an die Adresse deines Kontos und nennen das Auto, die Frist,
        kurze sachliche Hinweise dazu und wie du die Erinnerung abbestellst; sie enthalten keine
        Werbung, keine Zählpixel und keine nachverfolgten Links. Abbestellen kannst du jede
        Erinnerung über den Link in der E-Mail oder unter „Mein Auto“. Die Angaben löschen wir mit
        dem Auto oder deinem Konto. Endet Pro, schicken wir nur noch die Erinnerungen an die HU, die
        du eingeschaltet hast; deine übrigen Einstellungen bleiben gespeichert, bis du das Auto oder
        dein Konto löschst. Buchst du Pro wieder, kommen die eingeschalteten Erinnerungen wieder.
        Ist der E-Mail-Versand nicht verfügbar, speichern wir nur die Monate, die du einträgst.
        Bestätigungslinks schicken wir höchstens dreimal am Tag. Rechtsgrundlage ist Art. 6 Abs. 1
        lit. b DSGVO.
      </p>

      {emailProvider && (
        <>
          <h2>E-Mails</h2>
          <p>
            E-Mails – etwa zum Zurücksetzen des Passworts, die Erinnerungen für dein Auto und die
            Bestätigungen zu Bestellungen, Verträgen, Kündigungen und Widerrufen – verschicken wir
            über{' '}
            {emailProvider === 'brevo' &&
              'die Brevo GmbH, Köpenicker Str. 126, 10179 Berlin, die in unserem Auftrag handelt (Auftragsverarbeitung nach Art. 28 DSGVO).'}
            {emailProvider === 'gmail' &&
              'Gmail, einen Dienst der Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland. Google LLC (USA) ist nach dem EU-U.S. Data Privacy Framework zertifiziert; Übermittlungen in die USA stützen sich auf den Angemessenheitsbeschluss der EU-Kommission (Art. 45 DSGVO).'}
            {emailProvider === 'other' && 'einen E-Mail-Dienstleister.'} Dabei erhält der Dienst
            deine E-Mail-Adresse und den Inhalt der E-Mail. Rechtsgrundlage ist die Durchführung des
            Vertrags bzw. deiner Anfrage (Art. 6 Abs. 1 lit. b DSGVO) und, bei den Bestätigungen,
            unsere gesetzliche Pflicht dazu (Art. 6 Abs. 1 lit. c DSGVO).
          </p>
        </>
      )}

      {features?.billing === true && (
        <>
          <h2>Bestellung und Bezahlung von KaufCheck Pro</h2>
          <p>
            Bestellst du KaufCheck Pro, speichern wir die Bestellung: Bestellnummer, die
            E-Mail-Adresse deines Kontos, Preis, die Zeitpunkte von Bestellung und Vertragsschluss,
            die Fassung der AGB und deine beiden Erklärungen bei der Bestellung (AGB akzeptiert,
            sofortiger Beginn verlangt). Dazu schicken wir dir eine Eingangsbestätigung und die
            Vertragsbestätigung per E-Mail.
          </p>
          <p>
            Die Zahlung wickelt der Zahlungsdienstleister Stripe ab. Deine Zahlungsdaten gibst du
            direkt bei Stripe ein; wir erhalten sie nicht. Wir übermitteln Stripe deine
            E-Mail-Adresse, eine interne Kennung deines Kontos und die Bestellnummer und erfahren
            von Stripe den Status deiner Zahlung und deines Abos. Stripe verarbeitet Zahlungsdaten
            auch in eigener Verantwortung, etwa zur Betrugsvorbeugung und für gesetzliche Pflichten;
            Einzelheiten stehen in den Datenschutzhinweisen von Stripe unter{' '}
            <a href="https://stripe.com/de/privacy">stripe.com/de/privacy</a>. Stripe hält sich an
            das EU-U.S. Data Privacy Framework; Übermittlungen in die USA stützen sich auf den
            Angemessenheitsbeschluss der EU-Kommission (Art. 45 DSGVO).
          </p>
          <p>
            Rechtsgrundlage ist die Erfüllung des Vertrags (Art. 6 Abs. 1 lit. b DSGVO) sowie unsere
            gesetzlichen Pflichten, etwa zur Aufbewahrung (Art. 6 Abs. 1 lit. c DSGVO).
            Bestellungen, die nicht bezahlt werden, löschen wir nach 30 Tagen. Unterlagen zu
            geschlossenen Verträgen bewahren wir auf, solange Ansprüche aus dem Vertrag möglich sind
            und gesetzliche Aufbewahrungsfristen laufen, höchstens zehn Jahre – auch dann, wenn du
            dein Konto löschst.
          </p>
        </>
      )}

      <h2>Kündigung und Widerruf über die Website</h2>
      <p>
        Kündigst oder widerrufst du einen Vertrag über unsere Website, speichern wir deine Angaben –
        Name, E-Mail-Adresse, Vertrag und Bestellnummer, bei einer Kündigung auch deren Art, den
        Grund und den gewünschten Zeitpunkt – mit Datum und Uhrzeit des Eingangs. Wir ordnen sie
        deinem Konto zu, setzen sie um und bestätigen dir den Eingang per E-Mail; wenn nötig, geht
        eine Kopie zur Bearbeitung an uns. Diese Funktionen und Bestätigungen schreibt das Gesetz
        vor (§§ 312k, 356a BGB). Rechtsgrundlage ist Art. 6 Abs. 1 lit. b und c DSGVO. Die Angaben
        bewahren wir wie Vertragsunterlagen auf, höchstens zehn Jahre.
      </p>

      <h2>Server-Protokolle</h2>
      <p>
        Unser Server protokolliert technische Abläufe wie aufgerufene Pfade, Statuscodes und Fehler,
        ohne IP-Adressen, Cookies und Inhalte von Inseraten.
        {hosting === 'render' &&
          ' Die Protokolle liegen bei Render und werden je nach Tarif nach 7 bis 30 Tagen gelöscht.'}
      </p>

      {ads && (
        <>
          <h2>Werbung (Google AdSense)</h2>
          <p>
            Auf Ergebnisseiten und in den Ratgebern zeigen wir Werbung über Google AdSense, einen
            Dienst der Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland
            („Google“). Mit KaufCheck Pro siehst du keine Werbung. Sendet dein Browser „Do Not
            Track“ oder „Global Privacy Control“, laden wir Google AdSense gar nicht.
          </p>
          <p>
            Auf einer Seite mit Werbung lädt dein Browser Programmcode von Google; dabei erhält
            Google technisch bedingt deine IP-Adresse, die Adresse der Seite und Angaben zu deinem
            Browser. Zuerst zeigt Google einen Einwilligungsdialog – eine nach dem Transparency and
            Consent Framework (TCF) des IAB zertifizierte Plattform. Rechtsgrundlage dafür ist unser
            berechtigtes Interesse, die gesetzlich nötige Einwilligung einzuholen (Art. 6 Abs. 1
            lit. f DSGVO).
          </p>
          <p>
            Im Dialog entscheidest du, ob Google und die dort genannten Werbepartner Cookies und
            ähnliche Techniken auf deinem Gerät nutzen dürfen, um Anzeigen auszuliefern, ihre
            Wirkung zu messen und – wenn du auch dem zustimmst – Anzeigen nach deinen Interessen
            auszuwählen. Die Partner und ihre Zwecke sind im Dialog aufgeführt. Rechtsgrundlage ist
            deine Einwilligung (§ 25 Abs. 1 TDDDG, Art. 6 Abs. 1 lit. a DSGVO). Ohne Einwilligung
            zeigen wir keine Werbung. Deine Entscheidung speichert Google in einem Cookie auf deinem
            Gerät.
          </p>
          <p>
            Deine Einwilligung kannst du jederzeit mit Wirkung für die Zukunft ändern oder
            widerrufen: über „Datenschutz- und Cookie-Einstellungen“ am Ende jeder Seite.
          </p>
          <p>
            Google verarbeitet die Daten in eigener Verantwortung. Google LLC (USA) ist nach dem
            EU-U.S. Data Privacy Framework zertifiziert; Übermittlungen in die USA stützen sich auf
            den Angemessenheitsbeschluss der EU-Kommission (Art. 45 DSGVO). Wie Google Daten auf
            Websites von Partnern verwendet, erklärt Google unter{' '}
            <a href="https://policies.google.com/technologies/partner-sites">
              policies.google.com/technologies/partner-sites
            </a>
            ; Informationen zu den Werbediensten von Google stehen unter{' '}
            <a href="https://business.safety.google/privacy/">business.safety.google/privacy</a>.
          </p>
        </>
      )}

      <h2>Keine automatisierten Entscheidungen</h2>
      <p>
        KaufCheck wertet Inserate automatisch aus. Das betrifft Fahrzeuge und Angebote, nicht dich:
        Wir selbst betreiben weder Profiling noch treffen wir automatisierte Entscheidungen im Sinne
        von Art. 22 DSGVO.
        {ads && ' Zur Auswahl von Anzeigen durch Google siehe „Werbung“.'}
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
          ausdrücklich eingegeben hat, und nur bei Plattformen, die dem zugestimmt haben. Er folgt
          keinen Links und durchsucht keine Websites.
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
