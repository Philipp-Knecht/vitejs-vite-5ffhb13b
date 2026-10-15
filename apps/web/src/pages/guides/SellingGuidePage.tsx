import { EMPTY_LISTING_TEXT, type ListingTextValues } from '@kaufcheck/shared';
import { useMemo, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useMe, useOwnedCars } from '../../api/queries';
import { PageLoading } from '../../components/ui/Spinner';
import { listingTextFromCar } from '../../features/selling/from-car';
import { ListingTextForm } from '../../features/selling/ListingTextForm';
import { useHydrated } from '../../lib/use-hydrated';
import { GuideLayout, type TocEntry } from './GuideLayout';

const TOC: TocEntry[] = [
  { id: 'vorbereiten', title: 'Vorbereiten' },
  { id: 'inserat', title: 'Inseratstext schreiben' },
  { id: 'besichtigung', title: 'Besichtigung und Probefahrt' },
  { id: 'bezahlung', title: 'Sicher bezahlen lassen' },
  { id: 'uebergabe', title: 'Kaufvertrag und Übergabe' },
  { id: 'nach-dem-verkauf', title: 'Nach dem Verkauf' },
];

/** A source on another website, opened in a new tab. */
function Source({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <span className="visually-hidden"> (öffnet in neuem Tab)</span>
    </a>
  );
}

/** „Marke, Modell und Erstzulassung“: what the prefill actually filled. */
function prefilledFields(values: ListingTextValues): string {
  const names = [
    'Marke',
    'Modell',
    values.firstRegistration && 'Erstzulassung',
    values.fuel && 'Kraftstoff',
    values.huUntil && 'HU',
  ].filter(Boolean);
  return `${names.slice(0, -1).join(', ')} und ${names.at(-1)}`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Form() {
  const hydrated = useHydrated();
  const [params] = useSearchParams();
  const param = hydrated ? params.get('auto') : null;
  const carId = param && UUID.test(param) ? param : null;
  const me = useMe();
  const signedIn = Boolean(me.data?.user);
  const cars = useOwnedCars(carId !== null && signedIn);
  const car = carId ? cars.data?.items.find((item) => item.id === carId) : undefined;
  const initial = useMemo(() => (car ? listingTextFromCar(car) : EMPTY_LISTING_TEXT), [car]);

  // Wait for the prefill: arriving later, it would replace what was typed meanwhile.
  if (carId && (me.isPending || (signedIn && cars.isPending)))
    return (
      <>
        <PageLoading label="Daten aus „Mein Auto“ …" />
        <p className="muted">
          Dauert es zu lange?{' '}
          <Link to="/auto-verkaufen#inserat">Ohne Daten aus „Mein Auto“ ausfüllen</Link>
        </p>
      </>
    );

  return (
    <>
      {' '}
      {car && (
        <p className="muted">
          {prefilledFields(initial)} aus „Mein Auto“ übernommen. Den Kilometerstand liest du am
          besten frisch vom Tacho ab.
        </p>
      )}
      {carId && !car && (
        <p className="muted">
          Das Auto aus „Mein Auto“ konnte nicht geladen werden. Trag die Angaben selbst ein.
        </p>
      )}
      <ListingTextForm key={car?.id ?? 'empty'} initial={initial} source={car?.id ?? ''} />
    </>
  );
}

export function SellingGuidePage() {
  return (
    <GuideLayout
      path="/auto-verkaufen"
      eyebrow="Auto verkaufen"
      title="Auto privat verkaufen"
      updated="Oktober 2026"
      toc={TOC}
      ads={false}
      intro={
        <p>
          Wer sein Auto privat verkauft, erzielt meist mehr als beim Händler – und trägt dafür die
          Arbeit selbst: Unterlagen, Inserat, Besichtigung, Vertrag und Abmeldung. Hier steht, was
          in welcher Reihenfolge zu tun ist. Den Inseratstext erstellst du mit KaufCheck Pro aus
          deinen Angaben.
        </p>
      }
    >
      <h2 id="vorbereiten">Vorbereiten</h2>
      <p>Leg alles bereit, bevor du inserierst – Käufer fragen danach, und es schafft Vertrauen:</p>
      <ul>
        <li>Zulassungsbescheinigung Teil I (Fahrzeugschein) und Teil II (Fahrzeugbrief)</li>
        <li>Bericht der letzten Hauptuntersuchung</li>
        <li>Serviceheft oder Wartungsnachweise und Rechnungen über Reparaturen</li>
        <li>Alle Schlüssel, die Bedienungsanleitung und bei Elektroautos die Ladekabel</li>
        <li>
          Bei Importautos die Übereinstimmungsbescheinigung (CoC), bei Anbauteilen die Allgemeine
          Betriebserlaubnis (ABE) oder das Teilgutachten
        </li>
        <li>Unterlagen zu reparierten Unfallschäden, etwa Rechnungen oder Gutachten</li>
      </ul>
      <p>
        Den Preis legst du selbst fest. KaufCheck hat keine Marktdaten; vergleiche dein Auto mit
        ähnlichen Angeboten auf den großen Plattformen – gleiches Modell, ähnliches Baujahr,
        ähnliche Laufleistung und Ausstattung – und entscheide, ob du einen Festpreis oder
        „Verhandlungsbasis“ (VB) angibst.
      </p>
      <p>
        Für die Fotos: Tageslicht, ruhiger Hintergrund, das Auto von allen Seiten, dazu Innenraum,
        Kofferraum, Motorraum und Tachostand. Fotografiere auch Mängel – das erspart Diskussionen
        bei der Besichtigung. Mach das Kennzeichen unkenntlich, und veröffentliche weder die
        Fahrzeug-Identifizierungsnummer (FIN) noch Fotos deiner Papiere: Betrüger können damit in
        deinem Namen auftreten oder dich mit angeblichen FIN-Berichten abzocken (Polizeiliche
        Kriminalprävention:{' '}
        <Source href="https://www.polizei-beratung.de/themen-und-tipps/sicherer-autokauf/betrug-beim-autoverkauf/fin-abfrage/">
          FIN-Abfrage
        </Source>
        ,{' '}
        <Source href="https://www.polizei-beratung.de/themen-und-tipps/sicherer-autokauf/betrug-beim-autoverkauf/versand-vertraulicher-dokumente/">
          Versand vertraulicher Dokumente
        </Source>
        ).
      </p>

      <h2 id="inserat">Inseratstext schreiben</h2>
      <p>
        Was im Inserat steht, kann als vereinbart gelten – auch wenn ihr die Haftung für Mängel im
        Vertrag ausschließt. So hat es der Bundesgerichtshof für die Angabe „Klimaanlage
        funktioniert einwandfrei“ in einem privaten Inserat gesehen, noch zum bis 2021 geltenden
        Recht (
        <Source href="https://www.bundesgerichtshof.de/SharedDocs/Pressemitteilungen/DE/2024/2024082.html">
          Urteil vom 10. April 2024, VIII ZR 161/23
        </Source>
        ). Schreib deshalb nur, was du sicher weißt, und nenn bekannte Mängel offen: Wer einen
        Mangel arglistig verschweigt, haftet trotz Ausschluss (§ 444 BGB). Weißt du etwas nicht,
        etwa ob das Auto vor deiner Zeit einen Unfall hatte, schreib genau das – nicht „unfallfrei“.
      </p>
      <p>
        Der Generator unten fragt das Wichtigste ab, was Käufer im Inserat suchen, und formuliert es
        vorsichtig. Die Fragen zur Vorgeschichte sind dieselben wie im{' '}
        <Link to="/kaufvertrag">Kaufvertrag</Link>. Auch die Felder der Plattform, etwa
        „unfallfrei“, sind Angaben zum Auto: Stell sie passend zu deinem Text ein. Speichere das
        veröffentlichte Inserat als Screenshot oder PDF; dann ist klar, was darin stand.
      </p>
      <Form />

      <h2 id="besichtigung">Besichtigung und Probefahrt</h2>
      <ul>
        <li>
          Lass dir vor der Probefahrt Personalausweis und Führerschein zeigen und notier Name,
          Anschrift und die Nummern. Eine Kopie des Ausweises darfst du nur mit Einverständnis
          machen, und sie muss als Kopie erkennbar sein (
          <Source href="https://www.gesetze-im-internet.de/pauswg/__20.html">§ 20 PAuswG</Source>).
        </li>
        <li>
          Haltet in einer kurzen Probefahrtvereinbarung fest, wer fährt, wann und mit welchem
          Kennzeichen – und wer bei einem Unfall die Selbstbeteiligung trägt. Frag vorher deine
          Versicherung, ob andere Fahrer mitversichert sind.
        </li>
        <li>
          Fahr mit und gib die Schlüssel nicht aus der Hand. Wer sein Auto für eine Probefahrt
          allein überlässt und es nicht zurückbekommt, kann es endgültig verlieren, wenn der Täter
          es an jemanden verkauft, der davon nichts weiß (
          <Source href="https://www.bundesgerichtshof.de/SharedDocs/Pressemitteilungen/DE/2020/2020122.html">
            BGH, Urteil vom 18. September 2020, V ZR 8/19
          </Source>
          ).
        </li>
        <li>
          Zeig Unterlagen vor Ort, aber schick keine Kopien oder Scans deiner Papiere per E-Mail
          oder Messenger (
          <Source href="https://www.polizei-beratung.de/themen-und-tipps/sicherer-autokauf/betrug-beim-autoverkauf/versand-vertraulicher-dokumente/">
            Polizeiliche Kriminalprävention
          </Source>
          ).
        </li>
      </ul>

      <h2 id="bezahlung">Sicher bezahlen lassen</h2>
      <ul>
        <li>
          Am sichersten ist Bargeld bei der Übergabe – an einem belebten Ort oder in deiner Bank, am
          besten mit Begleitung.
        </li>
        <li>
          Eine Echtzeitüberweisung kommt in Sekunden an und ist wie jede Überweisung grundsätzlich
          nicht widerruflich (
          <Source href="https://www.bundesbank.de/dynamic/action/de/aufgaben/unbarer-zahlungsverkehr/veroeffentlichungen/fragen-und-antworten-zu-echtzeitueberweisungen-und-empfaengerueberpruefung/963980/fragen-und-antworten-zu-echtzeitueberweisungen-und-empfaengerueberpruefung-">
            Deutsche Bundesbank
          </Source>
          ). Bei einer normalen Überweisung wartest du, bis das Geld auf deinem Konto gutgeschrieben
          ist. Ein Screenshot oder eine E-Mail mit „Zahlungsbestätigung“ beweist nichts.
        </li>
        <li>
          Vorsicht bei Käufern, die eine Spedition schicken, eine Zahlungsbestätigung per E-Mail
          vorlegen, einen Scheck über mehr als den Kaufpreis anbieten und den Rest zurückhaben
          wollen oder einen Treuhanddienst vorschlagen – typische Maschen (Polizeiliche
          Kriminalprävention:{' '}
          <Source href="https://www.polizei-beratung.de/themen-und-tipps/sicherer-autokauf/betrug-beim-autoverkauf/fahrzeuguebergabe-an-dritte/">
            Übergabe an Dritte
          </Source>
          ,{' '}
          <Source href="https://www.polizei-beratung.de/themen-und-tipps/sicherer-autokauf/betrug-beim-autoverkauf/scheckbetrug/">
            Scheckbetrug
          </Source>
          ;{' '}
          <Source href="https://www.adac.de/rund-ums-fahrzeug/auto-kaufen-verkaufen/kauftipps/auto-sicher-bezahlen/">
            ADAC: Auto sicher bezahlen
          </Source>
          ).
        </li>
        <li>
          Auto, Schlüssel und Fahrzeugbrief gibst du erst heraus, wenn der ganze Kaufpreis bezahlt
          ist.
        </li>
      </ul>

      <h2 id="uebergabe">Kaufvertrag und Übergabe</h2>
      <p>
        Schließt den Vertrag schriftlich, in zwei Exemplaren – etwa mit dem{' '}
        <Link to="/kaufvertrag">Kaufvertrag für den privaten Autokauf</Link>. Hast du oben einen
        Inseratstext erstellt, nimm den Link „Kaufvertrag mit diesen Angaben vorbereiten“ unter dem
        Text: Dann übernimmt der Vertrag deine Angaben. Darin steht auch, was ausgeschlossen ist und
        was nicht, und es gibt ein Übergabeprotokoll mit Tachostand und Quittung.
      </p>
      <p>
        Am einfachsten ist es, wenn du das Auto vor der Übergabe abmeldest: Dann laufen Steuer und
        Versicherung nicht auf deinen Namen weiter, und der Käufer meldet es neu an. Bleibt es
        zugelassen, vereinbart ihr im Vertrag, bis wann der Käufer es ummeldet, oder ihr geht
        gemeinsam zur Zulassungsstelle.
      </p>
      <p>
        Verkaufst du ein Auto aus deinem Betrieb, etwa als Selbständiger einen Firmenwagen, bist du
        kein Privatverkäufer: Gegenüber Privatleuten kannst du die Gewährleistung dann nicht
        ausschließen, bei Gebrauchtwagen nur unter Bedingungen auf ein Jahr verkürzen (
        <Source href="https://www.gesetze-im-internet.de/bgb/__476.html">§ 476 BGB</Source>). Der
        Inseratstext und der Kaufvertrag hier passen dann nicht.
      </p>

      <h2 id="nach-dem-verkauf">Nach dem Verkauf</h2>
      <ul>
        <li>
          <strong>Zulassungsbehörde:</strong> Hat der Käufer das Auto noch nicht umgemeldet, zeigst
          du den Verkauf unverzüglich an – mit Kennzeichen, Name und Anschrift des Käufers und
          seiner Bestätigung, dass er die Zulassungsbescheinigungen bekommen hat (
          <Source href="https://www.gesetze-im-internet.de/fzv_2023/__15.html">
            § 15 Abs. 5 FZV
          </Source>
          ). Meldet er es nicht um, kann die Behörde den Betrieb des Autos untersagen.
        </li>
        <li>
          <strong>Versicherung:</strong> Die Kfz-Versicherung geht mit dem Verkauf auf den Käufer
          über; er kann sie innerhalb eines Monats kündigen. Melde den Verkauf unverzüglich deiner
          Versicherung (das darf auch der Käufer). Für den Beitrag der laufenden
          Versicherungsperiode haftet ihr beide; kündigt der Käufer, zahlst nur du (
          <Source href="https://www.gesetze-im-internet.de/vvg_2008/__95.html">§§ 95–97</Source>,{' '}
          <Source href="https://www.gesetze-im-internet.de/vvg_2008/__122.html">122 VVG</Source>).
        </li>
        <li>
          <strong>Kfz-Steuer:</strong> Sie endet mit der Umschreibung auf den Käufer oder mit der
          Abmeldung, nicht schon mit der Verkaufsanzeige. Zu viel Gezahltes zahlt der Zoll zurück –
          automatisch, wenn du per Lastschrift zahlst; sonst teilst du dem Hauptzollamt deine
          Bankverbindung mit (
          <Source href="https://www.zoll.de/DE/Privatpersonen/Kraftfahrzeugsteuer/Beginn-und-Ende-der-Steuerpflicht/beginn-und-ende-der-steuerpflicht_node.html">
            Zoll: Beginn und Ende der Steuerpflicht
          </Source>
          ).
        </li>
        <li>
          <strong>Abmelden online:</strong> Das geht ohne Online-Ausweis, wenn der Fahrzeugschein ab
          2015 ausgestellt ist und die Kennzeichen Plaketten mit verdeckten Sicherheitscodes haben;
          du brauchst außerdem deine IBAN. Online kostet die Abmeldung 2,10 Euro, bei der
          Zulassungsstelle 15,90 Euro (
          <Source href="https://www.bmv.de/SharedDocs/DE/Artikel/StV/Strassenverkehr/internetbasierte-fahrzeugzulassung.html">
            Bundesverkehrsministerium: i-Kfz
          </Source>
          ,{' '}
          <Source href="https://www.gesetze-im-internet.de/stgebo_2011/anlage.html">
            Gebührenordnung, Nr. 224
          </Source>
          ). Den entwerteten Fahrzeugschein hebst du auf.
        </li>
        <li>
          <strong>Kennzeichen:</strong> Bei der Abmeldung kannst du es bis zu zwölf Monate
          reservieren lassen – nach{' '}
          <Source href="https://www.gesetze-im-internet.de/fzv_2023/__16.html">§ 16 FZV</Source>{' '}
          aber nur, um dasselbe Auto wieder zuzulassen. Willst du es für ein anderes Auto behalten,
          frag deine Zulassungsbehörde.
        </li>
        <li>
          Lösch deine Daten im Auto – gekoppelte Handys, Ziele im Navi, Konten in der App des
          Herstellers – und entferne das Auto aus <Link to="/mein-auto">„Mein Auto“</Link>.
        </li>
      </ul>
    </GuideLayout>
  );
}
