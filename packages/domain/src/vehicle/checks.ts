import { FUEL_LABELS, type CheckItem, type EvidenceType } from '@kaufcheck/shared';
import { formatEuro, formatKm } from '../format';
import type { VehicleRuleContext } from './rule-context';

function check(
  id: string,
  title: string,
  detail: string,
  basis: string | null,
  evidence: EvidenceType | null,
): CheckItem {
  return { id, title, detail, basis, evidence, origin: 'rules' };
}

/**
 * Checks worth doing for this vehicle regardless of whether there is any
 * evidence of a problem ("Prüfhinweise"). Phrased as things to verify –
 * never as claims about defects.
 */
export function collectChecks(ctx: VehicleRuleContext): CheckItem[] {
  const { vehicle, listing } = ctx;
  const specific: CheckItem[] = [];
  const mileage = vehicle.mileageKm;

  if (mileage !== null && mileage >= 100_000) {
    specific.push(
      check(
        'service_records_mileage',
        'Wartungsnachweise ansehen',
        `Bei einer Laufleistung von ${formatKm(mileage)} solltest du nach Wartungsnachweisen fragen und prüfen, ob die Inspektionen regelmäßig gemacht wurden.`,
        'Kilometerstand laut Inserat',
        'listing_fact',
      ),
    );
  } else if (vehicle.serviceHistory === null) {
    specific.push(
      check(
        'service_records_unknown',
        'Wartungsnachweise ansehen',
        'Das Inserat sagt nichts über die Wartung. Frag nach Serviceheft und Rechnungen.',
        'Servicehistorie nicht angegeben',
        'unknown',
      ),
    );
  }

  if (vehicle.serviceHistory === 'documented' || vehicle.serviceHistory === 'claimed') {
    specific.push(
      check(
        'verify_service_claim',
        'Wartungsangaben belegen lassen',
        'Lass dir Serviceheft oder Rechnungen zeigen – „scheckheftgepflegt“ oder „regelmäßig gewartet“ ist zunächst nur eine Angabe des Verkäufers.',
        'Wartung laut Inserat',
        'listing_fact',
      ),
    );
  }

  if (vehicle.accidentHistory === 'accident_free') {
    specific.push(
      check(
        'confirm_accident_free',
        '„Unfallfrei“ schriftlich festhalten',
        'Lass dir die Unfallfreiheit im Kaufvertrag bestätigen. Dann ist sie eine vereinbarte Eigenschaft des Fahrzeugs.',
        'Unfallfrei laut Inserat',
        'listing_fact',
      ),
    );
  }

  if (mileage !== null && mileage >= 150_000) {
    specific.push(
      check(
        'wear_parts',
        'Verschleißteile genauer prüfen',
        'Bei dieser Laufleistung stehen Kupplung (bei Schaltgetriebe), Bremsen, Stoßdämpfer, Fahrwerk und Auspuff häufiger an. Kalkuliere mögliche Kosten ein.',
        'Kilometerstand laut Inserat',
        'listing_fact',
      ),
    );
  }

  if (ctx.ageMonths !== null && ctx.ageMonths >= 120) {
    specific.push(
      check(
        'rust',
        'Auf Rost achten',
        'Bei Fahrzeugen ab etwa zehn Jahren lohnt ein Blick auf Schweller, Radläufe, Türunterkanten und den Unterboden.',
        'Alter seit Erstzulassung',
        'calculation',
      ),
    );
  }

  if (vehicle.transmission === 'automatic') {
    specific.push(
      check(
        'automatic_transmission',
        'Automatikgetriebe bei der Probefahrt prüfen',
        'Achte auf ruckfreie Gangwechsel – kalt und warm – und frag nach dem letzten Getriebeölwechsel.',
        'Automatikgetriebe laut Inserat',
        'listing_fact',
      ),
    );
  }

  if (vehicle.transmission === 'manual' && mileage !== null && mileage >= 100_000) {
    specific.push(
      check(
        'clutch',
        'Kupplung prüfen',
        'Achte auf den Greifpunkt und darauf, ob die Kupplung beim kräftigen Beschleunigen in einem hohen Gang rutscht.',
        'Schaltgetriebe und Kilometerstand laut Inserat',
        'listing_fact',
      ),
    );
  }

  if (
    vehicle.fuel === 'diesel' &&
    (vehicle.firstRegistration === null || vehicle.firstRegistration.year >= 2008)
  ) {
    specific.push(
      check(
        'diesel_particulate_filter',
        'Dieselpartikelfilter im Blick behalten',
        'Frag nach dem bisherigen Fahrprofil. Viel Kurzstrecke kann den Partikelfilter belasten; achte auf entsprechende Warnleuchten.',
        `Kraftstoff: ${FUEL_LABELS.diesel}`,
        'listing_fact',
      ),
    );
  }

  if (ctx.isElectrified) {
    specific.push(
      check(
        'battery_health',
        'Zustand der Hochvoltbatterie klären',
        'Lass dir einen aktuellen Batterietest (State of Health) zeigen und kläre, wie lange die Batteriegarantie noch läuft.',
        `Kraftstoff: ${vehicle.fuel ? FUEL_LABELS[vehicle.fuel] : 'elektrisch'}`,
        'listing_fact',
      ),
    );
  }

  if (ctx.isCombustion && vehicle.fuel !== null && mileage !== null && mileage >= 90_000) {
    specific.push(
      check(
        'timing_drive',
        'Zahnriemen bzw. Steuerkette',
        'Falls der Motor einen Zahnriemen hat: Frag, wann er zuletzt gewechselt wurde. Ein überfälliger Wechsel kann teuer werden.',
        'Kilometerstand laut Inserat',
        'listing_fact',
      ),
    );
  }

  if (vehicle.huUntil || ctx.signals.huNew) {
    specific.push(
      check(
        'hu_report',
        'HU-Bericht ansehen',
        'Im Bericht der letzten Hauptuntersuchung stehen festgestellte Mängel und der Kilometerstand zum Prüfzeitpunkt.',
        'HU laut Inserat',
        'listing_fact',
      ),
    );
  }

  if (vehicle.powerPs !== null && vehicle.powerPs >= 250) {
    specific.push(
      check(
        'high_performance',
        'Leistungsstarkes Fahrzeug',
        'Achte auf den Zustand von Bremsen, Reifen und Fahrwerk und frag, wie das Fahrzeug bisher genutzt wurde.',
        'Leistung laut Inserat',
        'listing_fact',
      ),
    );
  }

  if (vehicle.drivetrain === 'awd') {
    specific.push(
      check(
        'all_wheel_drive',
        'Allradantrieb',
        'Die Reifen sollten gleichmäßig abgefahren sein. Frag, ob der Allradantrieb nach Herstellervorgabe gewartet wurde.',
        'Allradantrieb laut Inserat',
        'listing_fact',
      ),
    );
  }

  if (ctx.signals.tuningMentions.length > 0) {
    specific.push(
      check(
        'modifications',
        'Eintragungen von Umbauten prüfen',
        'Prüfe, ob Umbauten in den Papieren eingetragen sind oder eine ABE bzw. ein Teilegutachten vorliegt.',
        'Umbauten laut Beschreibung',
        'listing_fact',
      ),
    );
  }

  if (ctx.signals.importMention) {
    specific.push(
      check(
        'import_vehicle',
        'Importfahrzeug',
        'Prüfe Herkunft, Servicehistorie und Dokumente besonders genau. Ausstattung und Herstellergarantie können abweichen.',
        'Import laut Beschreibung',
        'listing_fact',
      ),
    );
  }

  if (listing.seller.type === 'private') {
    specific.push(
      check(
        'private_sale',
        'Privatkauf: Gewährleistung meist ausgeschlossen',
        'Privatverkäufer schließen die Sachmängelhaftung meist aus. Umso wichtiger sind eine gründliche Besichtigung, eine Probefahrt und im Zweifel ein unabhängiger Gebrauchtwagen-Check.',
        'Privater Anbieter laut Inserat',
        'listing_fact',
      ),
    );
  } else if (listing.seller.type === 'commercial') {
    specific.push(
      check(
        'dealer_sale',
        'Kauf vom Händler',
        'Als Verbraucher hast du beim Händler gesetzliche Gewährleistungsrechte, die bei Gebrauchtwagen nur eingeschränkt verkürzt werden können. Lass dir Zusagen schriftlich geben.',
        'Gewerblicher Anbieter laut Inserat',
        'listing_fact',
      ),
    );
  }

  const price = listing.price;
  if (price && price.kind !== 'give_away' && price.amountEur >= 3000) {
    specific.push(
      check(
        'independent_inspection',
        'Unabhängigen Gebrauchtwagen-Check erwägen',
        `Bei einem Preis von ${formatEuro(price.amountEur)} kann sich ein Check bei einer Prüforganisation, einem Automobilclub oder einer Werkstatt lohnen.`,
        'Preis laut Inserat',
        'listing_fact',
      ),
    );
  }

  const general: CheckItem[] = [
    check(
      'documents',
      'Papiere und Fahrzeug abgleichen',
      'Vergleiche die Fahrzeug-Identifizierungsnummer (FIN) in der Zulassungsbescheinigung Teil I mit der FIN am Fahrzeug und prüfe, ob der Verkäufer in Teil II (Fahrzeugbrief) eingetragen ist.',
      null,
      null,
    ),
    check(
      'safe_payment',
      'Sicher bezahlen',
      'Zahle nichts im Voraus, bevor du das Fahrzeug gesehen hast. Bezahlung und Übergabe von Fahrzeug, Schlüsseln und Papieren am besten gleichzeitig.',
      null,
      null,
    ),
  ];

  return [...specific, ...general];
}
