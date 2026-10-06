import { Link } from 'react-router';
import { GuideLayout, type TocEntry } from './GuideLayout';

const TOC: TocEntry[] = [
  { id: 'budget', title: 'Budget realistisch planen' },
  { id: 'modell', title: 'Das passende Modell finden' },
  { id: 'inserat', title: 'Das Inserat richtig lesen' },
  { id: 'kontakt', title: 'Den Verkäufer kontaktieren' },
  { id: 'besichtigung', title: 'Besichtigung und Probefahrt' },
  { id: 'unterlagen', title: 'Unterlagen prüfen' },
  { id: 'verhandeln', title: 'Preis verhandeln' },
  { id: 'vertrag', title: 'Der Kaufvertrag' },
  { id: 'uebergabe', title: 'Bezahlung und Übergabe' },
  { id: 'zulassung', title: 'Ummelden und losfahren' },
  { id: 'betrug', title: 'Betrugsmaschen erkennen' },
  { id: 'faq', title: 'Häufige Fragen' },
];

export function BuyingGuidePage() {
  return (
    <GuideLayout
      path="/gebrauchtwagen-kaufen"
      eyebrow="Ratgeber"
      title="Gebrauchtwagen privat kaufen: Schritt für Schritt"
      updated="September 2026"
      toc={TOC}
      intro={
        <p>
          Von privat ist ein Gebrauchtwagen oft günstiger als beim Händler – dafür trägst du mehr
          Risiko. Mit einer guten Vorbereitung, den richtigen Fragen und einem sauberen Kaufvertrag
          lässt sich dieses Risiko deutlich senken. Hier ist der Ablauf von der ersten Suche bis zur
          Zulassung.
        </p>
      }
    >
      <h2 id="budget">1. Budget realistisch planen</h2>
      <p>
        Der Kaufpreis ist nur ein Teil der Kosten. Rechne vor der Suche durch, was das Auto im Jahr
        kostet – sonst wird aus dem Schnäppchen schnell eine Belastung.
      </p>
      <ul>
        <li>
          <strong>Versicherung:</strong> Der Beitrag hängt stark von Modell (Typklasse), Wohnort
          (Regionalklasse) und deinem Schadenfreiheitsrabatt ab. Hol dir vor dem Kauf ein Angebot
          für genau das Modell ein.
        </li>
        <li>
          <strong>Kfz-Steuer:</strong> Sie richtet sich nach Hubraum, CO₂-Ausstoß und Erstzulassung.
          Das Bundesfinanzministerium bietet dafür einen Online-Rechner an.
        </li>
        <li>
          <strong>Wartung und Verschleiß:</strong> Inspektionen, Reifen, Bremsen und – je nach Motor
          – Zahnriemen kosten Geld. Frag nach, was als Nächstes fällig ist.
        </li>
        <li>
          <strong>Puffer:</strong> Leg einen Betrag für die ersten Monate zurück. Auch bei einem
          guten Gebrauchten fällt oft eine Kleinigkeit an.
        </li>
        <li>
          <strong>Zulassung:</strong> Gebühren, Kennzeichen und gegebenenfalls die Überführung
          kommen einmalig dazu.
        </li>
      </ul>

      <h2 id="modell">2. Das passende Modell finden</h2>
      <p>
        Überleg dir zuerst, wofür du das Auto brauchst: Kurzstrecke in der Stadt, lange
        Autobahnfahrten, Platz für Familie oder Anhänger. Danach lohnt sich ein Blick auf die
        typischen Schwächen der Modelle, die infrage kommen.
      </p>
      <ul>
        <li>
          Die <strong>Pannenstatistik des ADAC</strong> und der <strong>TÜV-Report</strong> zeigen,
          bei welchen Modellen und Baujahren häufiger Probleme auftreten.
        </li>
        <li>
          In der <strong>Rückrufdatenbank des Kraftfahrt-Bundesamts</strong> siehst du, ob es für
          ein Modell Rückrufe gab. Frag den Verkäufer, ob sie erledigt wurden.
        </li>
        <li>
          Als grober Richtwert gelten <strong>10.000 bis 15.000 Kilometer pro Jahr</strong>.
          Deutlich weniger ist nicht automatisch besser: Viele Kurzstrecken belasten Motor und
          Abgasanlage.
        </li>
        <li>
          Bei Dieselfahrzeugen spielen Rußpartikelfilter und Abgasnorm eine Rolle, etwa für
          Umweltzonen. Bei Elektroautos ist der Zustand der Batterie entscheidend – frag nach einem
          Batteriezertifikat.
        </li>
      </ul>

      <h2 id="inserat">3. Das Inserat richtig lesen</h2>
      <p>
        Ein gutes Inserat beantwortet die wichtigsten Fragen schon, bevor du fragst. Achte darauf,
        ob diese Angaben enthalten sind:
      </p>
      <ul>
        <li>Erstzulassung, Kilometerstand und Termin der nächsten Hauptuntersuchung (HU)</li>
        <li>Anzahl der Vorbesitzer und ob das Auto unfallfrei ist</li>
        <li>Scheckheft oder Rechnungen zur Wartung</li>
        <li>Motorisierung, Getriebe, Kraftstoff und wichtige Ausstattung</li>
        <li>Fotos von allen Seiten, vom Innenraum und vom Kilometerstand</li>
        <li>Bekannte Mängel und der Grund für den Verkauf</li>
      </ul>
      <p>
        Fehlende Angaben sind nicht automatisch ein schlechtes Zeichen – aber sie sind deine Fragen
        an den Verkäufer. Hellhörig solltest du bei Widersprüchen werden: zwei verschiedene
        Kilometerstände, „unfallfrei“ im Text, aber „beschädigt“ in den Details, oder ein Preis weit
        unter vergleichbaren Angeboten.
      </p>
      <p>
        <Link to="/">KaufCheck</Link> zeigt dir für ein Inserat von mobile.de, AutoScout24,
        Kleinanzeigen, eBay und anderen Plattformen auf einen Blick, welche Angaben fehlen, was
        auffällt und welche Fragen du stellen solltest.
      </p>

      <h2 id="kontakt">4. Den Verkäufer kontaktieren</h2>
      <p>
        Kläre die wichtigsten Punkte vor der Besichtigung – das spart dir Wege zu Autos, die nicht
        passen. Ein kurzes Telefonat verrät oft mehr als ein langer Chat.
      </p>
      <ul>
        <li>Seit wann gehört dir das Auto, und warum verkaufst du es?</li>
        <li>Hatte das Auto Unfälle oder Schäden, auch reparierte?</li>
        <li>Gibt es ein Scheckheft oder Rechnungen? Wann war die letzte Inspektion?</li>
        <li>Wie viele Halter stehen in der Zulassungsbescheinigung Teil II?</li>
        <li>Sind Mängel bekannt? Was wäre als Nächstes zu machen?</li>
        <li>Ist das Auto auf dich zugelassen, und ist eine Probefahrt möglich?</li>
      </ul>
      <p>
        Weicht der Verkäufer bei einfachen Fragen aus oder drängt er zu einer schnellen
        Entscheidung, ist Vorsicht angebracht.
      </p>

      <h2 id="besichtigung">5. Besichtigung und Probefahrt</h2>
      <p>
        Vereinbare die Besichtigung bei Tageslicht und möglichst bei trockenem Wetter – Regen und
        Dunkelheit verdecken Kratzer, Dellen und Farbunterschiede. Nimm eine zweite Person mit und
        schau dir das Auto am besten an der Adresse des Verkäufers an.
      </p>
      <p>
        Bitte darum, dass der Motor bei deiner Ankunft kalt ist. Viele Probleme zeigen sich nur beim
        Kaltstart. Plane für die Probefahrt mindestens 20 bis 30 Minuten ein, mit Stadtverkehr,
        Landstraße und wenn möglich Autobahn. Kläre vorher, wer bei einem Schaden während der
        Probefahrt haftet.
      </p>
      <p>
        Worauf du im Einzelnen achten solltest, steht in unserer{' '}
        <Link to="/auto-besichtigung-checkliste">Checkliste für die Besichtigung</Link>. Wenn du
        unsicher bist oder das Auto teuer ist, lohnt sich ein Gebrauchtwagencheck in einer Werkstatt
        oder bei einer Prüforganisation wie TÜV, DEKRA, GTÜ oder KÜS.
      </p>

      <h2 id="unterlagen">6. Unterlagen prüfen</h2>
      <ul>
        <li>
          <strong>Zulassungsbescheinigung Teil I und Teil II:</strong> Beide müssen vorhanden sein.
          Fehlt Teil II, kann das Auto zum Beispiel noch bei einer Bank finanziert sein – dann ist
          ein Kauf nicht ohne Weiteres möglich.
        </li>
        <li>
          <strong>Fahrzeug-Identifizierungsnummer (FIN):</strong> Sie muss in beiden Dokumenten und
          am Fahrzeug übereinstimmen. Du findest sie meist unten an der Windschutzscheibe und an
          einer weiteren Stelle an der Karosserie.
        </li>
        <li>
          <strong>Verkäufer und Halter:</strong> Ist der Verkäufer nicht der eingetragene Halter,
          lass dir den Grund erklären und dir gegebenenfalls eine Vollmacht zeigen.
        </li>
        <li>
          <strong>Bericht der letzten Hauptuntersuchung:</strong> Er zeigt festgestellte Mängel und
          den Kilometerstand zum Prüfzeitpunkt.
        </li>
        <li>
          <strong>Scheckheft und Rechnungen:</strong> Die Kilometerstände sollten lückenlos und
          plausibel ansteigen. Große Sprünge oder Lücken sind ein Gesprächsthema.
        </li>
      </ul>

      <h2 id="verhandeln">7. Preis verhandeln</h2>
      <p>
        „VB“ steht für Verhandlungsbasis: Der Verkäufer rechnet mit einem Angebot. Gute Argumente
        sind konkret und sachlich – etwa fehlende Nachweise, eine bald fällige HU, abgefahrene
        Reifen oder anstehende Wartungsarbeiten. Frag dich vorher, welchen Preis du höchstens zahlen
        willst, und bleib dabei.
      </p>

      <h2 id="vertrag">8. Der Kaufvertrag</h2>
      <p>
        Schließ den Kauf immer schriftlich ab. Musterverträge für den privaten Autokauf bieten zum
        Beispiel die Automobilclubs an. In den Vertrag gehören:
      </p>
      <ul>
        <li>Namen, Anschriften und Ausweisdaten von Käufer und Verkäufer</li>
        <li>
          Fahrzeugdaten: Marke, Modell, FIN, Kennzeichen, Erstzulassung und Kilometerstand bei
          Übergabe
        </li>
        <li>Kaufpreis, Zahlungsart und Zeitpunkt der Übergabe</li>
        <li>Alle bekannten Mängel und Unfallschäden – ausdrücklich aufgeführt</li>
        <li>
          Was der Verkäufer zusichert, etwa Unfallfreiheit, die Anzahl der Vorbesitzer oder die
          Laufleistung
        </li>
        <li>Die Zahl der übergebenen Schlüssel und Unterlagen</li>
      </ul>
      <p>
        Privatverkäufer schließen die Haftung für Sachmängel meist aus („gekauft wie gesehen“). Das
        ist zulässig, gilt aber nicht für Mängel, die der Verkäufer arglistig verschwiegen hat, und
        nicht für Eigenschaften, die er ausdrücklich zugesichert hat. Deshalb lohnt es sich,
        wichtige Aussagen wie „unfallfrei“ in den Vertrag schreiben zu lassen. Kaufst du bei einem
        Händler, hast du als Verbraucher gesetzliche Gewährleistungsrechte; bei Gebrauchtwagen kann
        die Frist auf ein Jahr verkürzt werden.
      </p>

      <h2 id="uebergabe">9. Bezahlung und Übergabe</h2>
      <ul>
        <li>
          Zahle erst bei der Übergabe – nie im Voraus an jemanden, dessen Auto du nicht gesehen
          hast.
        </li>
        <li>
          Eine Echtzeitüberweisung vor Ort ist nachvollziehbar und schnell. Bei Barzahlung bietet
          sich die Übergabe in einer Bankfiliale an, wo das Geld gleich geprüft und eingezahlt
          werden kann.
        </li>
        <li>Lass dir den Empfang des Geldes im Vertrag oder mit einer Quittung bestätigen.</li>
        <li>
          Nimm alle Schlüssel, beide Teile der Zulassungsbescheinigung, den HU-Bericht und die
          Wartungsnachweise mit.
        </li>
      </ul>

      <h2 id="zulassung">10. Ummelden und losfahren</h2>
      <p>
        Als Käufer meldest du das Auto auf dich um. Dafür brauchst du in der Regel deinen Ausweis,
        beide Teile der Zulassungsbescheinigung, eine eVB-Nummer deiner Versicherung, einen Nachweis
        über die gültige HU und ein SEPA-Mandat für die Kfz-Steuer. Vielerorts geht das auch online.
        Der Verkäufer muss den Verkauf seiner Zulassungsbehörde melden.
      </p>
      <p>
        Fahr nicht mit den Kennzeichen und der Versicherung des Verkäufers weg, ohne das genau
        abzusprechen. Sauberer ist ein Kurzzeitkennzeichen oder die Ummeldung vor der Abholung.
      </p>

      <h2 id="betrug">11. Betrugsmaschen erkennen</h2>
      <ul>
        <li>
          <strong>Vorkasse:</strong> Das Auto steht angeblich im Ausland und soll per Spedition
          geliefert werden, du sollst vorab zahlen oder einen „Treuhandservice“ nutzen. Das ist ein
          klassischer Betrug.
        </li>
        <li>
          <strong>Unrealistischer Preis:</strong> Liegt der Preis weit unter vergleichbaren
          Angeboten, gibt es dafür fast immer einen Grund.
        </li>
        <li>
          <strong>Kommunikation außerhalb der Plattform:</strong> Wer dich sofort auf E-Mail oder
          Messenger umleiten will, möchte oft Schutzmechanismen umgehen.
        </li>
        <li>
          <strong>Manipulierter Kilometerstand:</strong> Vergleiche den Tacho mit HU-Berichten und
          Rechnungen und achte darauf, ob der Verschleiß im Innenraum dazu passt.
        </li>
        <li>
          <strong>Keine Besichtigung möglich:</strong> Ohne Besichtigung und Probefahrt solltest du
          kein Auto kaufen.
        </li>
      </ul>

      <h2 id="faq">Häufige Fragen</h2>
      <h3>Muss ein privater Verkäufer für Mängel haften?</h3>
      <p>
        Nur eingeschränkt. Private Verkäufer dürfen die Sachmängelhaftung ausschließen. Für
        arglistig verschwiegene Mängel und für ausdrücklich zugesicherte Eigenschaften haften sie
        trotzdem.
      </p>
      <h3>Wie viele Vorbesitzer sind in Ordnung?</h3>
      <p>
        Das hängt vom Alter des Autos ab. Wichtiger als die Zahl ist, ob die Wartung nachvollziehbar
        ist. Viele Halterwechsel in kurzer Zeit sind aber eine Nachfrage wert.
      </p>
      <h3>Was bedeutet „scheckheftgepflegt“?</h3>
      <p>
        Dass die Wartungen nach den Vorgaben des Herstellers durchgeführt und im Serviceheft oder
        digital dokumentiert wurden. Lass dir die Nachweise zeigen – das Wort allein beweist nichts.
      </p>
      <h3>Lohnt sich ein Gebrauchtwagencheck?</h3>
      <p>
        Bei teureren Autos, bei Hinweisen auf Unfallschäden oder wenn du dich technisch nicht sicher
        fühlst, fast immer. Die Kosten sind gering im Vergleich zu einer teuren Reparatur nach dem
        Kauf.
      </p>
    </GuideLayout>
  );
}
