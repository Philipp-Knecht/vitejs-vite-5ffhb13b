import { Printer } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '../../components/ui/Button';
import { GuideLayout, type TocEntry } from './GuideLayout';

interface Group {
  id: string;
  title: string;
  intro?: string;
  items: string[];
}

const GROUPS: Group[] = [
  {
    id: 'vorab',
    title: 'Vor der Besichtigung',
    intro: 'Das lässt sich am Inserat und am Telefon klären.',
    items: [
      'Erstzulassung, Kilometerstand und HU-Termin stehen fest',
      'Anzahl der Vorbesitzer ist bekannt',
      'Unfälle und reparierte Schäden sind erfragt',
      'Wartungsnachweise (Scheckheft, Rechnungen) sind vorhanden',
      'Grund für den Verkauf ist bekannt',
      'Versicherungsbeitrag und Kfz-Steuer für das Modell sind geprüft',
      'Termin bei Tageslicht vereinbart, Motor soll kalt sein',
    ],
  },
  {
    id: 'unterlagen',
    title: 'Unterlagen',
    items: [
      'Zulassungsbescheinigung Teil I und Teil II liegen vor',
      'Fahrzeug-Identifizierungsnummer stimmt in Papieren und am Auto überein',
      'Verkäufer ist der eingetragene Halter – oder der Grund ist nachvollziehbar',
      'Bericht der letzten Hauptuntersuchung ist vorhanden',
      'Kilometerstände in Nachweisen steigen plausibel an',
      'Zahl der Schlüssel entspricht den Angaben',
    ],
  },
  {
    id: 'karosserie',
    title: 'Karosserie und Unterboden',
    items: [
      'Spaltmaße sind gleichmäßig',
      'Keine Farbunterschiede zwischen einzelnen Teilen',
      'Kein Lacknebel an Gummis, Dichtungen oder Kunststoffteilen',
      'Kein Rost an Radläufen, Schwellern, Türunterkanten und Unterboden',
      'Scheiben ohne Risse im Sichtfeld',
      'Scheinwerfer und Leuchten sind klar und dicht',
    ],
  },
  {
    id: 'raeder',
    title: 'Reifen, Räder und Bremsen',
    items: [
      'Profiltiefe ausreichend und gleichmäßig abgefahren',
      'Reifenalter per DOT-Nummer geprüft',
      'Felgen ohne starke Beschädigungen',
      'Bremsscheiben ohne tiefe Riefen oder deutlichen Rand',
    ],
  },
  {
    id: 'motor',
    title: 'Motorraum',
    items: [
      'Ölstand im richtigen Bereich, Öl nicht milchig',
      'Kühlmittel auf richtigem Stand',
      'Keine feuchten Stellen, kein Ölnebel',
      'Kaltstart ohne Rasseln, Klopfen oder dauerhaften Rauch',
      'Warnleuchten gehen nach dem Start aus',
    ],
  },
  {
    id: 'innenraum',
    title: 'Innenraum und Elektrik',
    items: [
      'Verschleiß von Lenkrad, Pedalen und Sitz passt zur Laufleistung',
      'Kein muffiger Geruch, keine Nässe im Fußraum oder Kofferraum',
      'Klimaanlage kühlt, Heizung wärmt',
      'Fenster, Spiegel, Licht, Blinker, Hupe und Wischer funktionieren',
      'Radio, Navigation und Assistenzsysteme funktionieren',
    ],
  },
  {
    id: 'probefahrt',
    title: 'Probefahrt',
    items: [
      'Mindestens 20 Minuten mit Stadt, Landstraße und wenn möglich Autobahn',
      'Kupplung greift nicht erst ganz oben, Gänge lassen sich sauber schalten',
      'Automatik schaltet ohne Rucken',
      'Auto zieht beim Fahren und Bremsen nicht zur Seite',
      'Keine ungewöhnlichen Geräusche, kein Poltern über Unebenheiten',
      'Motortemperatur bleibt im normalen Bereich',
    ],
  },
  {
    id: 'kauf',
    title: 'Kaufvertrag und Übergabe',
    items: [
      'Schriftlicher Kaufvertrag mit allen Fahrzeug- und Personendaten',
      'Bekannte Mängel und Schäden sind im Vertrag aufgeführt',
      'Zusicherungen wie „unfallfrei“ stehen im Vertrag',
      'Bezahlung erst bei Übergabe, Empfang bestätigt',
      'Alle Schlüssel und Unterlagen übergeben',
      'Ummeldung oder Kurzzeitkennzeichen geklärt',
    ],
  },
];

const TOC: TocEntry[] = [
  ...GROUPS.map((group) => ({ id: group.id, title: group.title })),
  { id: 'tipps', title: 'So nutzt du die Liste' },
];

export function ChecklistGuidePage() {
  return (
    <GuideLayout
      path="/gebrauchtwagen-checkliste"
      eyebrow="Checkliste"
      title="Gebrauchtwagen-Checkliste zum Abhaken"
      updated="September 2026"
      toc={TOC}
      intro={
        <>
          <p>
            Diese Liste begleitet dich vom ersten Blick auf das Inserat bis zur Übergabe. Druck sie
            aus oder geh sie am Smartphone durch – so vergisst du auch unter Zeitdruck nichts
            Wichtiges.
          </p>
          <p className="no-print">
            <Button
              variant="secondary"
              icon={<Printer aria-hidden size={18} />}
              onClick={() => window.print()}
            >
              Checkliste drucken
            </Button>
          </p>
        </>
      }
    >
      {GROUPS.map((group) => (
        <section key={group.id} className="print-checklist" aria-labelledby={group.id}>
          <h2 id={group.id}>{group.title}</h2>
          {group.intro && <p>{group.intro}</p>}
          <ul className="tick-list">
            {group.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}

      <h2 id="tipps">So nutzt du die Liste</h2>
      <p>
        Nicht jeder Punkt ist ein Ausschlusskriterium. Ein abgefahrener Reifensatz oder eine bald
        fällige Inspektion sind ein Argument für die Preisverhandlung. Anders ist es bei Rost an
        tragenden Teilen, Hinweisen auf einen verschwiegenen Unfall oder fehlenden Papieren – dann
        solltest du im Zweifel lieber weitersuchen.
      </p>
      <p>
        Genauere Erklärungen zu jedem Prüfpunkt findest du in der{' '}
        <Link to="/auto-besichtigung-checkliste">Anleitung zur Besichtigung</Link>. Für ein
        konkretes Inserat erstellt <Link to="/">KaufCheck</Link> eine passende Checkliste mit
        Hinweisen, die sich aus den Angaben im Inserat ergeben.
      </p>
    </GuideLayout>
  );
}
