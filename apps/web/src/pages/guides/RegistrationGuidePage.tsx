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
  { id: 'umzug', title: 'Nach Umzug oder Namensänderung' },
  { id: 'faq', title: 'Häufige Fragen' },
];

const external = { target: '_blank', rel: 'noopener noreferrer' } as const;

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
          ein SEPA-Lastschriftmandat für die Kfz-Steuer – ohne Mandat gibt es keine Zulassung, außer
          das Auto ist steuerbefreit, etwa ein Elektroauto (§ 13 Kraftfahrzeugsteuergesetz)
        </li>
        <li>
          den Nachweis über eine gültige Hauptuntersuchung, wenn sie nicht im Fahrzeugschein steht
        </li>
        <li>die bisherigen Kennzeichen, wenn du neue bekommst</li>
      </ul>
      <p>
        Hast du noch Kfz-Steuerschulden von 5 € oder mehr, darf die Zulassungsbehörde das Auto nicht
        auf dich zulassen (§ 13 Abs. 2 Kraftfahrzeugsteuergesetz).
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
        schon fahren. Er gilt nach § 31 Fahrzeug-Zulassungsverordnung höchstens 14 Tage, manche
        Behörden nennen 10 – maßgeblich ist der Bescheid. Papiere und Plaketten kommen per Post.
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
        <li>
          München (Auto schon in München zugelassen): online ab 17,80 € mit altem Kennzeichen, ab
          20,50 € mit neuem; vor Ort ab 24,20 € und ab 27,10 €
        </li>
        <li>
          Berlin (Auto mit Berliner Kennzeichen): 19,60 € Grundgebühr, dazu je nach Fall weitere
          Gebühren
        </li>
        <li>Hamburg: 23,60 € bis 60,00 €</li>
      </ul>
      <p>Dazu kommen gegebenenfalls neue Schilder und ein Wunschkennzeichen.</p>

      <h2 id="ueberfuehrung">Das Auto nach Hause bringen</h2>
      <p>
        <strong>Ist das Auto noch zugelassen,</strong> kannst du es – wenn die Papiere onlinefähig
        sind (siehe oben) – online auf dich ummelden und mit dem vorläufigen Nachweis aus i-Kfz nach
        Hause fahren. Sonst fährst du es bis zur Ummeldung mit seiner bisherigen Zulassung; sprich
        das vorher mit dem Verkäufer ab (zur Versicherung siehe unten).
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
        die Behörde den Betrieb des Autos untersagen oder die Zulassungsbescheinigung im
        Verkehrsblatt aufbieten; legt sie niemand binnen vier Wochen vor, endet die Zulassung. Für
        den Verkäufer endet die Kfz-Steuer mit dem Tag, an dem das Auto auf dich umgeschrieben wird
        – nicht schon mit seiner Verkaufsanzeige. Mehr dazu im Ratgeber{' '}
        <Link to="/auto-verkaufen#nach-dem-verkauf">Auto privat verkaufen</Link>.
      </p>
      <p>
        Die Kfz-Versicherung des Verkäufers geht mit dem Kauf auf dich über, solange das Auto nicht
        abgemeldet ist. Sobald du mit der eVB-Nummer deiner eigenen Versicherung ummeldest, endet
        sie. Ein Unfall in der Zeit dazwischen kann den Verkäufer trotzdem seinen
        Schadenfreiheitsrabatt kosten – melde deshalb zügig um.
      </p>

      <h2 id="umzug">Nach Umzug oder Namensänderung</h2>
      <p>
        Auch wenn du selbst umziehst oder deinen Namen änderst, meldest du das unverzüglich der
        Zulassungsbehörde (§ 15 Fahrzeug-Zulassungsverordnung); geändert wird die
        Zulassungsbescheinigung Teil I. Bei einer reinen Adressänderung brauchst du den
        Fahrzeugbrief (Teil II) nicht; bei einer Namensänderung oder wenn du ein neues Kennzeichen
        nimmst, bring ihn mit. Das Kennzeichen darfst du behalten – ein neues ist freiwillig. Manche
        Meldebehörden geben die neue Anschrift bei der Ummeldung direkt weiter (§ 15 Abs. 2
        Fahrzeug-Zulassungsverordnung). Bei einem Umzug in einen anderen Bezirk ist die Behörde
        deines neuen Wohnorts zuständig.
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
      <h3>Muss ich nach einem Umzug ein neues Kennzeichen nehmen?</h3>
      <p>Nein, du meldest nur die neue Anschrift; das Kennzeichen kann bleiben.</p>
      <h3>Kann ich sofort nach der Online-Zulassung losfahren?</h3>
      <p>
        Ja, mit dem ausgedruckten vorläufigen Nachweis gut sichtbar im Auto, bis Papiere und
        Plaketten per Post kommen.
      </p>
    </GuideLayout>
  );
}
