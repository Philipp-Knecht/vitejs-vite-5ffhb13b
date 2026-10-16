import { Link } from 'react-router';
import { GuideLayout, type TocEntry } from './GuideLayout';

const TOC: TocEntry[] = [
  { id: 'bloecke', title: 'Die vier Kostenblöcke' },
  { id: 'beispiele', title: 'Beispiele des ADAC' },
  { id: 'versicherung', title: 'Was die Versicherung bestimmt' },
  { id: 'hu', title: 'HU und AU' },
  { id: 'sparen', title: 'So sparst du' },
  { id: 'rechnen', title: 'Selbst rechnen' },
  { id: 'faq', title: 'Häufige Fragen' },
];

const external = { target: '_blank', rel: 'noopener noreferrer' } as const;
const NEW_TAB = <span className="visually-hidden"> (öffnet in neuem Tab)</span>;

export function CostsGuidePage() {
  return (
    <GuideLayout
      path="/autokosten-im-monat"
      eyebrow="Autokosten im Monat"
      title="Was kostet ein Auto im Monat?"
      updated="Oktober 2026"
      toc={TOC}
      intro={
        <p>
          Ein Auto kostet mehr als Sprit und Versicherung: Der größte Posten ist meist der
          Wertverlust. Ein neuer VW Golf 1.5 TSI kostet laut ADAC rund 674 € im Monat, das
          günstigste Modell seiner Übersicht 433 €; die günstigsten drei Jahre alten Verbrenner
          kosten laut ADAC ohne Wertverlust ab rund 318 €. Hier steht, woraus sich die Kosten
          zusammensetzen, was der ADAC für einige Modelle errechnet hat und wie du für dein
          Wunschauto selbst rechnest.
        </p>
      }
    >
      <h2 id="bloecke">Die vier Kostenblöcke</h2>
      <p>
        Der ADAC teilt die Kosten eines Autos in vier Blöcke. Für seine Vergleiche rechnet er mit
        fünf Jahren Haltedauer und 15.000 km im Jahr.
      </p>
      <ul>
        <li>
          <strong>Wertverlust:</strong> der Unterschied zwischen dem Kaufpreis und dem, was das Auto
          am Ende noch wert ist – laut ADAC der größte Posten der monatlichen Autokosten.
        </li>
        <li>
          <strong>Fixkosten:</strong> Kfz-Steuer, Haftpflicht- und Kaskoversicherung sowie eine
          Pauschale für Parken, kleines Zubehör und HU/AU. Eine Garagenmiete kommt bei Bedarf dazu.
        </li>
        <li>
          <strong>Betriebskosten:</strong> Kraftstoff oder Strom, Öl und gegebenenfalls AdBlue, dazu
          Wäsche und Pflege.
        </li>
        <li>
          <strong>Werkstatt und Reifen:</strong> Inspektionen nach Herstellervorgabe,
          Verschleißteile wie Bremsen und Batterie, neue Reifen und bei längerer Haltedauer eine
          Rücklage für Reparaturen.
        </li>
      </ul>

      <h2 id="beispiele">Beispiele des ADAC</h2>
      <p>
        In seiner Autokostenübersicht Frühjahr/Sommer 2026 (Stand April 2026) hat der ADAC für
        Neuwagen bei fünf Jahren und 15.000 km im Jahr zum Beispiel diese Monatskosten errechnet (
        <a
          href="https://assets.adac.de/Autodatenbank/Autokosten/autokostenuebersicht.pdf"
          {...external}
        >
          ADAC-Autokostenübersicht{NEW_TAB}
        </a>
        ):
      </p>
      <ul>
        <li>
          VW Golf 1.5 TSI (85 kW): 674 € im Monat – davon 340 € Wertverlust, 153 € Betriebskosten,
          116 € Fixkosten und 65 € Werkstatt
        </li>
        <li>Opel Corsa 1.2 DI Turbo Edition: 632 € im Monat</li>
        <li>
          Dacia Spring Electric 70 Essential, das günstigste Modell der Übersicht: 433 € im Monat
        </li>
      </ul>
      <p>
        Für drei Jahre alte Gebrauchte hat der ADAC die Kosten ohne Wertverlust gerechnet (fünf
        Jahre, 15.000 km im Jahr): etwa 318 € im Monat für einen Dacia Sandero mit Autogas, 332 €
        für einen Škoda Scala und 346 € für einen VW Golf Variant (
        <a
          href="https://presse.adac.de/meldungen/adac-ev/technik/gebraucht-und-guenstig.html"
          {...external}
        >
          ADAC, März 2026{NEW_TAB}
        </a>
        ). Der Wertverlust deines Autos kommt dazu.
      </p>
      <p>
        Deine eigenen Kosten können deutlich abweichen: Fahrleistung, Versicherung, Werkstatt und
        Kaufpreis entscheiden.
      </p>

      <h2 id="versicherung">Was die Versicherung bestimmt</h2>
      <p>
        Der Beitrag zur Kfz-Versicherung hängt laut Gesamtverband der Versicherer (GDV) unter
        anderem ab von:
      </p>
      <ul>
        <li>
          der <strong>Typklasse</strong> des Modells – sie spiegelt die Schäden der letzten drei
          Jahre und wird jedes Jahr neu berechnet (
          <Link to="/kfz-steuer-rechner#typklasse">Typklasse nachschlagen</Link>)
        </li>
        <li>
          der <strong>Regionalklasse</strong> deines Zulassungsbezirks
        </li>
        <li>
          deiner <strong>Schadenfreiheitsklasse</strong>: Mit jedem unfallfreien Jahr verbessert sie
          sich um eine Klasse
        </li>
        <li>
          Fahrleistung, Fahrerkreis, Alter der Fahrer, Selbstbeteiligung und weiteren Merkmalen
        </li>
      </ul>
      <p>
        Typ- und Regionalklassen sind für die Versicherer nicht verbindlich; bei bestehenden
        Verträgen ändern sich die Beiträge meist zum 1. Januar.
      </p>

      <h2 id="hu">HU und AU</h2>
      <p>
        Die Hauptuntersuchung mit Abgasuntersuchung kostet laut ADAC 2026 im Schnitt rund 163 €. Ein
        neues Auto muss nach drei Jahren zur ersten HU, danach alle zwei Jahre. Elektroautos
        brauchen keine AU. Ist die HU mehr als zwei Monate überzogen, kostet sie 20 % mehr. Wann die
        HU deines Autos fällig ist, behältst du in <Link to="/mein-auto">„Mein Auto“</Link> im
        Blick.
      </p>

      <h2 id="sparen">So sparst du</h2>
      <ul>
        <li>
          <strong>Versicherung vergleichen:</strong> Laut{' '}
          <a
            href="https://www.verbraucherzentrale.de/wissen/geld-versicherungen/weitere-versicherungen/kfzversicherung-ueberpruefen-und-mehrere-hundert-euro-sparen-11490"
            {...external}
          >
            Verbraucherzentrale{NEW_TAB}
          </a>{' '}
          lassen sich oft mehrere hundert Euro im Jahr sparen. Die Kündigungsfrist beträgt meist
          einen Monat – bei einem Versicherungsjahr ab 1. Januar muss die Kündigung bis 30. November
          ankommen. Eine Beitragserhöhung gibt dir ein Sonderkündigungsrecht.
        </li>
        <li>
          <strong>Typklasse vor dem Kauf prüfen:</strong> Zwei ähnliche Modelle können sehr
          unterschiedlich eingestuft sein.
        </li>
        <li>
          <strong>Werkstatt vergleichen:</strong> Freie Werkstätten haben oft niedrigere
          Stundensätze. Auch in der Garantiezeit darfst du sie für Inspektionen nutzen, wenn sie
          nach Herstellervorgaben arbeiten – lass dir das auf der Rechnung bestätigen.
        </li>
        <li>
          <strong>Kraftstoff und Reifendruck:</strong> Wer vorausschauend fährt und den Reifendruck
          prüft, spart beim Verbrauch.
        </li>
      </ul>

      <h2 id="rechnen">Selbst rechnen</h2>
      <p>
        Im <Link to="/kfz-steuer-rechner#unterhalt">Kostenrechner</Link> rechnest du kostenlos die
        laufenden Kosten eines Autos aus Steuer, Kraftstoff, Versicherung und Werkstatt. Mit
        KaufCheck Pro stellst du im Vergleich deiner gespeicherten Angebote die Kosten pro Monat
        nebeneinander – mit Wertverlust – und hältst im Kostenbuch fest, was dein Auto tatsächlich
        kostet. KaufCheck hat keine eigenen Preis- oder Verbrauchsdaten; gerechnet wird mit deinen
        Angaben.
      </p>

      <h2 id="faq">Häufige Fragen</h2>
      <h3>Welcher Kostenblock ist der größte?</h3>
      <p>Meist der Wertverlust, besonders bei neuen und teuren Autos.</p>
      <h3>Was kostet die HU?</h3>
      <p>HU und AU zusammen kosten laut ADAC 2026 im Schnitt rund 163 €.</p>
      <h3>Wann kann ich die Kfz-Versicherung kündigen?</h3>
      <p>
        Meist mit einem Monat Frist zum Ende des Versicherungsjahres, nach einer Beitragserhöhung
        auch außerordentlich.
      </p>
    </GuideLayout>
  );
}
