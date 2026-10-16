import { Link } from 'react-router';
import { GuideLayout, type TocEntry } from './GuideLayout';

const TOC: TocEntry[] = [
  { id: 'pflicht', title: 'Wer ummelden muss – und bis wann' },
  { id: 'unterlagen', title: 'Unterlagen' },
  { id: 'online', title: 'Online ummelden mit i-Kfz' },
  { id: 'kennzeichen', title: 'Kennzeichen behalten oder neu' },
  { id: 'kosten', title: 'Kosten' },
  { id: 'ueberfuehrung', title: 'Das Auto nach Hause bringen' },
  { id: 'verkaeufer', title: 'Was der Verkäufer melden muss' },
  { id: 'faq', title: 'Häufige Fragen' },
];

const external = { target: '_blank', rel: 'noopener' } as const;

export function RegistrationGuidePage() {
  return (
    <GuideLayout
      path="/auto-ummelden"
      eyebrow="Auto ummelden"
      title="Auto ummelden nach dem Gebrauchtwagenkauf"
      updated="Oktober 2026"
      toc={TOC}
      intro={
        <p>
          Wer ein gebrauchtes Auto kauft, muss es auf sich ummelden. Hier steht, was du dafür
          brauchst, wie es online geht, was es ungefähr kostet und wie du das Auto nach Hause
          bringst. Die Einzelheiten regelt deine Zulassungsbehörde – schau vorher auf ihre Seite.
        </p>
      }
    >
      <h2 id="pflicht">Wer ummelden muss – und bis wann</h2>
      <p>
        Nach dem Kauf meldest du das Auto bei der Zulassungsbehörde deines Wohnorts auf dich um, und
        zwar <strong>unverzüglich</strong> (§ 15 Abs. 5 Fahrzeug-Zulassungsverordnung). Eine feste
        Zahl von Tagen gibt es nicht; „unverzüglich“ heißt ohne schuldhaftes Zögern. Du legst dabei
        die Zulassungsbescheinigung Teil I und Teil II und die Versicherungsbestätigung vor und
        beantragst eine neue Zulassungsbescheinigung Teil I.
      </p>
      <p>
        Die Kfz-Steuer musst du nicht selbst anmelden: Die Zulassungsbehörde gibt die Daten an den
        Zoll weiter, der Steuerbescheid kommt danach per Post. Die Steuerpflicht beginnt mit der
        Zulassung auf dich.
      </p>

      <h2 id="unterlagen">Unterlagen</h2>
      <p>Was genau verlangt wird, unterscheidet sich je Behörde. Meist brauchst du:</p>
      <ul>
        <li>Personalausweis – oder Reisepass mit Meldebescheinigung</li>
        <li>Zulassungsbescheinigung Teil I (Fahrzeugschein) und Teil II (Fahrzeugbrief)</li>
        <li>
          eine eVB-Nummer: die elektronische Versicherungsbestätigung deiner neuen Kfz-Versicherung,
          kostenlos beim Versicherer
        </li>
        <li>
          ein SEPA-Lastschriftmandat für die Kfz-Steuer – ohne Mandat gibt es keine Zulassung (§ 13
          Kraftfahrzeugsteuergesetz)
        </li>
        <li>
          den Nachweis über eine gültige Hauptuntersuchung, wenn sie nicht im Fahrzeugschein steht
        </li>
        <li>die bisherigen Kennzeichen, wenn du neue bekommst</li>
      </ul>
      <p>
        In manchen Städten, etwa Hamburg, wird die Zulassung verweigert, solange du noch Kfz-Steuer
        schuldest.
      </p>

      <h2 id="online">Online ummelden mit i-Kfz</h2>
      <p>
        Über die internetbasierte Fahrzeugzulassung (i-Kfz) kannst du ein Auto auch online
        umschreiben – mit oder ohne Halterwechsel. Du brauchst dafür:
      </p>
      <ul>
        <li>
          einen Personalausweis, eine eID-Karte oder einen elektronischen Aufenthaltstitel mit
          eingeschalteter Online-Ausweisfunktion samt PIN und die AusweisApp (oder BundID mit
          ELSTER-Zertifikat)
        </li>
        <li>eVB-Nummer, gültige HU und deine Bankverbindung für die Kfz-Steuer</li>
        <li>
          die Zulassungsbescheinigungen und die Plaketten auf den Kennzeichen mit den verdeckten
          Sicherheitscodes – für einen Halterwechsel muss die Zulassungsbescheinigung Teil II nach
          dem 1. Januar 2018 ausgestellt sein
        </li>
        <li>einen Drucker</li>
      </ul>
      <p>
        Leg einen Sicherheitscode erst frei, wenn du ihn eingibst: Freigelegte Codes machen das
        Dokument ungültig. Nach dem Antrag lädst du den Bescheid und einen vorläufigen Nachweis
        herunter, druckst sie aus und legst den Nachweis gut sichtbar ins Auto; damit darfst du
        schon fahren. Wie lange er gilt, steht im Bescheid. Papiere und Plaketten kommen per Post.
        Mehr dazu beim{' '}
        <a
          href="https://www.bmv.de/SharedDocs/DE/Artikel/StV/Strassenverkehr/internetbasierte-fahrzeugzulassung.html"
          {...external}
        >
          Bundesverkehrsministerium<span className="visually-hidden"> (öffnet in neuem Tab)</span>
        </a>
        .
      </p>

      <h2 id="kennzeichen">Kennzeichen behalten oder neu</h2>
      <p>
        Du musst das Kennzeichen beim Halterwechsel nicht tauschen: Seit Oktober 2019 kann ein
        Kennzeichen bundesweit am Auto bleiben, auch wenn der Halter wechselt und in einem anderen
        Bezirk wohnt. Ein Anspruch auf eine bestimmte Buchstaben-Zahlen-Kombination besteht aber
        nicht. Ein Wunschkennzeichen kostet extra, in München zum Beispiel 12,80 €. Neue Schilder
        lässt du bei einem Schilderprägedienst machen; sie gehören nicht zur Gebühr der Behörde.
      </p>

      <h2 id="kosten">Kosten</h2>
      <p>
        Die Gebühren richten sich nach der Gebührenordnung für Maßnahmen im Straßenverkehr und
        unterscheiden sich je Behörde und Vorgang. Beispiele (Stand Oktober 2026):
      </p>
      <ul>
        <li>München: online ab 17,80 € mit altem Kennzeichen, ab 20,50 € mit neuem</li>
        <li>München vor Ort: ab 24,20 € mit altem Kennzeichen, ab 27,10 € mit neuem</li>
        <li>Berlin: 19,60 € Grundgebühr, dazu je nach Fall weitere Gebühren</li>
        <li>Hamburg: 23,60 € bis 60,00 €</li>
      </ul>
      <p>Dazu kommen gegebenenfalls neue Schilder und ein Wunschkennzeichen.</p>

      <h2 id="ueberfuehrung">Das Auto nach Hause bringen</h2>
      <p>
        <strong>Ist das Auto noch zugelassen,</strong> kannst du es online auf dich ummelden und mit
        dem vorläufigen Nachweis aus i-Kfz nach Hause fahren. Bis zur Ummeldung läuft die
        Versicherung des Verkäufers weiter; ein Unfall in dieser Zeit kann ihn seinen
        Schadenfreiheitsrabatt kosten. Sprich das vorher mit ihm ab.
      </p>
      <p>
        <strong>Ist das Auto abgemeldet,</strong> brauchst du für die Fahrt ein Kurzzeitkennzeichen
        (§ 42 Fahrzeug-Zulassungsverordnung). Es gilt nur für Probe- und Überführungsfahrten und nur
        für dieses eine Auto, höchstens bis zum Ende des fünften Tages nach der Zuteilung. Du
        beantragst es an deinem Wohnort oder dort, wo das Auto steht, und brauchst dafür eine
        eVB-Nummer. Ohne gültige HU sind nur Fahrten zur Prüfstelle im selben oder einem
        benachbarten Bezirk erlaubt. Kurzzeitkennzeichen erkennst du an der „03“ oder „04“ am Anfang
        der Nummer.
      </p>

      <h2 id="verkaeufer">Was der Verkäufer melden muss</h2>
      <p>
        Der Verkäufer meldet den Verkauf unverzüglich seiner Zulassungsbehörde, wenn du das Auto
        nicht schon umgemeldet hast – mit Kennzeichen, deinem Namen und deiner Anschrift und deiner
        Bestätigung, dass du die Zulassungsbescheinigung bekommen hast. Meldest du nicht um, kann
        die Behörde die Zulassung nach einer Frist von vier Wochen beenden oder den Betrieb des
        Autos untersagen. Für den Verkäufer endet die Kfz-Steuer erst, wenn seine Anzeige bei der
        Behörde eingeht oder du das Auto umgemeldet hast. Mehr dazu im Ratgeber{' '}
        <Link to="/auto-verkaufen#nach-dem-verkauf">Auto privat verkaufen</Link>.
      </p>
      <p>
        Die Kfz-Versicherung des Verkäufers geht ohne Abmeldung zunächst auf dich über. Sobald du
        mit der eVB-Nummer deiner eigenen Versicherung ummeldest, endet sie.
      </p>

      <h2 id="faq">Häufige Fragen</h2>
      <h3>Wie schnell muss ich ein gekauftes Auto ummelden?</h3>
      <p>
        Unverzüglich, also ohne schuldhaftes Zögern. Eine Frist in Tagen nennt das Gesetz nicht;
        warte nicht länger als nötig – auch weil Briefe zu Rückrufen an den eingetragenen Halter
        gehen.
      </p>
      <h3>Kann ich das Kennzeichen des Verkäufers behalten?</h3>
      <p>Ja, das Kennzeichen kann am Auto bleiben, auch wenn du in einem anderen Bezirk wohnst.</p>
      <h3>Brauche ich für ein Kurzzeitkennzeichen eine eVB-Nummer?</h3>
      <p>Ja, auch dafür brauchst du eine Versicherungsbestätigung.</p>
      <h3>Kann ich sofort nach der Online-Zulassung losfahren?</h3>
      <p>
        Ja, mit dem ausgedruckten vorläufigen Nachweis gut sichtbar im Auto, bis Papiere und
        Plaketten per Post kommen.
      </p>
    </GuideLayout>
  );
}
