import { findMake } from '@kaufcheck/catalog';
import {
  mergeListingIntoContract,
  EMPTY_SALE_CONTRACT,
  linkedPower,
  saleContractFromListing,
  type AnalysisDto,
  type SaleContractValues,
} from '@kaufcheck/shared';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useAnalysis } from '../../api/queries';
import { Alert } from '../../components/ui/Alert';
import { PageLoading } from '../../components/ui/Spinner';
import { readSaleContractDraft } from '../../features/sale-contract/draft';
import { SaleContractForm } from '../../features/sale-contract/SaleContractForm';
import {
  latestListingTextDraft,
  listingChangedSinceContract,
  listingInContract,
  markListingInContract,
} from '../../features/selling/draft';
import { useHydrated } from '../../lib/use-hydrated';
import { GuideLayout, type TocEntry } from './GuideLayout';

const TOC: TocEntry[] = [
  { id: 'vertrag', title: 'Vertrag ausfüllen' },
  { id: 'inhalt-des-vertrags', title: 'Was im Vertrag steht' },
  { id: 'gewaehrleistung', title: 'Gewährleistung beim Privatkauf' },
  { id: 'uebergabe', title: 'Bei der Übergabe' },
  { id: 'nach-dem-verkauf', title: 'Nach dem Verkauf' },
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Only objective vehicle data from a check: make, model, first registration,
 * fuel and power. What a listing says about the condition or the mileage is
 * no agreement and is not copied into the contract.
 */
function fromAnalysis(dto: AnalysisDto): SaleContractValues {
  const vehicle = dto.listing.vehicle;
  const registration = vehicle?.firstRegistration;
  return {
    ...EMPTY_SALE_CONTRACT,
    make: (findMake(vehicle?.make)?.name ?? vehicle?.make ?? '').slice(0, 100),
    model: (vehicle?.model ?? '').slice(0, 100),
    firstRegistration: registration
      ? registration.month
        ? `${String(registration.month).padStart(2, '0')}/${registration.year}`
        : String(registration.year)
      : '',
    fuel: vehicle?.fuel ?? '',
    ...linkedPower('kw', vehicle?.powerKw ? String(vehicle.powerKw) : ''),
  };
}

function Form() {
  const hydrated = useHydrated();
  const [params] = useSearchParams();
  const param = hydrated ? params.get('analyse') : null;
  const analysisId = param && UUID.test(param) ? param : null;
  const analysis = useAnalysis(analysisId ?? '', analysisId !== null);
  // From the listing text written on „Auto verkaufen“, kept in memory only.
  const [listing] = useState(() => latestListingTextDraft());
  const fromListing = !analysisId && hydrated && params.has('inserat');
  const takeOver = fromListing && listing !== null;
  // A listing changed since the last handover updates what was typed into the contract.
  const [listingChanged] = useState(() => listing !== null && listingChangedSinceContract(listing));
  // One contract per car: another car's listing starts a new contract.
  const contractSource = `listing:${listing?.source ?? ''}`;
  const [previous] = useState(() => (listing ? listingInContract(listing) : null));
  const [hadContract] = useState(() => readSaleContractDraft(contractSource) !== null);
  const merged = takeOver && listingChanged && hadContract;
  useEffect(() => {
    if (takeOver) markListingInContract(listing);
  }, [takeOver, listing]);
  const initial = useMemo(
    () =>
      analysis.data
        ? fromAnalysis(analysis.data)
        : takeOver
          ? saleContractFromListing(listing.values)
          : EMPTY_SALE_CONTRACT,
    [analysis.data, takeOver, listing],
  );

  // Wait for the prefill: arriving later, it would replace what was typed meanwhile.
  if (analysisId && analysis.isPending)
    return (
      <>
        <PageLoading label="Angaben aus der Prüfung …" />
        <p className="muted">
          Dauert es zu lange? <Link to="/kaufvertrag">Ohne Angaben aus der Prüfung ausfüllen</Link>
        </p>
      </>
    );

  return (
    <>
      {analysis.data && (
        <p className="muted">
          Fahrzeugdaten aus deiner Prüfung übernommen – vergleicht sie mit dem Fahrzeugschein.
          Angaben zum Zustand aus dem Inserat übernimmt KaufCheck nicht. Sie können trotzdem als
          vereinbart gelten (BGH, VIII ZR 161/23): Tragt ein, was davon gelten soll, und schreibt
          unter „Weitere Vereinbarungen“, was inzwischen nicht mehr stimmt.
        </p>
      )}
      {fromListing &&
        (listing ? (
          <p className="muted">
            {merged
              ? 'Dein Inseratstext hat sich geändert: Was du hier nicht selbst geändert hast, ist neu übernommen. Prüf vor allem die Angaben zum Zustand und „Weitere bekannte Mängel“.'
              : 'Fahrzeugdaten und Angaben zum Zustand aus deinem Inseratstext übernommen. Prüf sie mit dem Fahrzeugschein; den Tachostand tragt ihr bei der Übergabe ein.'}{' '}
            Was nur im Inserat steht – etwa Wartung, Umbauten, Ausstattung und Rauchen –, kann
            trotzdem als vereinbart gelten; was davon nicht mehr stimmt, schreibt unter „Weitere
            Vereinbarungen“.{' '}
            <Link to={`/auto-verkaufen${listing.source ? `?auto=${listing.source}` : ''}#inserat`}>
              Zurück zum Inseratstext
            </Link>
          </p>
        ) : (
          <p className="muted">
            Hier ist kein Inseratstext von dir: Er bleibt nur in diesem Tab, bis du die Seite neu
            lädst. Trag die Angaben selbst ein.
          </p>
        ))}
      {analysis.isError && (
        <p className="muted">
          Die Prüfung konnte nicht geladen werden. Trag die Angaben selbst ein.
        </p>
      )}
      <SaleContractForm
        key={analysis.data?.id ?? (takeOver ? contractSource : 'empty')}
        initial={initial}
        source={analysis.data?.id ?? (takeOver ? contractSource : '')}
        applyToRestored={
          takeOver && listingChanged
            ? (values) => mergeListingIntoContract(values, previous, listing.values)
            : undefined
        }
      />
    </>
  );
}

export function SaleContractPage() {
  return (
    <GuideLayout
      path="/kaufvertrag"
      eyebrow="Kaufvertrag"
      title="Kaufvertrag für den privaten Autokauf"
      updated="Oktober 2026"
      toc={TOC}
      ads={false}
      intro={
        <p>
          Mit diesem Vertrag haltet ihr beim Autokauf von privat alles Wichtige schriftlich fest:
          wer kauft und verkauft, welches Auto, was der Verkäufer über den Zustand weiß, Preis,
          Übergabe und Ummeldung. Füll aus, was du schon weißt – den Rest tragt ihr bei der Übergabe
          von Hand ein. Das fertige PDF erstellst du mit KaufCheck Pro.
        </p>
      }
    >
      <Alert tone="info" title="Ein Muster, keine Rechtsberatung">
        <p>
          KaufCheck stellt eine allgemeine Vorlage für Verträge zwischen Privatleuten bereit und
          prüft weder eure Angaben noch eure Vereinbarungen. Lest den Vertrag vor der Unterschrift
          gemeinsam und in Ruhe durch. Geht es um viel Geld oder ist etwas unklar, hilft eine
          Anwältin oder ein Anwalt, eine Verbraucherzentrale oder – als Mitglied – dein
          Automobilclub.
        </p>
      </Alert>

      <h2 id="vertrag">Vertrag ausfüllen</h2>
      <Form />

      <h2 id="inhalt-des-vertrags">Was im Vertrag steht</h2>
      <ul>
        <li>Name, Anschrift, Geburtsdatum und Ausweisnummer von Verkäufer und Käufer</li>
        <li>
          Das Auto mit Fahrzeug-Identifizierungsnummer (FIN), Kennzeichen, Erstzulassung und Nummer
          des Fahrzeugbriefs
        </li>
        <li>
          Den abgelesenen Tachostand – und getrennt davon die Gesamtlaufleistung: fest vereinbart
          oder so, wie der Verkäufer sie kennt
        </li>
        <li>
          Die Angaben des Verkäufers zu Unfällen, gewerblicher Nutzung, Import, Motor und offenen
          Rückrufen sowie alle bekannten Mängel
        </li>
        <li>Preis, Bezahlung, Übergabe, Schlüssel, Unterlagen und Zubehör</li>
        <li>Wer das Auto bis wann ummeldet und wer bis dahin Steuer und Versicherung trägt</li>
        <li>Ein Übergabeprotokoll mit Quittung auf einer eigenen Seite</li>
      </ul>

      <h2 id="gewaehrleistung">Gewährleistung beim Privatkauf</h2>
      <p>
        Wer privat verkauft, darf die Haftung für Sachmängel ausschließen – das ist üblich und steht
        auch in diesem Vertrag. Der Ausschluss hat aber Grenzen, die das Gesetz vorgibt: Er gilt
        nicht, wenn der Verkäufer einen Mangel arglistig verschweigt, nicht für Schäden an Leben,
        Körper und Gesundheit, nicht für Schadensersatz bei grober Fahrlässigkeit oder Vorsatz und
        nicht für eine Garantie. Ein Ausschluss ohne diese Ausnahmen kann insgesamt unwirksam sein;
        deshalb sind sie im Vertrag ausdrücklich genannt.
      </p>
      <p>
        Vor allem gilt der Ausschluss nicht für das, was ihr als Beschaffenheit vereinbart. Sagt der
        Verkäufer im Vertrag „unfallfrei“ oder vereinbart ihr eine Laufleistung fest, muss das
        stimmen – auch wenn die Gewährleistung sonst ausgeschlossen ist. So hat es der
        Bundesgerichtshof entschieden, zuletzt etwa für eine Angabe im Inserat (noch zum bis 2021
        geltenden Recht;
        <a
          href="https://www.bundesgerichtshof.de/SharedDocs/Pressemitteilungen/DE/2024/2024082.html"
          target="_blank"
          rel="noopener noreferrer"
        >
          Urteil vom 10. April 2024, VIII ZR 161/23
          <span className="visually-hidden"> (öffnet in neuem Tab)</span>
        </a>
        ). Deshalb fragt der Vertrag diese Punkte einzeln ab, und deshalb gibt es „Nicht bekannt“:
        Ein Verkäufer soll nur bestätigen, was er wirklich weiß. Unfälle aus der Zeit vor seiner
        Besitzzeit gibt er nur an, soweit sie ihm bekannt sind; nennt er die Laufleistung nur „nach
        seiner Kenntnis“, haftet er nur, wenn er es besser wusste.
      </p>
      <p>
        Mängel, die im Vertrag stehen, gehören zur vereinbarten Beschaffenheit – wegen dieser Mängel
        hat der Käufer später keine Rechte. Deshalb sollten sie so genau wie möglich beschrieben
        sein.
      </p>
      <p>
        Ob der Vertrag dabei als Allgemeine Geschäftsbedingung gilt, hängt davon ab, wer ihn zur
        Unterschrift vorschlägt. Sucht ihr das Muster gemeinsam aus und hätte jeder auch einen
        anderen Vertrag vorschlagen können, ist er in der Regel keine. Die Klauseln sind für beide
        Fälle formuliert; eine Prüfung eures Einzelfalls ersetzt das nicht.
      </p>

      <h2 id="uebergabe">Bei der Übergabe</h2>
      <ul>
        <li>
          Lass dir den Ausweis des Verkäufers zeigen. Steht in der Zulassungsbescheinigung Teil II
          jemand anderes, lass dir das erklären; wer für jemanden verkauft, braucht eine Vollmacht.
        </li>
        <li>Vergleiche die FIN im Vertrag und in den Papieren mit der Nummer am Auto.</li>
        <li>
          Lies den Tachostand gemeinsam ab und trag ihn mit Uhrzeit ins Übergabeprotokoll ein.
        </li>
        <li>
          Übergeben werden Auto, Schlüssel und Fahrzeugbrief erst, wenn der Kaufpreis vollständig
          bezahlt ist – bar oder per Überweisung, die schon auf dem Konto ist.
        </li>
        <li>
          Streicht nicht benutzte Zeilen und Kästchen durch, setzt eure Kürzel auf jede Seite und
          unterschreibt beide Exemplare.
        </li>
      </ul>

      <h2 id="nach-dem-verkauf">Nach dem Verkauf</h2>
      <p>
        Kfz-Steuer zahlt, für wen das Auto zugelassen ist. Für den Verkäufer endet sie mit der
        Umschreibung auf den Käufer oder der Abmeldung (
        <a
          href="https://www.zoll.de/DE/Privatpersonen/Kraftfahrzeugsteuer/Beginn-und-Ende-der-Steuerpflicht/beginn-und-ende-der-steuerpflicht_node.html"
          target="_blank"
          rel="noopener noreferrer"
        >
          Zoll: Beginn und Ende der Steuerpflicht
          <span className="visually-hidden"> (öffnet in neuem Tab)</span>
        </a>
        ). Die Anzeige des Verkaufs bei der Zulassungsbehörde beendet sie nicht, ermöglicht der
        Behörde aber, die Ummeldung durchzusetzen. Am sichersten meldet ihr das Auto vor der
        Übergabe ab oder geht gemeinsam zur Zulassungsstelle. Seiner Kfz-Versicherung meldet der
        Verkäufer den Verkauf unverzüglich.
      </p>
      <p>
        Die Kfz-Versicherung geht mit dem Auto auf den Käufer über. Er kann sie innerhalb eines
        Monats nach dem Erwerb, also der Übergabe, kündigen und eine eigene abschließen; für die
        Ummeldung braucht er ohnehin eine eVB-Nummer seiner Versicherung. Was bei der Zulassung noch
        zu tun ist, steht im Ratgeber{' '}
        <Link to="/gebrauchtwagen-kaufen">Gebrauchtwagen privat kaufen</Link>.
      </p>
    </GuideLayout>
  );
}
