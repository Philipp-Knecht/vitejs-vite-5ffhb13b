import { Link } from 'react-router';
import { KBA_RECALL_DATABASE_URL, recallCheckFor } from '@kaufcheck/catalog';
import { MODEL_PAGES_AVAILABLE } from '../../features/advisor/availability';
import { GuideLayout, type TocEntry } from './GuideLayout';

const TOC: TocEntry[] = [
  { id: 'was', title: 'Was ist ein Rückruf?' },
  { id: 'datenbank', title: 'Die Rückrufdatenbank des KBA' },
  { id: 'fin', title: 'Mit der FIN beim Hersteller prüfen' },
  { id: 'brief', title: 'Wie Halter informiert werden' },
  { id: 'kosten', title: 'Kosten' },
  { id: 'ignorieren', title: 'Was passiert ohne Reaktion?' },
  { id: 'kauf', title: 'Vor dem Gebrauchtwagenkauf' },
  { id: 'faq', title: 'Häufige Fragen' },
];

const external = { target: '_blank', rel: 'noopener noreferrer' } as const;

// The same, hand-checked pages as in the recall check of the app.
const SKODA_URL = recallCheckFor('skoda')?.url;
const TOYOTA_URL = recallCheckFor('toyota')?.url;
const NEW_TAB = <span className="visually-hidden"> (öffnet in neuem Tab)</span>;

export function RecallGuidePage() {
  return (
    <GuideLayout
      path="/auto-rueckruf-pruefen"
      eyebrow="Rückrufe prüfen"
      title="Rückrufe beim Auto prüfen"
      updated="Oktober 2026"
      toc={TOC}
      intro={
        <p>
          Hersteller rufen Autos zurück, wenn ein Mangel die Sicherheit oder die Umwelt gefährdet.
          So findest du heraus, ob dein Auto – oder eines, das du kaufen willst – betroffen ist, und
          was du dann tun musst.
        </p>
      }
    >
      <h2 id="was">Was ist ein Rückruf?</h2>
      <p>
        In Deutschland überwacht das Kraftfahrt-Bundesamt (KBA) als Marktüberwachungsbehörde, ob
        Fahrzeuge sicher sind. Grundlage sind vor allem die EU-Verordnung 2018/858 über die
        Genehmigung von Fahrzeugen und das Produktsicherheitsgesetz. Stellt ein Hersteller ein
        ernstes Risiko fest, muss er es melden; das KBA überwacht den Rückruf und kann ihn auch
        anordnen.
      </p>
      <p>
        Daneben gibt es freiwillige Serviceaktionen der Hersteller, die oft beim nächsten
        Werkstattbesuch nebenbei erledigt werden. Nicht alle Maßnahmen der Hersteller stehen in der
        Datenbank des KBA.
      </p>

      <h2 id="datenbank">Die Rückrufdatenbank des KBA</h2>
      <p>
        In der{' '}
        <a href={KBA_RECALL_DATABASE_URL} {...external}>
          Rückrufdatenbank des KBA{NEW_TAB}
        </a>{' '}
        suchst du nach Marke und Modell. Sie zeigt, welche Modelle und Bauzeiträume betroffen sind,
        worin der Mangel besteht und wie er behoben wird. Zwei Grenzen solltest du kennen:
      </p>
      <ul>
        <li>
          Die Datenbank kennt keine Fahrgestellnummern (FIN). Ob dein Auto betroffen ist, siehst du
          dort nicht – nur, ob es in einen betroffenen Bauzeitraum fällt.
        </li>
        <li>
          Sie enthält nicht alle Maßnahmen der Hersteller; erfasst werden Rückrufe schrittweise seit
          Mai 2004.
        </li>
      </ul>

      <h2 id="fin">Mit der FIN beim Hersteller prüfen</h2>
      <p>
        Ob genau dein Auto betroffen ist, erfährst du über die 17-stellige
        Fahrzeug-Identifizierungsnummer (FIN). Sie steht in der Zulassungsbescheinigung Teil I im
        Feld „E“. Viele Hersteller bieten dafür eine Abfrage auf ihrer Website an, zum Beispiel{' '}
        <a href={SKODA_URL} {...external}>
          Škoda{NEW_TAB}
        </a>{' '}
        und{' '}
        <a href={TOYOTA_URL} {...external}>
          Toyota{NEW_TAB}
        </a>
        . Sonst hilft eine Vertragswerkstatt der Marke: Sie sieht offene Rückrufe in der Datenbank
        des Herstellers.
      </p>

      <h2 id="brief">Wie Halter informiert werden</h2>
      <p>
        Bei einem Rückruf schreibt der Hersteller die Halter an. Die Anschriften bekommt er aus dem
        Zentralen Fahrzeugregister des KBA – deshalb geht der Brief an den Halter, der dort
        eingetragen ist. Wer nicht reagiert, bekommt weitere Schreiben; danach informiert das KBA
        die Zulassungsbehörde. Ist dein Auto betroffen, du hast aber keinen Brief bekommen, wende
        dich an den Hersteller oder Importeur.
      </p>

      <h2 id="kosten">Kosten</h2>
      <p>
        Nach dem{' '}
        <a
          href="https://www.kba.de/DE/Themen/Marktueberwachung/Rueckrufe/Kodex/kodex_pdf.pdf?__blob=publicationFile&v=2"
          {...external}
        >
          Rückruf-Kodex des KBA{NEW_TAB}
        </a>{' '}
        ist der Rückruf für dich als Halter kostenlos, und der Hersteller muss eine kostenlose
        Kontaktmöglichkeit anbieten. Ein gesetzlicher Anspruch darauf besteht laut ADAC nur über
        Gewährleistung oder Garantie; in der Praxis zahlen die Hersteller. Ein Ersatzauto für die
        Zeit in der Werkstatt steht dir nicht zu – manche Hersteller bieten aber freiwillig eines
        an.
      </p>

      <h2 id="ignorieren">Was passiert ohne Reaktion?</h2>
      <p>
        Die Teilnahme an einem überwachten Rückruf ist Pflicht. Reagierst du nicht, kann die
        Zulassungsbehörde den Betrieb des Autos untersagen (§ 5 Fahrzeug-Zulassungsverordnung). Das
        lässt sich abwenden, wenn du die Arbeiten vorher machen lässt und nachweist.
      </p>

      <h2 id="kauf">Vor dem Gebrauchtwagenkauf</h2>
      <ul>
        <li>Marke und Modell in der Rückrufdatenbank des KBA nachschlagen</li>
        <li>die FIN beim Hersteller oder in einer Vertragswerkstatt prüfen lassen</li>
        <li>
          den Verkäufer fragen, ob Rückrufe erledigt sind, und sich das belegen lassen – meist steht
          es auf der Werkstattrechnung oder im Serviceheft
        </li>
        <li>
          nach dem Kauf zügig ummelden, damit spätere Briefe zu Rückrufen bei dir ankommen (
          <Link to="/auto-ummelden">Auto ummelden</Link>)
        </li>
      </ul>
      <p>
        {MODEL_PAGES_AVAILABLE && (
          <>
            Auf den <Link to="/modelle">Modellseiten</Link> und unter{' '}
          </>
        )}
        {!MODEL_PAGES_AVAILABLE && 'Unter '}
        <Link to="/mein-auto">„Mein Auto“</Link> verlinkt KaufCheck die Rückrufabfrage des
        Herstellers, soweit es eine gibt, und die Datenbank des KBA, ebenso bei jeder{' '}
        <Link to="/inserat-pruefen">Inseratsprüfung</Link> – abfragen musst du selbst.
      </p>

      <h2 id="faq">Häufige Fragen</h2>
      <h3>Ich bin zu einem Rückruf angeschrieben worden. Muss ich teilnehmen?</h3>
      <p>Ja. Ohne Teilnahme kann die Zulassungsbehörde den Betrieb des Autos untersagen.</p>
      <h3>Mein Auto ist betroffen, aber ich habe keinen Brief bekommen. Was tun?</h3>
      <p>Wende dich an den Hersteller oder Importeur und lass die Arbeiten machen.</p>
      <h3>Ich habe das Auto nicht mehr und trotzdem einen Brief bekommen.</h3>
      <p>
        Teil dem Hersteller mit, an wen du das Auto verkauft hast, damit der neue Halter informiert
        werden kann.
      </p>
      <h3>Muss ich die Reparatur bezahlen?</h3>
      <p>
        In der Regel nein: Nach dem Kodex des KBA ist der Rückruf für den Halter kostenlos, und die
        Hersteller übernehmen die Kosten üblicherweise.
      </p>
    </GuideLayout>
  );
}
