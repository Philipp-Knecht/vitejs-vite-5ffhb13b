import type { ChecklistItem, ChecklistSection } from '@kaufcheck/shared';
import type { VehicleRuleContext } from './rule-context';

function item(id: string, label: string, hint: string | null = null): ChecklistItem {
  return { id, label, hint };
}

/**
 * Inspection checklist ("Besichtigung"). Item ids are stable so that the
 * user's ticks (stored locally in the browser) survive re-analysis.
 */
export function buildInspectionChecklist(ctx: VehicleRuleContext): ChecklistSection[] {
  const { vehicle } = ctx;
  const old = ctx.ageMonths !== null && ctx.ageMonths >= 96;
  const highMileage = vehicle.mileageKm !== null && vehicle.mileageKm >= 150_000;

  const documents: ChecklistItem[] = [
    item(
      'docs.registration_certificate',
      'Fahrzeugschein (Zulassungsbescheinigung Teil I)',
      'FIN mit der Nummer am Fahrzeug vergleichen.',
    ),
    item(
      'docs.title',
      'Fahrzeugbrief (Zulassungsbescheinigung Teil II)',
      'Ist der Verkäufer eingetragen? Anzahl der Halter ansehen.',
    ),
    item('docs.hu_report', 'HU-Bericht', 'Mängel und Kilometerstand der letzten Prüfung ansehen.'),
    item('docs.service_records', 'Serviceunterlagen', 'Serviceheft oder digitale Servicehistorie.'),
    item('docs.invoices', 'Rechnungen', 'Größere Reparaturen und Wartungen belegen lassen.'),
  ];
  if (ctx.isElectrified) {
    documents.push(
      item(
        'docs.battery_report',
        'Batteriezertifikat (State of Health)',
        'Zeigt den Zustand der Hochvoltbatterie.',
      ),
    );
  }
  if (ctx.signals.tuningMentions.length > 0) {
    documents.push(item('docs.modifications', 'Eintragungen bzw. ABE für Umbauten'));
  }

  const exterior: ChecklistItem[] = [
    item(
      'ext.paint',
      'Lack auf Farbunterschiede prüfen',
      'Bei Tageslicht, am besten schräg über die Flächen schauen.',
    ),
    item(
      'ext.gaps',
      'Spaltmaße prüfen',
      'Ungleichmäßige Spalten können auf Reparaturen hindeuten.',
    ),
    item('ext.glass', 'Scheiben prüfen', 'Steinschläge und Risse, besonders im Sichtfeld.'),
    item('ext.tires', 'Reifen prüfen', 'Profiltiefe, gleichmäßiger Abrieb, Alter (DOT-Nummer).'),
    item('ext.lights', 'Beleuchtung prüfen', 'Scheinwerfer, Blinker, Bremslichter, Rückfahrlicht.'),
  ];
  if (old) {
    exterior.push(
      item('ext.rust', 'Auf Rost prüfen', 'Schweller, Radläufe, Türunterkanten, Unterboden.'),
    );
  }
  if (ctx.isElectrified) {
    exterior.push(item('ext.charging_port', 'Ladeanschluss und Ladekabel prüfen'));
  }

  const sections: ChecklistSection[] = [
    { id: 'documents', title: 'Dokumente', items: documents },
    { id: 'exterior', title: 'Außen', items: exterior },
  ];

  if (vehicle.fuel !== 'electric') {
    sections.push({
      id: 'engine_bay',
      title: 'Motorraum',
      items: [
        item(
          'engine.oil',
          'Ölstand und Ölzustand prüfen',
          'Milchiger Belag am Öldeckel ansehen und nachfragen.',
        ),
        item(
          'engine.leaks',
          'Auf Undichtigkeiten achten',
          'Ölspuren am Motor und unter dem Fahrzeug.',
        ),
        item('engine.coolant', 'Kühlflüssigkeit prüfen', 'Stand und Farbe; keine Ölschlieren.'),
      ],
    });
  }

  const interior: ChecklistItem[] = [
    item(
      'int.electronics',
      'Elektronik testen',
      'Fensterheber, Spiegel, Infotainment, Assistenzsysteme.',
    ),
    item('int.climate', 'Klimaanlage testen', 'Kühlt sie spürbar? Riecht es muffig?'),
    item('int.seats', 'Sitze testen', 'Verstellung, Sitzheizung, Zustand der Polster.'),
    item(
      'int.warning_lights',
      'Warnleuchten prüfen',
      'Leuchten beim Zündung-Einschalten auf und gehen danach aus?',
    ),
    item('int.odometer', 'Kilometerstand am Tacho mit dem Inserat vergleichen'),
  ];
  if (highMileage || (vehicle.mileageKm !== null && vehicle.mileageKm < 60_000 && old)) {
    interior.push(
      item(
        'int.wear_consistency',
        'Abnutzung passend zur Laufleistung?',
        'Lenkrad, Schaltknauf, Pedale und Fahrersitz ansehen.',
      ),
    );
  }
  sections.push({ id: 'interior', title: 'Innenraum', items: interior });

  const testDrive: ChecklistItem[] = [
    item(
      'drive.cold_start',
      'Kaltstart',
      'Motor sollte beim Eintreffen kalt sein. Startet er sauber?',
    ),
    item('drive.brakes', 'Bremsen', 'Gleichmäßig, ohne Ziehen oder Rubbeln.'),
    item('drive.straight', 'Geradeauslauf', 'Zieht das Fahrzeug zu einer Seite?'),
    item('drive.steering', 'Lenkung', 'Kein Spiel, keine Geräusche beim Einlenken.'),
    item(
      'drive.gearbox',
      'Getriebe',
      vehicle.transmission === 'automatic'
        ? 'Schaltet die Automatik ruckfrei – kalt und warm?'
        : vehicle.transmission === 'manual'
          ? 'Lassen sich alle Gänge sauber schalten? Rutscht die Kupplung?'
          : 'Sauberes Schalten ohne Rucken oder Geräusche.',
    ),
    item(
      'drive.noises',
      'Ungewöhnliche Geräusche',
      'Klappern, Pfeifen oder Brummen bei verschiedenen Geschwindigkeiten.',
    ),
  ];
  if (vehicle.drivetrain === 'awd') {
    testDrive.push(
      item(
        'drive.awd',
        'Enge Kurven langsam fahren',
        'Keine Verspannungen oder knackenden Geräusche.',
      ),
    );
  }
  if (vehicle.fuel === 'diesel') {
    testDrive.push(
      item('drive.smoke', 'Abgase beim Beschleunigen beobachten', 'Kein starker Rauch.'),
    );
  }
  if (ctx.isElectrified) {
    testDrive.push(
      item(
        'drive.charging',
        'Laden testen',
        'Startet der Ladevorgang? Welche Ladeleistung wird erreicht?',
      ),
    );
  }
  testDrive.push(item('drive.after', 'Nach der Fahrt: Warnleuchten und Undichtigkeiten prüfen'));
  sections.push({ id: 'test_drive', title: 'Probefahrt', items: testDrive });

  sections.push({
    id: 'purchase',
    title: 'Kauf & Übergabe',
    items: [
      item(
        'buy.contract',
        'Schriftlicher Kaufvertrag',
        'Zum Beispiel ein Mustervertrag eines Automobilclubs.',
      ),
      item(
        'buy.promises',
        'Zusagen im Vertrag festhalten',
        'Kilometerstand, Unfallfreiheit, bekannte Mängel.',
      ),
      item('buy.keys_documents', 'Alle Schlüssel und Papiere erhalten'),
      item('buy.payment', 'Bezahlung erst bei Übergabe'),
    ],
  });

  return sections;
}
