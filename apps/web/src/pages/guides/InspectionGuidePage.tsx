import { Link } from 'react-router';
import { GuideLayout, type TocEntry } from './GuideLayout';

const TOC: TocEntry[] = [
  { id: 'vorbereitung', title: 'Vorbereitung: Was du mitnimmst' },
  { id: 'ankunft', title: 'Bei der Ankunft' },
  { id: 'karosserie', title: 'Karosserie, Lack und Rost' },
  { id: 'reifen', title: 'Reifen und Bremsen' },
  { id: 'motorraum', title: 'Motorraum und Kaltstart' },
  { id: 'innenraum', title: 'Innenraum und Elektrik' },
  { id: 'probefahrt', title: 'Die Probefahrt' },
  { id: 'danach', title: 'Nach der Probefahrt' },
  { id: 'papiere', title: 'Papiere vor Ort abgleichen' },
  { id: 'profi', title: 'Wann sich ein Profi lohnt' },
];

export function InspectionGuidePage() {
  return (
    <GuideLayout
      path="/auto-besichtigung-checkliste"
      eyebrow="Besichtigung"
      title="Auto-Besichtigung: So prüfst du einen Gebrauchtwagen"
      updated="September 2026"
      toc={TOC}
      intro={
        <p>
          Bei der Besichtigung zeigt sich, ob das Auto zum Inserat passt. Du musst kein Mechaniker
          sein, um die wichtigsten Warnzeichen zu erkennen – du brauchst nur einen Plan, etwas Zeit
          und gutes Licht. Plane mindestens eine Stunde ein.
        </p>
      }
    >
      <h2 id="vorbereitung">Vorbereitung: Was du mitnimmst</h2>
      <ul>
        <li>
          <strong>Eine zweite Person:</strong> Vier Augen sehen mehr, und sie bremst dich, wenn du
          dich zu schnell verliebst.
        </li>
        <li>
          <strong>Taschenlampe:</strong> für Radkästen, Unterboden und Motorraum.
        </li>
        <li>
          <strong>Papiertuch und Handschuhe:</strong> um Ölstand und Flüssigkeiten zu prüfen.
        </li>
        <li>
          <strong>Kleiner Magnet in einem Tuch:</strong> Er haftet schlecht auf dick gespachtelten
          Stellen. Das funktioniert nur bei Stahlblech, nicht bei Aluminium oder Kunststoff.
        </li>
        <li>
          <strong>Optional:</strong> ein Lackschichtdickenmessgerät oder ein OBD-Diagnosegerät, um
          den Fehlerspeicher auszulesen – natürlich nur mit Einverständnis des Verkäufers.
        </li>
        <li>
          <strong>Führerschein und diese Checkliste:</strong> Die Kurzfassung findest du in der{' '}
          <Link to="/gebrauchtwagen-checkliste">Gebrauchtwagen-Checkliste</Link>.
        </li>
      </ul>

      <h2 id="ankunft">Bei der Ankunft</h2>
      <p>
        Leg zuerst die Hand auf die Motorhaube. Ist sie warm, wurde der Motor kurz vorher gefahren –
        dann lassen sich Probleme beim Kaltstart nicht mehr erkennen. Bitte in dem Fall um einen
        neuen Termin oder zumindest darum, das Auto abkühlen zu lassen. Schau dir das Auto dann in
        Ruhe von allen Seiten aus einigen Metern Abstand an: Steht es gerade? Hängt eine Seite
        tiefer?
      </p>

      <h2 id="karosserie">Karosserie, Lack und Rost</h2>
      <ul>
        <li>
          <strong>Spaltmaße:</strong> Die Abstände zwischen Türen, Hauben und Kotflügeln sollten
          rundum gleichmäßig sein. Ungleiche Spalten deuten auf eine Reparatur nach einem Unfall
          hin.
        </li>
        <li>
          <strong>Farbunterschiede:</strong> Betrachte den Lack schräg im Tageslicht. Leicht
          abweichende Farbtöne oder eine andere Oberflächenstruktur zeigen nachlackierte Teile.
        </li>
        <li>
          <strong>Lacknebel:</strong> Farbreste an Gummidichtungen, Zierleisten oder
          Kunststoffteilen sind ein sicheres Zeichen für eine Lackierung.
        </li>
        <li>
          <strong>Rost:</strong> Typische Stellen sind Radläufe, Schweller, Türunterkanten, die
          Unterkante der Heckklappe und der Unterboden. Oberflächlicher Flugrost ist kein Drama;
          Blasen im Lack und durchgerostete Stellen sind es schon.
        </li>
        <li>
          <strong>Scheiben und Leuchten:</strong> Risse in der Frontscheibe im Sichtfeld sind ein
          Mangel bei der HU. Beschlagene oder matte Scheinwerfer können auf Undichtigkeiten
          hinweisen.
        </li>
      </ul>

      <h2 id="reifen">Reifen und Bremsen</h2>
      <ul>
        <li>
          <strong>Profiltiefe:</strong> Gesetzlich sind mindestens 1,6 mm vorgeschrieben. Für gute
          Fahreigenschaften empfehlen Fachleute deutlich mehr, bei Sommerreifen etwa 3 mm und bei
          Winterreifen etwa 4 mm.
        </li>
        <li>
          <strong>Abnutzung:</strong> Einseitig abgefahrene Reifen deuten auf eine falsche
          Spureinstellung oder Probleme am Fahrwerk hin.
        </li>
        <li>
          <strong>Alter:</strong> Die DOT-Nummer auf der Reifenflanke endet mit vier Ziffern: Woche
          und Jahr der Herstellung. „2320“ bedeutet zum Beispiel die 23. Woche 2020. Ältere Reifen
          werden hart, auch wenn noch Profil da ist.
        </li>
        <li>
          <strong>Bremsscheiben:</strong> Durch die Felgen sieht man oft die Scheiben. Tiefe Riefen
          oder ein deutlicher Rand am äußeren Rand zeigen Verschleiß.
        </li>
      </ul>

      <h2 id="motorraum">Motorraum und Kaltstart</h2>
      <ul>
        <li>
          <strong>Ölstand:</strong> Der Stand sollte zwischen den Markierungen am Messstab liegen.
          Milchig-helles Öl oder hellbrauner Schaum am Öldeckel können auf ein Problem mit der
          Zylinderkopfdichtung hinweisen – oder nur auf viele Kurzstrecken. Beides ist eine
          Nachfrage wert.
        </li>
        <li>
          <strong>Kühlmittel:</strong> Der Stand im Ausgleichsbehälter sollte stimmen. Ölschlieren
          im Kühlmittel sind ein Warnzeichen.
        </li>
        <li>
          <strong>Undichtigkeiten:</strong> Feuchte, ölige Stellen am Motor oder am Boden unter dem
          Auto deuten auf Lecks hin. Ein auffällig frisch gereinigter Motor kann solche Spuren
          verdecken.
        </li>
        <li>
          <strong>Kaltstart:</strong> Der Motor sollte sofort anspringen und nach kurzer Zeit ruhig
          laufen. Rasseln in den ersten Sekunden kann auf eine gelängte Steuerkette hinweisen.
          Blauer Rauch deutet auf Ölverbrauch hin, anhaltend weißer Rauch bei warmem Motor auf
          Kühlmittel im Brennraum.
        </li>
        <li>
          <strong>Warnleuchten:</strong> Beim Einschalten der Zündung leuchten sie kurz auf und
          müssen nach dem Start erlöschen. Leuchtet eine gar nicht auf, kann sie deaktiviert worden
          sein.
        </li>
      </ul>

      <h2 id="innenraum">Innenraum und Elektrik</h2>
      <ul>
        <li>
          <strong>Verschleiß:</strong> Lenkrad, Schaltknauf, Pedalgummis und die Seitenwange des
          Fahrersitzes zeigen, wie viel das Auto gefahren wurde. Starker Verschleiß bei niedrigem
          Kilometerstand passt nicht zusammen.
        </li>
        <li>
          <strong>Geruch und Feuchtigkeit:</strong> Ein muffiger Geruch oder nasse Teppiche im
          Fußraum oder in der Reserveradmulde deuten auf undichte Stellen hin.
        </li>
        <li>
          <strong>Funktionen:</strong> Probiere alles aus – Fenster, Spiegel, Zentralverriegelung,
          Licht, Blinker, Hupe, Wischer, Heizung, Sitzheizung, Radio und Navigation. Die Klimaanlage
          sollte nach wenigen Minuten spürbar kalte Luft liefern.
        </li>
      </ul>

      <h2 id="probefahrt">Die Probefahrt</h2>
      <p>
        Nimm dir mindestens 20 bis 30 Minuten Zeit und fahr verschiedene Strecken: Stadtverkehr,
        Landstraße und wenn möglich ein Stück Autobahn. Schalte das Radio aus und hör genau hin.
      </p>
      <ul>
        <li>
          <strong>Kupplung und Getriebe:</strong> Greift die Kupplung erst ganz oben, ist sie
          vermutlich verschlissen. Die Gänge sollten sich ohne Kratzen einlegen lassen. Eine
          Automatik schaltet weich und ohne Rucken.
        </li>
        <li>
          <strong>Lenkung:</strong> Auf gerader Strecke fährt das Auto geradeaus, das Lenkrad steht
          gerade und vibriert nicht.
        </li>
        <li>
          <strong>Bremsen:</strong> Bei einer kräftigen Bremsung (nur wenn der Verkehr es zulässt)
          bleibt das Auto in der Spur. Pulsierende Pedale oder Rubbeln deuten auf verzogene Scheiben
          hin.
        </li>
        <li>
          <strong>Fahrwerk:</strong> Poltern über Unebenheiten spricht für verschlissene
          Fahrwerksteile, ein mit dem Tempo lauter werdendes Brummen für ein Radlager.
        </li>
        <li>
          <strong>Motor:</strong> Er nimmt gleichmäßig Gas an, ohne Ruckeln. Die Temperaturanzeige
          bleibt im normalen Bereich.
        </li>
      </ul>

      <h2 id="danach">Nach der Probefahrt</h2>
      <p>
        Lass den Motor laufen und schau noch einmal unter das Auto und in den Motorraum: Tropft
        etwas? Riecht es verbrannt? Ein paar Wassertropfen von der Klimaanlage sind normal, Öl oder
        Kühlmittel nicht. Sprich danach in Ruhe mit deiner Begleitung, bevor du über den Preis
        redest.
      </p>

      <h2 id="papiere">Papiere vor Ort abgleichen</h2>
      <ul>
        <li>
          Die Fahrzeug-Identifizierungsnummer am Auto stimmt mit Teil I und Teil II der
          Zulassungsbescheinigung überein.
        </li>
        <li>Der Kilometerstand passt zu HU-Bericht, Serviceheft und Rechnungen.</li>
        <li>Die Zahl der Halter in Teil II passt zu dem, was der Verkäufer gesagt hat.</li>
        <li>Alle Schlüssel funktionieren, auch die Fernbedienung.</li>
      </ul>

      <h2 id="profi">Wann sich ein Profi lohnt</h2>
      <p>
        Wenn das Auto teuer ist, du Hinweise auf einen Unfall gefunden hast oder dir bei der Technik
        unsicher bist, lass es vor dem Kauf prüfen. Werkstätten und Prüforganisationen wie TÜV,
        DEKRA, GTÜ oder KÜS bieten Gebrauchtwagenchecks an. Ein seriöser Verkäufer hat damit kein
        Problem.
      </p>
      <p>
        Vor der Besichtigung hilft dir <Link to="/">KaufCheck</Link>: Füge den Link zum Inserat ein
        und du bekommst eine Checkliste mit Hinweisen, die sich aus genau diesem Inserat ergeben –
        zum Beispiel zu Automatikgetriebe, Laufleistung oder erwähnten Schäden.
      </p>
    </GuideLayout>
  );
}
