import { findMake } from '@kaufcheck/catalog';
import { EMPTY_SALE_CONTRACT, type AnalysisDto, type SaleContractValues } from '@kaufcheck/shared';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useAnalysis } from '../../api/queries';
import { Alert } from '../../components/ui/Alert';
import { SaleContractForm } from '../../features/sale-contract/SaleContractForm';
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
    powerKw: vehicle?.powerKw ? String(vehicle.powerKw) : '',
  };
}

function Form() {
  const hydrated = useHydrated();
  const [params] = useSearchParams();
  const param = hydrated ? params.get('analyse') : null;
  const analysisId = param && UUID.test(param) ? param : null;
  const analysis = useAnalysis(analysisId ?? '', analysisId !== null);
  const initial = useMemo(
    () => (analysis.data ? fromAnalysis(analysis.data) : EMPTY_SALE_CONTRACT),
    [analysis.data],
  );

  return (
    <>
      {analysis.data && (
        <p className="muted">
          Fahrzeugdaten aus deiner Prüfung übernommen – vergleicht sie mit dem Fahrzeugschein.
          Angaben zum Zustand aus dem Inserat stehen bewusst nicht im Vertrag: Was gilt, erklärt der
          Verkäufer selbst.
        </p>
      )}
      {analysis.isError && (
        <p className="muted">
          Die Prüfung konnte nicht geladen werden. Trag die Angaben selbst ein.
        </p>
      )}
      <SaleContractForm key={analysis.data?.id ?? 'empty'} initial={initial} />
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
      intro={
        <p>
          Mit diesem Vertrag haltet ihr beim Autokauf von privat alles Wichtige schriftlich fest:
          wer kauft und verkauft, welches Auto, was der Verkäufer über den Zustand weiß, Preis,
          Übergabe und Ummeldung. Füll aus, was du schon weißt – den Rest tragt ihr bei der Übergabe
          von Hand ein.
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
          Den Tachostand bei der Übergabe – und getrennt davon, was der Verkäufer über die
          tatsächliche Laufleistung weiß
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
        Körper und Gesundheit, nicht bei grober Fahrlässigkeit oder Vorsatz und nicht für eine
        Garantie. Ein Ausschluss ohne diese Ausnahmen kann insgesamt unwirksam sein; deshalb sind
        sie im Vertrag ausdrücklich genannt.
      </p>
      <p>
        Vor allem gilt der Ausschluss nicht für das, was ihr als Beschaffenheit vereinbart. Sagt der
        Verkäufer im Vertrag „unfallfrei“ oder nennt er eine Laufleistung, muss das stimmen – auch
        wenn die Gewährleistung sonst ausgeschlossen ist. So hat es der Bundesgerichtshof
        entschieden, zuletzt etwa für eine Angabe im Inserat (
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
        Besitzzeit gibt er nur an, soweit sie ihm bekannt sind.
      </p>
      <p>
        Mängel, die im Vertrag stehen, kennt der Käufer beim Kauf – wegen dieser Mängel hat er
        später keine Rechte. Deshalb sollten sie so genau wie möglich beschrieben sein.
      </p>

      <h2 id="uebergabe">Bei der Übergabe</h2>
      <ul>
        <li>
          Lass dir den Ausweis des Verkäufers zeigen. Steht in der Zulassungsbescheinigung Teil II
          jemand anderes als Halter, lass dir das erklären.
        </li>
        <li>Vergleiche die FIN im Vertrag und in den Papieren mit der Nummer am Auto.</li>
        <li>
          Lies den Tachostand gemeinsam ab und trag ihn mit Uhrzeit ins Übergabeprotokoll ein.
        </li>
        <li>
          Übergeben werden Auto, Schlüssel und Fahrzeugbrief erst, wenn der Kaufpreis vollständig
          bezahlt ist – bar oder per Überweisung, die schon auf dem Konto ist.
        </li>
        <li>Druckt den Vertrag zweimal aus; jeder unterschreibt beide Exemplare.</li>
      </ul>

      <h2 id="nach-dem-verkauf">Nach dem Verkauf</h2>
      <p>
        Der Verkäufer meldet den Verkauf unverzüglich seiner Kfz-Versicherung und der
        Zulassungsbehörde, mit Namen und Anschrift des Käufers. Erst wenn diese Veräußerungsanzeige
        bei der Zulassungsbehörde eingegangen ist oder das Auto umgemeldet wurde, endet für ihn die
        Kfz-Steuer. Der Kaufvertrag allein reicht dafür nicht.
      </p>
      <p>
        Die Kfz-Versicherung geht mit dem Auto auf den Käufer über. Er kann sie kündigen und eine
        eigene abschließen; für die Ummeldung braucht er ohnehin eine eVB-Nummer seiner
        Versicherung. Was bei der Zulassung noch zu tun ist, steht im Ratgeber{' '}
        <Link to="/gebrauchtwagen-kaufen">Gebrauchtwagen privat kaufen</Link>.
      </p>
    </GuideLayout>
  );
}
