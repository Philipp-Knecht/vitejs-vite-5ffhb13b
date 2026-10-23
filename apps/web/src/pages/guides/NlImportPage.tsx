import { RDW_SOURCE } from '@kaufcheck/shared';
import { Link } from 'react-router';
import { RdwCheck } from '../../features/rdw/RdwCheck';
import { GuideLayout, type TocEntry } from './GuideLayout';

const TOC: TocEntry[] = [
  { id: 'abfrage', title: 'Kennzeichen abfragen' },
  { id: 'daten', title: 'Was die RDW-Daten zeigen' },
  { id: 'tacho', title: 'Die Bewertung des Kilometerstands' },
  { id: 'grenzen', title: 'Was die Daten nicht zeigen' },
  { id: 'kennzeichen', title: 'Woher du das Kennzeichen bekommst' },
];

const external = { target: '_blank', rel: 'noopener noreferrer' } as const;
const NEW_TAB = <span className="visually-hidden"> (öffnet in neuem Tab)</span>;

export function NlImportPage() {
  return (
    <GuideLayout
      path="/auto-aus-den-niederlanden"
      eyebrow="Import aus den Niederlanden"
      title="Auto aus den Niederlanden: Kennzeichen bei der RDW prüfen"
      updated="Oktober 2026"
      toc={TOC}
      intro={
        <p>
          War das Auto in den Niederlanden zugelassen, verrät sein niederländisches Kennzeichen mehr
          als die meisten Inserate: Die Zulassungsbehörde RDW veröffentlicht kostenlos, wie sie den
          Verlauf der Kilometerstände bewertet, welche Rückrufe offen sind und welche Mängel bei der
          Hauptuntersuchung (APK) gefunden wurden.
        </p>
      }
    >
      <h2 id="abfrage">Kennzeichen abfragen</h2>
      <RdwCheck />

      <h2 id="daten">Was die RDW-Daten zeigen</h2>
      <p>
        Die RDW (Rijksdienst voor het Wegverkeer) führt das niederländische Fahrzeugregister und
        stellt Teile davon als{' '}
        <a href={RDW_SOURCE.url} {...external}>
          offene Daten{NEW_TAB}
        </a>{' '}
        bereit, gemeinfrei und ohne Anmeldung. KaufCheck zeigt daraus:
      </p>
      <ul>
        <li>
          die Erstzulassung und die erste Zulassung in den Niederlanden – liegt die zweite deutlich
          später, kam das Auto schon als Gebrauchtwagen in die Niederlande;
        </li>
        <li>ob das Auto als ausgeführt gemeldet ist und ob es als Taxi zugelassen war;</li>
        <li>die Bewertung der Kilometerstände durch die RDW;</li>
        <li>Rückrufe, die für dieses Kennzeichen offen oder als erledigt gemeldet sind;</li>
        <li>Mängel, die Prüfstellen bei der APK festgestellt haben, mit Datum.</li>
      </ul>
      <p>
        Die Daten bleiben nach der Ausfuhr abrufbar, aber sie enden dort: Was danach mit dem Auto
        geschah, steht nicht darin.
      </p>

      <h2 id="tacho">Die Bewertung des Kilometerstands</h2>
      <p>
        In den Niederlanden melden Werkstätten, Prüfstellen und Händler den Kilometerstand bei jedem
        Termin an die RDW. Ist jeder Stand höher als der davor, bewertet die RDW den Verlauf als
        „logisch“. Ist ein Stand niedriger als ein früherer, lautet die Bewertung „unlogisch“: Der
        Tacho kann zurückgedreht worden sein, oder jemand hat sich vertippt. Keine Bewertung gibt es
        zum Beispiel, wenn der Tacho getauscht wurde oder das Auto vorher im Ausland zugelassen war.
        KaufCheck zeigt die Erläuterung der RDW zu jeder Bewertung, ins Deutsche übersetzt.
      </p>
      <p>
        „Unlogisch“ ist ein Grund, genau nachzufragen und Belege zu verlangen, aber noch kein Beweis
        für Betrug. „Logisch“ ist umgekehrt keine Garantie: Stände nach der Ausfuhr kennt die RDW
        nicht.
      </p>

      <h2 id="grenzen">Was die Daten nicht zeigen</h2>
      <ul>
        <li>
          Unfälle und Schäden: Sie stehen nicht in den offenen Daten der RDW. Lass das Auto vor dem
          Kauf von einer Werkstatt oder Prüforganisation ansehen.
        </li>
        <li>Die Kilometerstände selbst – nur die Bewertung des Verlaufs.</li>
        <li>Halter und ihre Zahl: Personenbezogene Daten veröffentlicht die RDW nicht.</li>
        <li>
          APK-Termine ohne Mangel: Die Daten nennen nur Prüfungen, bei denen etwas gefunden wurde.
        </li>
      </ul>
      <p>
        Für Rückrufe in Deutschland und die Fahrgestellnummer siehe{' '}
        <Link to="/auto-rueckruf-pruefen">Rückrufe prüfen</Link>, für die Zulassung{' '}
        <Link to="/auto-ummelden">Auto ummelden</Link> – für ein Auto aus dem Ausland nennt dir
        deine Zulassungsstelle die Unterlagen.
      </p>

      <h2 id="kennzeichen">Woher du das Kennzeichen bekommst</h2>
      <p>
        Das niederländische Kennzeichen steht auf dem niederländischen Fahrzeugschein
        (kentekenbewijs, seit 2014 eine Karte) und auf den Kennzeichenschildern, solange das Auto
        sie noch trägt – oft auch auf älteren Fotos im Inserat. Ist das Auto schon in Deutschland
        zugelassen, frag den Verkäufer: Bei einem Import aus den Niederlanden kennt er das alte
        Kennzeichen aus den Einfuhrunterlagen. Weigert er sich, ist das ein Hinweis, vorsichtig zu
        sein.
      </p>
    </GuideLayout>
  );
}
