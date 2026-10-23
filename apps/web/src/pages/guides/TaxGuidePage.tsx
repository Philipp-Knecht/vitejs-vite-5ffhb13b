import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import { EMPTY_TAX_FORM, type TaxFormValues } from '../../features/tax/form';
import { Financing } from '../../features/tax/Financing';
import { TaxCalculator } from '../../features/tax/TaxCalculator';
import { useHydrated } from '../../lib/use-hydrated';
import { GuideLayout, type TocEntry } from './GuideLayout';

const TOC: TocEntry[] = [
  { id: 'rechner', title: 'Rechner' },
  { id: 'unterhalt', title: 'Laufende Kosten' },
  { id: 'finanzierung', title: 'Finanzierung' },
  { id: 'so-wird-gerechnet', title: 'So wird gerechnet' },
  { id: 'werte', title: 'Wo stehen die Werte?' },
  { id: 'elektro', title: 'Elektroautos' },
  { id: 'zahlung', title: 'Zahlung und Halterwechsel' },
  { id: 'typklasse', title: 'Versicherung und Typklasse' },
];

/** The GDV's own, free Typklassen lookup (KaufCheck shows no values itself). */
const GDV_TYPKLASSEN_URL = 'https://www.dieversicherer.de/versicherer/auto/typklassenabfrage';

const DRIVE_PARAMS: Record<string, TaxFormValues['drive']> = {
  benzin: 'petrol',
  diesel: 'diesel',
  elektro: 'electric',
};

/**
 * Prefill from a link such as /kfz-steuer-rechner?ez=2016-09&antrieb=diesel
 * (from a check). A full date is taken over; a month from a listing is only
 * shown as a hint, because the exact day matters (e.g. for electric cars).
 */
function fromParams(params: URLSearchParams): {
  initial: TaxFormValues;
  hint: string | null;
  model: { makeId: string; model: string; kw: number | null } | null;
} {
  const ez = params.get('ez') ?? '';
  const month = /^(\d{4})-(\d{2})$/.exec(ez);
  const makeId = params.get('marke') ?? '';
  const model = (params.get('modell') ?? '').slice(0, 80);
  const kw = Number(params.get('kw'));
  return {
    model:
      /^[a-z0-9-]{1,40}$/.test(makeId) && model
        ? { makeId, model, kw: Number.isInteger(kw) && kw > 0 && kw <= 2000 ? kw : null }
        : null,
    initial: {
      ...EMPTY_TAX_FORM,
      firstRegistration: /^\d{4}-\d{2}-\d{2}$/.test(ez) ? ez : '',
      drive: DRIVE_PARAMS[params.get('antrieb') ?? ''] ?? '',
    },
    hint: month ? `${month[2]}/${month[1]}` : null,
  };
}

export function TaxGuidePage() {
  const hydrated = useHydrated();
  const [params] = useSearchParams();
  // Prerendered without parameters; a prefilled link is read once the page runs in the browser.
  const prefill = useMemo(
    () => (hydrated ? fromParams(params) : { initial: EMPTY_TAX_FORM, hint: null, model: null }),
    [hydrated, params],
  );

  return (
    <GuideLayout
      path="/kfz-steuer-rechner"
      eyebrow="Kfz-Steuer-Rechner"
      title="Kfz-Steuer für einen Gebrauchtwagen berechnen"
      updated="Oktober 2026"
      toc={TOC}
      intro={
        <p>
          Die Kfz-Steuer hängt von Erstzulassung, Antrieb, Hubraum und CO₂-Ausstoß ab. Mit den
          Werten aus dem Fahrzeugschein rechnet KaufCheck sie nach dem Kraftfahrzeugsteuergesetz aus
          – direkt in deinem Browser, ohne dass etwas gespeichert wird.
        </p>
      }
    >
      <h2 id="rechner">Rechner</h2>
      <TaxCalculator
        key={`${hydrated}-${params.toString()}`}
        initial={prefill.initial}
        listingRegistration={prefill.hint}
        listingModel={prefill.model}
      />

      <h2 id="finanzierung">Finanzierung durchrechnen</h2>
      <p>
        Finanzierst du das Auto, rechnest du hier mit den Zahlen aus dem Angebot die Monatsrate und
        die Kreditkosten aus. Zinsen und Gebühren sind Kosten, die zu den laufenden Kosten
        dazukommen; die Tilgung ist der Kaufpreis, nur in Raten.
      </p>
      <Financing />

      <h2 id="so-wird-gerechnet">So wird gerechnet</h2>
      <p>Maßgeblich ist das Datum der Erstzulassung (§ 9 Kraftfahrzeugsteuergesetz):</p>
      <ul>
        <li>
          <strong>Ab 2021:</strong> je angefangene 100 cm³ Hubraum 2 € (Benziner) oder 9,50 €
          (Diesel). Dazu kommt jedes Gramm CO₂ über 95 g/km, gestaffelt: bis 115 g/km 2 €, bis 135
          g/km 2,20 €, bis 155 g/km 2,50 €, bis 175 g/km 2,90 €, bis 195 g/km 3,40 € und darüber 4 €
          je Gramm.
        </li>
        <li>
          <strong>Juli 2009 bis 2020:</strong> derselbe Hubraum-Anteil plus 2 € für jedes Gramm CO₂
          über 120 g/km (Erstzulassung bis 2011), über 110 g/km (2012 und 2013) oder über 95 g/km
          (ab 2014).
        </li>
        <li>
          <strong>Bis Juni 2009:</strong> nur nach Hubraum und Schadstoffklasse, z. B. bei Euro 3
          oder besser 6,75 € (Benziner) oder 15,44 € (Diesel) je angefangene 100 cm³, bei Euro 2
          7,36 € oder 16,05 €, bei Euro 1 15,13 € oder 27,35 €. Für schwere Pkw mit „/II“ oder
          „/III“ gelten Besonderheiten (siehe unten). Für Autos mit Erstzulassung vom 05.11.2008 bis
          30.06.2009 gilt der CO₂-Tarif, wenn er günstiger ist.
        </li>
      </ul>
      <p>Der Jahresbetrag wird auf volle Euro abgerundet.</p>

      <h2 id="werte">Wo stehen die Werte?</h2>
      <p>Alles steht in der Zulassungsbescheinigung Teil I (Fahrzeugschein):</p>
      <ul>
        <li>Feld B: Datum der Erstzulassung</li>
        <li>Feld P.1: Hubraum in cm³</li>
        <li>Feld V.7: CO₂-Ausstoß in g/km</li>
        <li>
          Feld 14 und Schlüsselnummer 14.1: Emissionsklasse (nur für Erstzulassungen vor Juli 2009
          wichtig; im alten Fahrzeugschein die letzten zwei Ziffern im Feld „zu 1“). Ein „/II“ oder
          „/III“ kennzeichnet schwere Pkw über 2,5 t: Bei Euro 2 und Euro 3 (ohne D4) gilt für sie
          der Satz der nächstschlechteren Stufe; Euro 4/II und Euro 4/III zählen wie Euro 3 oder
          besser.
        </li>
        <li>Feld F.2: zulässiges Gesamtgewicht (für Elektroautos)</li>
      </ul>
      <p>
        Steht im Fahrzeugschein nur die Schlüsselnummer, hilft diese Zuordnung: 30–33, 36–48 und
        53–70 sowie Euro 5 und 6 zählen als „Euro 3 oder besser“; 25–27, 35, 49–52 und 71 als „Euro
        2“; 01, 02, 11–14, 16, 18, 21, 22, 28, 29, 34 und 77 als „Euro 1“; 17, 19, 20, 23 und 24 als
        „ozonbefreit“; alle anderen zahlen den höchsten Satz.
      </p>

      <h2 id="elektro">Elektroautos</h2>
      <p>
        Elektroautos mit Erstzulassung vom 18.05.2011 bis 31.12.2030 sind zehn Jahre ab der
        Erstzulassung steuerfrei, längstens bis 31.12.2035 (§ 3d KraftStG). Die Befreiung bleibt
        beim Halterwechsel erhalten. Danach richtet sich die Steuer nach dem Gesamtgewicht und ist
        um die Hälfte ermäßigt.
      </p>

      <h2 id="zahlung">Zahlung und Halterwechsel</h2>
      <p>
        Die Steuer zieht der Zoll per Lastschrift ein, in der Regel für ein Jahr im Voraus; bei der
        Zulassung gibst du dafür ein SEPA-Mandat ab. Über 500 € im Jahr darfst du halbjährlich
        zahlen (3 % Aufschlag), über 1.000 € auch vierteljährlich (6 % Aufschlag, § 11 KraftStG).
        Meldet der Verkäufer das Auto ab oder um, endet seine Steuerpflicht, und deine beginnt mit
        deiner Zulassung. Mehr zum Ablauf steht im Ratgeber{' '}
        <Link to="/gebrauchtwagen-kaufen">Gebrauchtwagen privat kaufen</Link>.
      </p>

      <h2 id="typklasse">Versicherung und Typklasse</h2>
      <p>
        Wie viel die Kfz-Versicherung kostet, hängt unter anderem von der Typklasse ab. Der
        Gesamtverband der Deutschen Versicherungswirtschaft (GDV) ermittelt sie jedes Jahr aus den
        Schäden, die mit den einzelnen Fahrzeugtypen entstanden sind – getrennt für Haftpflicht
        (Klassen 10 bis 25), Teilkasko (10 bis 33) und Vollkasko (10 bis 34). Eine höhere Klasse
        bedeutet meist einen höheren Beitrag. Die neuen Typklassen erscheinen meist im September.
        Versicherer können sie gleich für neue Verträge verwenden, bei bestehenden meist ab dem 1.
        Januar; verbindlich sind sie für die Versicherer nicht.
      </p>
      <p>
        Die Typklasse gilt nicht für ein Modell insgesamt, sondern für jede Variante – zwei Motoren
        desselben Modells können weit auseinanderliegen. Du brauchst dafür zwei Nummern aus dem
        Fahrzeugschein: die Herstellerschlüsselnummer (HSN, Feld 2.1, vier Ziffern) und die
        Typschlüsselnummer (TSN, die ersten drei Zeichen in Feld 2.2). Im alten Fahrzeugschein
        stehen sie in den Feldern „zu 2“ und „zu 3“. Frag den Verkäufer danach, bevor du kaufst.
      </p>
      <p>
        <a href={GDV_TYPKLASSEN_URL} target="_blank" rel="noopener noreferrer">
          Typklasse beim GDV abfragen
          <span className="visually-hidden"> (öffnet in neuem Tab)</span>
        </a>{' '}
        – kostenlos, mit HSN und TSN oder nach Marke und Modell. Was du am Ende zahlst, zeigt erst
        das Angebot einer Versicherung; dabei zählen auch Regionalklasse und Schadenfreiheitsklasse.
      </p>
    </GuideLayout>
  );
}
