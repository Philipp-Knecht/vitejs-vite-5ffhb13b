import type { Observation, SellerQuestion } from '@kaufcheck/shared';
import { formatKm } from '../format';
import { truncate } from '../text/text';
import type { VehicleRuleContext } from './rule-context';

type Priority = SellerQuestion['priority'];

function question(
  id: string,
  text: string,
  textInformal: string,
  reason: string,
  priority: Priority,
  relatedField: string | null = null,
): SellerQuestion {
  return { id, text, textInformal, reason, priority, relatedField, origin: 'rules' };
}

/**
 * Concrete, short and non-accusatory questions for the seller, derived from
 * missing information, conflicts and what matters for this vehicle.
 * Every question exists in a formal ("Sie") and an informal ("du") version.
 */
export function generateSellerQuestions(
  ctx: VehicleRuleContext,
  observations: readonly Observation[],
): SellerQuestion[] {
  const { vehicle, listing, signals } = ctx;
  const questions: SellerQuestion[] = [];
  const has = (id: string) => observations.some((item) => item.id === id);

  // Priority 1: missing basics and contradictions
  if (!listing.price || has('price_placeholder')) {
    questions.push(
      question(
        'price',
        'Was ist Ihr Preis für das Fahrzeug?',
        'Was ist dein Preis für das Auto?',
        'Kein verwertbarer Preis im Inserat.',
        1,
        'price',
      ),
    );
  }
  if (has('price_conflict')) {
    questions.push(
      question(
        'price_conflict',
        'Im Inserat stehen unterschiedliche Preise. Welcher Preis gilt?',
        'Im Inserat stehen unterschiedliche Preise. Welcher Preis gilt?',
        'Unterschiedliche Preisangaben im Inserat.',
        1,
        'price',
      ),
    );
  }
  if (vehicle.mileageKm === null) {
    questions.push(
      question(
        'mileage',
        'Wie hoch ist der aktuelle Kilometerstand?',
        'Wie hoch ist der aktuelle Kilometerstand?',
        'Kilometerstand nicht angegeben.',
        1,
        'mileageKm',
      ),
    );
  }
  const mileageConflict = observations.find((item) => item.id === 'mileage_conflict');
  if (mileageConflict) {
    const values = signals.mileageMentions.map((mention) => formatKm(mention.km));
    const stated = vehicle.mileageKm !== null ? formatKm(vehicle.mileageKm) : null;
    const pair = [
      ...new Set([stated, ...values].filter((value): value is string => value !== null)),
    ].slice(0, 2);
    const detail = pair.length === 2 ? ` (${pair[0]} und ${pair[1]})` : '';
    questions.push(
      question(
        'mileage_conflict',
        `Im Inserat stehen unterschiedliche Kilometerstände${detail}. Welcher Wert ist korrekt?`,
        `Im Inserat stehen unterschiedliche Kilometerstände${detail}. Welcher Wert stimmt?`,
        'Widersprüchliche Kilometerstände.',
        1,
        'mileageKm',
      ),
    );
  }
  if (!vehicle.firstRegistration) {
    questions.push(
      question(
        'first_registration',
        'Wann war die Erstzulassung?',
        'Wann war die Erstzulassung?',
        'Erstzulassung nicht angegeben.',
        1,
        'firstRegistration',
      ),
    );
  }
  if (vehicle.accidentHistory === null) {
    questions.push(
      question(
        'accident',
        'Ist das Fahrzeug unfallfrei, oder gab es (reparierte) Vorschäden?',
        'Ist das Auto unfallfrei, oder gab es (reparierte) Vorschäden?',
        'Keine Angabe zur Unfallfreiheit.',
        1,
        'accidentHistory',
      ),
    );
  } else if (vehicle.accidentHistory !== 'accident_free' || has('accident_conflict')) {
    questions.push(
      question(
        'accident_details',
        'Welche Schäden gab es genau, und wie wurden sie repariert? Gibt es Rechnungen dazu?',
        'Welche Schäden gab es genau, und wie wurden sie repariert? Gibt es Rechnungen dazu?',
        'Vorschaden oder widersprüchliche Angaben im Inserat.',
        1,
        'accidentHistory',
      ),
    );
  }
  if (vehicle.serviceHistory === null) {
    questions.push(
      question(
        'service_history',
        'Gibt es ein vollständiges Serviceheft bzw. Rechnungen über die Wartungen?',
        'Gibt es ein vollständiges Serviceheft bzw. Rechnungen über die Wartungen?',
        'Keine Angabe zur Servicehistorie.',
        1,
        'serviceHistory',
      ),
    );
  } else if (vehicle.serviceHistory === 'claimed') {
    questions.push(
      question(
        'service_proof',
        'Gibt es zu den Wartungen Rechnungen oder Einträge im Serviceheft?',
        'Gibt es zu den Wartungen Rechnungen oder Einträge im Serviceheft?',
        'Wartung erwähnt, aber ohne Nachweis.',
        1,
        'serviceHistory',
      ),
    );
  }
  const damage = signals.damageMentions[0];
  if (damage) {
    const term = truncate(damage.term, 40);
    questions.push(
      question(
        'damage_details',
        `Sie erwähnen „${term}“. Können Sie das genauer beschreiben oder ein Foto schicken?`,
        `Du erwähnst „${term}“. Kannst du das genauer beschreiben oder ein Foto schicken?`,
        'In der Beschreibung genannter Mangel.',
        1,
      ),
    );
  }
  for (const [id, field, label] of [
    ['fuel_conflict', 'fuel', 'zum Kraftstoff'],
    ['transmission_conflict', 'transmission', 'zum Getriebe'],
    ['power_conflict', 'power', 'zur Leistung'],
    ['registration_conflict', 'firstRegistration', 'zur Erstzulassung'],
  ] as const) {
    if (has(id)) {
      questions.push(
        question(
          id,
          `Im Inserat stehen unterschiedliche Angaben ${label}. Welche ist korrekt?`,
          `Im Inserat stehen unterschiedliche Angaben ${label}. Welche stimmt?`,
          'Widersprüchliche Angaben im Inserat.',
          1,
          field,
        ),
      );
    }
  }

  // Priority 2: important for this vehicle
  if (vehicle.previousOwners === null) {
    questions.push(
      question(
        'owners',
        'Wie viele Vorbesitzer hatte das Fahrzeug?',
        'Wie viele Vorbesitzer hatte das Auto?',
        'Anzahl der Vorbesitzer nicht angegeben.',
        2,
        'previousOwners',
      ),
    );
  }
  if (!vehicle.huUntil && !signals.huNew) {
    questions.push(
      question(
        'hu',
        'Wann ist die nächste Hauptuntersuchung (HU) fällig? Gibt es den letzten HU-Bericht?',
        'Wann ist die nächste Hauptuntersuchung (HU) fällig? Gibt es den letzten HU-Bericht?',
        'HU-Datum nicht angegeben.',
        2,
        'huUntil',
      ),
    );
  } else if (has('hu_expired')) {
    questions.push(
      question(
        'hu_expired',
        'Die HU ist abgelaufen. Sind Mängel bekannt, die für eine neue HU behoben werden müssten?',
        'Die HU ist abgelaufen. Sind Mängel bekannt, die für eine neue HU behoben werden müssten?',
        'HU laut Inserat abgelaufen.',
        2,
        'huUntil',
      ),
    );
  }
  if (vehicle.transmission === 'automatic') {
    questions.push(
      question(
        'gearbox_oil',
        'Wann wurde zuletzt das Getriebeöl gewechselt?',
        'Wann wurde zuletzt das Getriebeöl gewechselt?',
        'Automatikgetriebe laut Inserat.',
        2,
        'transmission',
      ),
    );
  }
  const mileage = vehicle.mileageKm;
  if (
    ctx.isCombustion &&
    vehicle.fuel !== null &&
    mileage !== null &&
    mileage >= 90_000 &&
    !signals.positives.some((p) => p.key === 'timing_renewed')
  ) {
    questions.push(
      question(
        'timing_drive',
        'Wurde der Zahnriemen bzw. die Steuerkette schon gewechselt? Wenn ja, bei welchem Kilometerstand?',
        'Wurde der Zahnriemen bzw. die Steuerkette schon gewechselt? Wenn ja, bei welchem Kilometerstand?',
        'Laufleistung laut Inserat.',
        2,
      ),
    );
  }
  if (mileage !== null && mileage >= 100_000) {
    questions.push(
      question(
        'last_service',
        'Wann war die letzte Inspektion, und was wurde dabei gemacht?',
        'Wann war die letzte Inspektion, und was wurde dabei gemacht?',
        'Hohe Laufleistung laut Inserat.',
        2,
        'serviceHistory',
      ),
    );
  }
  if (ctx.isElectrified && !signals.batteryInfo) {
    questions.push(
      question(
        'battery_health',
        'Gibt es einen aktuellen Nachweis über den Zustand der Batterie (State of Health)?',
        'Gibt es einen aktuellen Nachweis über den Zustand der Batterie (State of Health)?',
        'Elektrifizierter Antrieb laut Inserat.',
        2,
        'fuel',
      ),
    );
  }
  if (vehicle.fuel === 'diesel' && mileage !== null && mileage >= 120_000) {
    questions.push(
      question(
        'particulate_filter',
        'Wurde der Dieselpartikelfilter schon gereinigt oder getauscht?',
        'Wurde der Dieselpartikelfilter schon gereinigt oder getauscht?',
        'Diesel mit hoher Laufleistung.',
        2,
        'fuel',
      ),
    );
  }
  if (signals.tuningMentions.length > 0) {
    questions.push(
      question(
        'modifications',
        'Sind die Umbauten eingetragen, bzw. gibt es eine ABE dafür?',
        'Sind die Umbauten eingetragen, bzw. gibt es eine ABE dafür?',
        'Umbauten laut Beschreibung.',
        2,
      ),
    );
  }
  if (has('seller_type_mismatch')) {
    questions.push(
      question(
        'seller_type',
        'Verkaufen Sie das Fahrzeug privat oder gewerblich?',
        'Verkaufst du das Auto privat oder gewerblich?',
        'Unklar, ob privat oder gewerblich verkauft wird.',
        2,
      ),
    );
  }
  questions.push(
    question(
      'known_defects',
      'Gibt es bekannte Mängel oder Reparaturen, die demnächst anstehen?',
      'Gibt es bekannte Mängel oder Reparaturen, die demnächst anstehen?',
      'Grundsätzlich sinnvoll vor jeder Besichtigung.',
      2,
    ),
    question(
      'registered_keeper',
      'Sind Sie als Halter im Fahrzeugbrief eingetragen?',
      'Bist du als Halter im Fahrzeugbrief eingetragen?',
      'Grundsätzlich sinnvoll: Wer verkauft, sollte verfügungsberechtigt sein.',
      2,
    ),
  );

  // Priority 3: good to know before the viewing
  questions.push(
    question(
      'cold_start',
      'Kann ich das Fahrzeug bei der Besichtigung kalt starten?',
      'Kann ich das Auto bei der Besichtigung kalt starten?',
      'Ein Kaltstart zeigt Startverhalten und Geräusche am besten.',
      3,
    ),
  );
  if (!signals.testDriveOffered) {
    questions.push(
      question(
        'test_drive',
        'Ist eine Probefahrt möglich?',
        'Ist eine Probefahrt möglich?',
        'Im Inserat nicht erwähnt.',
        3,
      ),
    );
  }
  questions.push(
    question(
      'tires',
      signals.positives.some((p) => p.key === 'second_tire_set')
        ? 'Wie alt sind die Sommer- und Winterreifen (DOT-Nummer)?'
        : 'Wie alt sind die Reifen, und gibt es einen zweiten Satz Räder?',
      signals.positives.some((p) => p.key === 'second_tire_set')
        ? 'Wie alt sind die Sommer- und Winterreifen (DOT-Nummer)?'
        : 'Wie alt sind die Reifen, und gibt es einen zweiten Satz Räder?',
      'Reifen sind ein häufiger Kostenpunkt nach dem Kauf.',
      3,
    ),
    question(
      'keys',
      'Wie viele Fahrzeugschlüssel gibt es?',
      'Wie viele Autoschlüssel gibt es?',
      'Ersatzschlüssel sind teuer.',
      3,
    ),
  );

  const seen = new Set<string>();
  return questions.filter((item) => (seen.has(item.id) ? false : (seen.add(item.id), true)));
}
