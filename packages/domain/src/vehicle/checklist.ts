import type { ChecklistItem, ChecklistSection } from '@kaufcheck/shared';
import type { VehicleRuleContext } from './rule-context';

function item(id: string, label: string, hint: string | null = null): ChecklistItem {
  return { id, label, hint };
}

/**
 * Checklist from the inspection to registration and the first steps after the
 * purchase. The user's ticks are stored per analysis in the browser by item
 * id, so ids must stay stable and unique.
 */
export function buildInspectionChecklist(ctx: VehicleRuleContext): ChecklistSection[] {
  const { vehicle } = ctx;
  const dealer = ctx.listing.seller.type === 'commercial';
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
      dealer
        ? 'Anzahl der Halter ansehen – der Händler selbst steht meist nicht drin.'
        : 'Ist der Verkäufer eingetragen? Anzahl der Halter ansehen.',
    ),
    item('docs.hu_report', 'HU-Bericht', 'Mängel und Kilometerstand der letzten Prüfung ansehen.'),
    item('docs.service_records', 'Serviceunterlagen', 'Serviceheft oder digitale Servicehistorie.'),
    item('docs.invoices', 'Rechnungen', 'Größere Reparaturen und Wartungen belegen lassen.'),
    item(
      'docs.recalls',
      'Rückrufe erledigt?',
      'Mit der FIN beim Hersteller oder in einer Vertragswerkstatt prüfen lassen.',
    ),
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
        dealer
          ? 'Zum Beispiel ein Mustervertrag eines Automobilclubs.'
          : 'Zum Beispiel ein Mustervertrag eines Automobilclubs, mit der Ausweisnummer des Verkäufers.',
      ),
      dealer
        ? item(
            'buy.identity',
            'Händler mit Firmenname und Anschrift im Vertrag',
            'So weißt du, wer dein Vertragspartner ist – auch wenn der Kontakt über ein Portal lief.',
          )
        : item(
            'buy.identity',
            'Ausweis des Verkäufers ansehen',
            'Der Name sollte zum Halter in den Fahrzeugpapieren passen. Weicht etwas ab, lass dir den Grund erklären – wer im Auftrag verkauft, braucht eine Vollmacht.',
          ),
      item(
        'buy.promises',
        'Zusagen im Vertrag festhalten',
        'Kilometerstand, Unfallfreiheit, bekannte Mängel.',
      ),
      item(
        'buy.handover_time',
        'Datum, Uhrzeit und Kilometerstand der Übergabe im Vertrag',
        'Ab diesem Zeitpunkt bist du für das Auto verantwortlich.',
      ),
      item('buy.keys_documents', 'Alle Schlüssel und Papiere erhalten'),
      item(
        'buy.payment',
        'Bezahlung erst bei Übergabe',
        'Zum Beispiel per Echtzeitüberweisung vor Ort oder bar in einer Bankfiliale; den Empfang im Vertrag bestätigen lassen.',
      ),
    ],
  });

  sections.push({
    id: 'registration',
    title: 'Versicherung & Zulassung',
    items: [
      item(
        'reg.evb',
        'eVB-Nummer bei deiner Versicherung anfordern',
        'Die elektronische Versicherungsbestätigung brauchst du für die Zulassung und für ein Kurzzeitkennzeichen – am besten schon vor der Abholung.',
      ),
      item(
        'reg.documents',
        'Unterlagen für die Zulassung bereitlegen',
        'Ausweis, Zulassungsbescheinigung Teil I und II, eVB-Nummer, HU-Nachweis, ein SEPA-Mandat für die Kfz-Steuer und die alten Kennzeichen, falls neue nötig sind. Lässt jemand anderes zu, braucht er eine Vollmacht, eine Kopie deines Ausweises und seinen eigenen.',
      ),
      item(
        'reg.register',
        'Auto unverzüglich auf dich umschreiben lassen',
        'Bei der Zulassungsstelle oder online mit Online-Ausweis, wenn beide Zulassungsbescheinigungen einen verdeckten Sicherheitscode haben. Die Codes erst im Online-Antrag freilegen – danach sind die Dokumente ungültig.',
      ),
      item(
        'reg.drive_home',
        'Heimfahrt klären',
        'Ist das Auto noch angemeldet, sprich Kennzeichen und Versicherung mit dem Verkäufer ab. Ist es abgemeldet: vorher auf dich zulassen oder ein Kurzzeitkennzeichen holen – nur mit eVB und gültiger HU, ohne HU nur zu einer Prüfstelle in der Nähe und zurück.',
      ),
    ],
  });

  sections.push({
    id: 'after_purchase',
    title: 'Nach dem Kauf',
    items: [
      item(
        'after.recalls',
        'Offene Rückrufe erledigen lassen',
        'In einer Vertragswerkstatt mit der FIN – die Reparatur ist in der Regel kostenlos.',
      ),
      item(
        'after.service',
        vehicle.serviceHistory === 'documented'
          ? 'Nächste Inspektion laut Wartungsnachweisen vormerken'
          : 'Inspektion und Ölwechsel machen lassen',
        vehicle.serviceHistory === 'documented'
          ? null
          : 'Ohne lückenlose Nachweise weißt du nicht, wann zuletzt gewartet wurde.',
      ),
      item('after.hu', 'Termin der nächsten Hauptuntersuchung notieren'),
    ],
  });

  return sections;
}
