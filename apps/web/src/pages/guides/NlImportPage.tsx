import { RDW_SOURCE } from '@kaufcheck/shared';
import { Link } from 'react-router';
import { RdwCheck } from '../../features/rdw/RdwCheck';
import { GuideLayout, type TocEntry } from './GuideLayout';

const TOC: TocEntry[] = [
  { id: 'abfrage', title: 'Kennzeichen abfragen' },
  { id: 'daten', title: 'Was die RDW-Daten zeigen' },
  { id: 'tacho', title: 'Das Urteil über den Kilometerstand' },
  { id: 'grenzen', title: 'Was die Daten nicht zeigen' },
  { id: 'kennzeichen', title: 'Woher du das Kennzeichen bekommst' },
];

const external = { target: '_blank', rel: 'noopener noreferrer' } as const;
const NEW_TAB = <span className="visually-hidden"> (öffnet in neuem Tab)</span>;
/** The RDW on odometer readings: who reports them, and the verdicts. */
const RDW_ODOMETER_URL = 'https://www.rdw.nl/over-rdw/actueel/dossiers/tellerstanden';

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
          als die meisten Inserate: Die Zulassungsbehörde RDW veröffentlicht kostenlos ihr Urteil
          über den Verlauf der Kilometerstände, Rückrufe und die Befunde der Hauptuntersuchung
          (APK).
        </p>
      }
    >
      <h2 id="abfrage">Kennzeichen abfragen</h2>
      <RdwCheck />

      <h2 id="daten">Was die RDW-Daten zeigen</h2>
      <p>
        Die RDW (Dienst Wegverkeer) führt das niederländische Fahrzeugregister und stellt Teile
        davon als{' '}
        <a href={RDW_SOURCE.url} {...external}>
          offene Daten{NEW_TAB}
        </a>{' '}
        bereit, gemeinfrei und ohne Anmeldung. KaufCheck zeigt daraus:
      </p>
      <ul>
        <li>die Erstzulassung und die erste Zulassung in den Niederlanden;</li>
        <li>ob das Auto als ausgeführt gemeldet ist und ob die RDW es als Taxi kennzeichnet;</li>
        <li>das Urteil der RDW über die Kilometerstände, mit ihrer Erläuterung;</li>
        <li>Rückrufe, die für dieses Kennzeichen offen oder als erledigt gemeldet sind;</li>
        <li>Mängel und Hinweise der APK seit Juni 2022, mit Datum.</li>
      </ul>
      <p>
        Ein ausgeführtes Auto bleibt nur eine Zeit lang in den offenen Daten; ist es schon länger
        weg, findet die Abfrage es nicht mehr. Was nach der Ausfuhr mit dem Auto geschah, steht
        ohnehin nicht darin.
      </p>

      <h2 id="tacho">Das Urteil über den Kilometerstand</h2>
      <p>
        In den Niederlanden müssen von der RDW anerkannte Betriebe den Kilometerstand an die RDW
        melden, etwa bei APK, Reparatur, Wartung und Reifenwechsel, beim Halterwechsel und bei der
        Ausfuhr (
        <a href={RDW_ODOMETER_URL} {...external}>
          RDW: Tellerstanden{NEW_TAB}
        </a>
        ). Ist jeder Stand höher als der davor, urteilt die RDW „logisch“. Ist ein Stand niedriger
        als der davor, kann der Tacho zurückgedreht oder ein Tippfehler gemacht worden sein; das
        Urteil „unlogisch“ darf die RDW nur für Messungen nach dem 1. Januar 2014 abgeben. Kein
        Urteil gibt es zum Beispiel, wenn der Tacho ersetzt wurde oder das Auto vorher außerhalb der
        Niederlande registriert war. KaufCheck zeigt die Erläuterung der RDW zu jedem Urteil, ins
        Deutsche übersetzt.
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
        <li>Die Kilometerstände selbst – nur das Urteil über den Verlauf.</li>
        <li>Halter und ihre Zahl: Personenbezogene Daten veröffentlicht die RDW nicht.</li>
        <li>
          APK-Termine ohne Befund und Prüfungen vor Juni 2022: Die Daten nennen nur Prüfungen, bei
          denen seitdem ein Mangel oder Hinweis notiert wurde.
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
        (kentekenbewijs, seit 2014 meist eine Karte) und auf den Kennzeichenschildern, solange das
        Auto sie noch trägt – manchmal auch auf älteren Fotos im Inserat. Ist das Auto schon in
        Deutschland zugelassen, frag den Verkäufer, ob er das alte Kennzeichen kennt, etwa aus den
        Unterlagen der Einfuhr.
      </p>
    </GuideLayout>
  );
}
