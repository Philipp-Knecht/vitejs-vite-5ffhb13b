import {
  FUEL_LABELS,
  TRANSMISSION_LABELS,
  type EvidenceType,
  type Observation,
} from '@kaufcheck/shared';
import { formatEuro, formatKm, formatNumber, formatYearMonth, joinGerman, plural } from '../format';
import { compareYearMonth } from '../text/dates';
import { parsePower } from '../text/numbers';
import type { DamageCategory, DamageMention } from './description-signals';
import type { VehicleRuleContext } from './rule-context';
import { DIESEL_TOKEN, PETROL_TOKEN } from './vocabulary';

type Severity = Observation['severity'];

function observation(
  id: string,
  title: string,
  detail: string,
  severity: Severity,
  evidence: EvidenceType,
  relatedFields: string[],
  quotes: string[] = [],
): Observation {
  return {
    id,
    title,
    detail,
    severity,
    evidence,
    origin: 'rules',
    relatedFields,
    quotes: quotes.slice(0, 4),
  };
}

function differsSignificantly(a: number, b: number): boolean {
  return Math.abs(a - b) > Math.max(3000, 0.05 * Math.max(a, b));
}

const MILEAGE_MAY_DEVIATE =
  /kann\s+(?:leicht\s+|etwas\s+)?abweichen|wird\s+(?:noch\s+)?(?:täglich\s+|aktuell\s+)?gefahren/i;

function mileageRules(ctx: VehicleRuleContext): Observation[] {
  const { vehicle, signals, listing } = ctx;
  const result: Observation[] = [];
  const stated = vehicle.mileageKm;
  const mentions = signals.mileageMentions;

  if (stated !== null && vehicle.fieldSources.mileageKm?.source === 'details') {
    const tolerant = MILEAGE_MAY_DEVIATE.test(listing.description ?? '');
    const conflict = mentions.find(
      (mention) =>
        differsSignificantly(mention.km, stated) &&
        !(tolerant && Math.abs(mention.km - stated) <= 0.1 * Math.max(mention.km, stated)),
    );
    if (conflict) {
      result.push(
        observation(
          'mileage_conflict',
          'Unterschiedliche Kilometerstände im Inserat',
          `In den Fahrzeugdetails stehen ${formatKm(stated)}, in der Beschreibung ${formatKm(
            conflict.km,
          )}. Frag nach, welcher Wert stimmt, und vergleiche ihn bei der Besichtigung mit dem Tacho und dem letzten HU-Bericht.`,
          'warning',
          'listing_fact',
          ['mileageKm'],
          [conflict.quote],
        ),
      );
    }
  } else if (mentions.length >= 2) {
    const [first, ...rest] = mentions;
    const other = first
      ? rest.find((mention) => differsSignificantly(mention.km, first.km))
      : undefined;
    if (first && other) {
      result.push(
        observation(
          'mileage_conflict',
          'Unterschiedliche Kilometerstände in der Beschreibung',
          `Die Beschreibung nennt ${formatKm(first.km)} und ${formatKm(
            other.km,
          )}. Frag nach, welcher Wert stimmt, und vergleiche ihn mit dem Tacho.`,
          'warning',
          'listing_fact',
          ['mileageKm'],
          [first.quote, other.quote],
        ),
      );
    }
  }

  if (stated !== null && stated < 1000 && ctx.ageMonths !== null && ctx.ageMonths >= 24) {
    result.push(
      observation(
        'mileage_placeholder',
        'Kilometerstand wirkt wie ein Platzhalter',
        `Angegeben sind ${formatKm(stated)} bei einem ${plural(
          Math.floor(ctx.ageMonths / 12),
          'Jahr',
          'Jahre',
        )} alten Fahrzeug. Frag nach dem tatsächlichen Kilometerstand.`,
        'notice',
        'calculation',
        ['mileageKm'],
      ),
    );
  }

  if (ctx.kmPerYear !== null && ctx.kmPerYear > 35_000) {
    result.push(
      observation(
        'annual_mileage_high',
        'Hohe jährliche Laufleistung',
        `Im Schnitt ${formatKm(ctx.kmPerYear)} pro Jahr. Das kann viel Langstrecke bedeuten und ist nicht per se schlecht – frag nach dem Nutzungsprofil und den Wartungsintervallen.`,
        'info',
        'calculation',
        ['mileageKm', 'firstRegistration'],
      ),
    );
  }
  if (
    ctx.kmPerYear !== null &&
    stated !== null &&
    stated >= 1000 &&
    ctx.ageMonths !== null &&
    ctx.ageMonths >= 48 &&
    ctx.kmPerYear < 3000
  ) {
    result.push(
      observation(
        'annual_mileage_low',
        'Sehr geringe Laufleistung für das Alter',
        `Im Schnitt ${formatKm(ctx.kmPerYear)} pro Jahr. Das kann plausibel sein (z. B. Zweitwagen). Frühere HU-Berichte und Werkstattrechnungen zeigen, wie sich der Kilometerstand entwickelt hat.`,
        'info',
        'calculation',
        ['mileageKm', 'firstRegistration'],
      ),
    );
  }
  return result;
}

function registrationRules(ctx: VehicleRuleContext): Observation[] {
  const { vehicle, signals, now } = ctx;
  const result: Observation[] = [];
  const registration = vehicle.firstRegistration;

  if (registration) {
    const current = { year: now.getFullYear(), month: now.getMonth() + 1 };
    if (compareYearMonth(registration, current) > 0) {
      result.push(
        observation(
          'registration_in_future',
          'Erstzulassung liegt in der Zukunft',
          `Als Erstzulassung ist ${formatYearMonth(registration)} angegeben. Vermutlich ist das ein Eingabefehler – frag nach dem richtigen Datum.`,
          'warning',
          'calculation',
          ['firstRegistration'],
        ),
      );
    }
    if (vehicle.fieldSources.firstRegistration?.source === 'details') {
      const conflict = signals.registrationMentions.find(
        (mention) =>
          mention.value.year !== registration.year ||
          (mention.value.month !== null &&
            registration.month !== null &&
            mention.value.month !== registration.month),
      );
      if (conflict) {
        result.push(
          observation(
            'registration_conflict',
            'Unterschiedliche Angaben zur Erstzulassung',
            `In den Fahrzeugdetails steht ${formatYearMonth(registration)}, in der Beschreibung ${formatYearMonth(
              conflict.value,
            )}. Die Zulassungsbescheinigung zeigt das richtige Datum.`,
            'notice',
            'listing_fact',
            ['firstRegistration'],
            [conflict.quote],
          ),
        );
      }
    }
    const buildYear = signals.buildYearMentions.find((mention) => mention.year > registration.year);
    if (buildYear) {
      result.push(
        observation(
          'build_year_after_registration',
          'Baujahr liegt nach der Erstzulassung',
          `Laut Beschreibung ist das Baujahr ${buildYear.year}, die Erstzulassung aber ${formatYearMonth(
            registration,
          )}. Eine der beiden Angaben stimmt vermutlich nicht.`,
          'notice',
          'listing_fact',
          ['firstRegistration'],
          [buildYear.quote],
        ),
      );
    }
  }
  return result;
}

function technicalConflictRules(ctx: VehicleRuleContext): Observation[] {
  const { vehicle, signals, listing } = ctx;
  const result: Observation[] = [];
  const title = listing.title ?? '';

  if (vehicle.fieldSources.fuel?.source === 'details' && title) {
    const diesel = DIESEL_TOKEN.exec(title)?.[0];
    const petrol = PETROL_TOKEN.exec(title)?.[0];
    const token =
      vehicle.fuel === 'petrol' && diesel
        ? diesel
        : vehicle.fuel === 'diesel' && petrol
          ? petrol
          : null;
    if (token && vehicle.fuel) {
      result.push(
        observation(
          'fuel_conflict',
          'Kraftstoffangabe passt nicht zum Titel',
          `Als Kraftstoff ist „${FUEL_LABELS[vehicle.fuel]}“ angegeben, der Titel enthält aber „${token}“, eine typische Bezeichnung für ${
            vehicle.fuel === 'petrol' ? 'Dieselmotoren' : 'Benzinmotoren'
          }. Frag nach, welche Angabe stimmt.`,
          'notice',
          'listing_fact',
          ['fuel'],
          [title],
        ),
      );
    }
  }

  if (vehicle.transmission && vehicle.fieldSources.transmission?.source === 'details') {
    const other = signals.transmissionMentions.find(
      (mention) =>
        (vehicle.transmission === 'manual' && mention.value === 'automatic') ||
        (vehicle.transmission === 'automatic' && mention.value === 'manual'),
    );
    if (other) {
      result.push(
        observation(
          'transmission_conflict',
          'Widersprüchliche Angaben zum Getriebe',
          `In den Fahrzeugdetails steht „${TRANSMISSION_LABELS[vehicle.transmission]}“, im Text ist von „${
            TRANSMISSION_LABELS[other.value]
          }“ die Rede. Frag nach, welches Getriebe verbaut ist.`,
          'notice',
          'listing_fact',
          ['transmission'],
          [other.quote],
        ),
      );
    }
  }

  const statedPs = vehicle.powerPs;
  if (statedPs !== null && vehicle.fieldSources.power?.source === 'details') {
    const conflict = signals.powerMentions.find((mention) => {
      const power = parsePower(`${mention.ps} PS`);
      return power !== null && Math.abs(power.ps - statedPs) > Math.max(10, statedPs * 0.08);
    });
    if (conflict) {
      const tuning = signals.tuningMentions.length > 0;
      result.push(
        observation(
          'power_conflict',
          'Unterschiedliche Leistungsangaben',
          `In den Fahrzeugdetails stehen ${formatNumber(statedPs)} PS, ${
            conflict.source === 'title' ? 'im Titel' : 'in der Beschreibung'
          } ${formatNumber(conflict.ps)} PS.${
            tuning
              ? ' Die Beschreibung erwähnt eine Leistungssteigerung – frag, ob sie eingetragen ist.'
              : ' Frag nach, welche Angabe stimmt; die Zulassungsbescheinigung nennt die Leistung in kW.'
          }`,
          'notice',
          'listing_fact',
          ['power'],
          [conflict.quote],
        ),
      );
    }
  }

  if (
    vehicle.previousOwners !== null &&
    vehicle.fieldSources.previousOwners?.source === 'details' &&
    signals.owners
  ) {
    if (signals.owners.count !== vehicle.previousOwners) {
      result.push(
        observation(
          'owners_conflict',
          'Unterschiedliche Angaben zu Vorbesitzern',
          `In den Fahrzeugdetails stehen ${plural(vehicle.previousOwners, 'Halter', 'Halter')}, die Beschreibung sagt etwas anderes. Die Zahl der Halter steht in der Zulassungsbescheinigung Teil II.`,
          'notice',
          'listing_fact',
          ['previousOwners'],
          [signals.owners.quote],
        ),
      );
    }
  }
  return result;
}

function accidentRules(ctx: VehicleRuleContext): Observation[] {
  const { vehicle, signals } = ctx;
  const conflictingDescription = signals.accident?.conflicting === true;
  const conflictingCondition =
    vehicle.accidentHistory === 'accident_free' && vehicle.condition === 'damaged';
  if (!conflictingDescription && !conflictingCondition) return [];
  const quotes = [
    signals.accidentFreeClaim?.quote,
    ...signals.damageClaims.map((claim) => claim.quote),
  ].filter((quote): quote is string => Boolean(quote));
  return [
    observation(
      'accident_conflict',
      'Widersprüchliche Angaben zu Unfallschäden',
      conflictingCondition
        ? 'Das Fahrzeug wird als unfallfrei beschrieben, der Fahrzeugzustand ist aber als „beschädigt“ angegeben. Frag genau nach, welche Schäden es gibt.'
        : 'Die Beschreibung nennt das Fahrzeug unfallfrei, erwähnt aber auch einen Unfall- oder Vorschaden. Frag genau nach, was passiert ist und wie es repariert wurde.',
      'warning',
      'listing_fact',
      ['accidentHistory'],
      quotes,
    ),
  ];
}

function huRules(ctx: VehicleRuleContext): Observation[] {
  const { vehicle } = ctx;
  const result: Observation[] = [];
  const hu = vehicle.huUntil;
  const left = ctx.huMonthsLeft;
  if (!hu || left === null) return result;

  if (left < 0) {
    const overdue = Math.abs(left);
    result.push(
      observation(
        'hu_expired',
        'HU ist abgelaufen',
        `Laut Inserat war die HU bis ${formatYearMonth(hu)} gültig – sie ist seit ${plural(
          overdue,
          'Monat',
          'Monaten',
        )} abgelaufen. Plane die Kosten für die HU und mögliche Reparaturen ein.`,
        'warning',
        'calculation',
        ['huUntil'],
      ),
    );
    return result;
  }
  if (left <= 3) {
    result.push(
      observation(
        'hu_expiring',
        'HU läuft bald ab',
        `Die HU ist laut Inserat nur noch bis ${formatYearMonth(hu)} gültig (${
          left === 0 ? 'diesen Monat' : `noch ${plural(left, 'Monat', 'Monate')}`
        }). Plane die HU und eventuell nötige Reparaturen ein.`,
        'info',
        'calculation',
        ['huUntil'],
      ),
    );
  }
  // HU intervals: 36 months after first registration, then every 24 months.
  const maxMonths = ctx.ageMonths !== null && ctx.ageMonths < 36 ? 36 - ctx.ageMonths + 1 : 25;
  if (left > maxMonths) {
    result.push(
      observation(
        'hu_date_implausible',
        'HU-Datum ungewöhnlich weit in der Zukunft',
        `Die HU wäre laut Inserat noch ${plural(left, 'Monat', 'Monate')} gültig. Üblich sind höchstens 24 Monate (bei Neuwagen 36 Monate ab Erstzulassung). Lass dir den HU-Bericht zeigen.`,
        'notice',
        'calculation',
        ['huUntil'],
      ),
    );
  }
  return result;
}

function priceRules(ctx: VehicleRuleContext): Observation[] {
  const { listing, signals } = ctx;
  const result: Observation[] = [];
  const price = listing.price;
  if (price && price.kind !== 'give_away' && price.amountEur <= 10) {
    result.push(
      observation(
        'price_placeholder',
        'Preis wirkt wie ein Platzhalter',
        `Als Preis ist ${formatEuro(price.amountEur)} angegeben. Frag nach dem tatsächlichen Preis.`,
        'notice',
        'listing_fact',
        ['price'],
      ),
    );
  }
  if (price && price.amountEur > 10) {
    const conflict = signals.priceMentions.find(
      (mention) =>
        mention.quote !== price.raw &&
        Math.abs(mention.amountEur - price.amountEur) > Math.max(100, price.amountEur * 0.03),
    );
    if (conflict) {
      result.push(
        observation(
          'price_conflict',
          'Unterschiedliche Preisangaben',
          `Als Preis sind ${formatEuro(price.amountEur)} angegeben, in der Beschreibung ${formatEuro(
            conflict.amountEur,
          )}. Kläre vorab, welcher Preis gilt.`,
          'notice',
          'listing_fact',
          ['price'],
          [conflict.quote],
        ),
      );
    }
  }
  return result;
}

function descriptionRules(ctx: VehicleRuleContext): Observation[] {
  const result: Observation[] = [];
  if (ctx.descriptionWords === 0) {
    result.push(
      observation(
        'description_missing',
        'Keine Beschreibung',
        'Das Inserat enthält keinen Beschreibungstext. Zustand, Historie und Mängel musst du vollständig beim Verkäufer erfragen.',
        'notice',
        'listing_fact',
        ['description'],
      ),
    );
  } else if (ctx.descriptionWords < 20) {
    result.push(
      observation(
        'description_short',
        'Sehr kurze Beschreibung',
        `Die Beschreibung hat nur ${plural(
          ctx.descriptionWords,
          'Wort',
          'Wörter',
        )}. Wichtige Details zu Zustand und Historie fehlen dadurch möglicherweise.`,
        'notice',
        'listing_fact',
        ['description'],
      ),
    );
  }
  if (ctx.signals.vagueReferences.length > 0 && ctx.descriptionWords < 60) {
    result.push(
      observation(
        'description_vague',
        'Details sollen im Gespräch geklärt werden',
        'Die Beschreibung verweist für Einzelheiten auf ein Gespräch oder die Besichtigung. Lass dir wichtige Angaben vorab schriftlich geben.',
        'info',
        'listing_fact',
        ['description'],
        ctx.signals.vagueReferences.map((reference) => reference.quote),
      ),
    );
  }
  return result;
}

const WARNING_TITLES: Record<DamageCategory, string> = {
  engine: 'Beschreibung nennt ein Motorproblem',
  transmission: 'Beschreibung nennt ein Problem mit Getriebe oder Kupplung',
  roadworthiness: 'Fahrzeug laut Beschreibung nicht fahrbereit',
  warning_light: 'Beschreibung nennt eine Warnleuchte',
  electrical: 'Beschreibung nennt ein Elektrikproblem',
  rust: 'Beschreibung nennt Durchrostung',
  body: 'Beschreibung nennt Karosserieschäden',
  noise: 'Beschreibung nennt Geräusche',
  wear: 'Beschreibung nennt Verschleiß',
  interior: 'Beschreibung nennt Schäden im Innenraum',
  general: 'Beschreibung nennt einen Defekt',
};

function damageRules(ctx: VehicleRuleContext): Observation[] {
  const result: Observation[] = [];
  const warnings = ctx.signals.damageMentions.filter((mention) => mention.severity === 'warning');
  const notices = ctx.signals.damageMentions.filter((mention) => mention.severity === 'notice');

  const byCategory = new Map<DamageCategory, DamageMention[]>();
  for (const mention of warnings) {
    byCategory.set(mention.category, [...(byCategory.get(mention.category) ?? []), mention]);
  }
  for (const [category, mentions] of byCategory) {
    result.push(
      observation(
        `damage_${category}`,
        WARNING_TITLES[category],
        `Die Beschreibung erwähnt „${mentions[0]?.term ?? ''}“. Lass dir genau erklären, was los ist, und rechne mit Reparaturkosten. Im Zweifel lohnt eine Prüfung durch eine Werkstatt.`,
        'warning',
        'listing_fact',
        [],
        mentions.map((mention) => mention.quote),
      ),
    );
  }
  if (notices.length > 0) {
    const terms = [...new Set(notices.map((mention) => mention.term.toLowerCase()))].slice(0, 4);
    result.push(
      observation(
        'damage_mentioned',
        'In der Beschreibung genannte Mängel oder Schäden',
        `Genannt werden: ${joinGerman(terms.map((term) => `„${term}“`))}. Sieh dir diese Stellen bei der Besichtigung genau an und frag nach Details.`,
        'notice',
        'listing_fact',
        [],
        notices.map((mention) => mention.quote),
      ),
    );
  }
  return result;
}

function offerRules(ctx: VehicleRuleContext): Observation[] {
  const { signals, listing } = ctx;
  const result: Observation[] = [];

  const bastler = signals.soldAs.find((item) => item.kind === 'bastler' || item.kind === 'defect');
  if (bastler) {
    result.push(
      observation(
        'sold_as_defective',
        'Als Bastler- oder Defektfahrzeug angeboten',
        'Laut Beschreibung wird das Fahrzeug für Bastler bzw. als defekt angeboten. Rechne mit Mängeln und prüfe den Zustand besonders genau.',
        'warning',
        'listing_fact',
        [],
        [bastler.quote],
      ),
    );
  }
  const exportOffer = signals.soldAs.find((item) => item.kind === 'export');
  if (exportOffer && !bastler) {
    result.push(
      observation(
        'sold_for_export',
        '„Export“ in der Beschreibung',
        'Solche Angebote richten sich häufig an Händler. Kläre den Zustand und mögliche Mängel besonders genau.',
        'notice',
        'listing_fact',
        [],
        [exportOffer.quote],
      ),
    );
  }
  if (signals.emissionTampering.length > 0) {
    result.push(
      observation(
        'emission_tampering',
        'Abgasreinigung laut Beschreibung verändert',
        'Das Entfernen oder Abschalten von Partikelfilter, Katalysator, AGR oder AdBlue ist in Deutschland nicht zulässig. Die Betriebserlaubnis kann erlöschen, und bei der HU kann das zum Problem werden.',
        'warning',
        'listing_fact',
        [],
        signals.emissionTampering.map((item) => item.quote),
      ),
    );
  }
  if (signals.tuningMentions.length > 0) {
    result.push(
      observation(
        'tuning_mentioned',
        'Umbauten oder Leistungssteigerung erwähnt',
        'Frag, ob die Änderungen in den Fahrzeugpapieren eingetragen sind oder eine ABE bzw. ein Teilegutachten vorliegt. Nicht eingetragene Änderungen können die Betriebserlaubnis erlöschen lassen.',
        'notice',
        'listing_fact',
        [],
        signals.tuningMentions.map((item) => item.quote),
      ),
    );
  }
  if (listing.seller.type === 'private' && signals.commercialIndicators.length > 0) {
    result.push(
      observation(
        'seller_type_mismatch',
        'Privatangebot mit gewerblich wirkenden Formulierungen',
        'Das Inserat ist als privat gekennzeichnet, enthält aber Formulierungen, die eher zu einem Händler passen. Kläre, ob du privat oder von einem Händler kaufst – davon hängen deine Gewährleistungsrechte ab.',
        'notice',
        'listing_fact',
        [],
        signals.commercialIndicators.map((item) => item.quote),
      ),
    );
  }
  if (listing.seller.type === 'commercial' && signals.privateSaleClaim) {
    result.push(
      observation(
        'seller_type_mismatch',
        'Gewerblicher Anbieter spricht von Privatverkauf',
        'Laut Inserat verkauft ein gewerblicher Anbieter, die Beschreibung spricht aber von einem Privatverkauf. Als Verbraucher kannst du beim Kauf vom Händler Gewährleistungsrechte haben, die sich nicht vollständig ausschließen lassen.',
        'notice',
        'listing_fact',
        [],
        [signals.privateSaleClaim.quote],
      ),
    );
  }
  if (listing.status === 'reserved') {
    result.push(
      observation(
        'listing_reserved',
        'Inserat ist als reserviert markiert',
        'Frag nach, ob das Fahrzeug noch verfügbar ist, bevor du einen Termin vereinbarst.',
        'info',
        'listing_fact',
        [],
      ),
    );
  }
  if (listing.status === 'deleted') {
    result.push(
      observation(
        'listing_deleted',
        'Inserat ist als gelöscht markiert',
        'Das Inserat ist möglicherweise nicht mehr aktuell.',
        'info',
        'listing_fact',
        [],
      ),
    );
  }
  if (signals.deregistered) {
    result.push(
      observation(
        'deregistered',
        'Fahrzeug ist laut Beschreibung abgemeldet',
        'Für Probefahrt und Überführung brauchst du dann ein Kurzzeit- oder Überführungskennzeichen.',
        'info',
        'listing_fact',
        [],
        [signals.deregistered.quote],
      ),
    );
  }
  return result;
}

function missingInformationRules(ctx: VehicleRuleContext): Observation[] {
  const { vehicle, listing } = ctx;
  const result: Observation[] = [];

  const basics: string[] = [];
  if (!listing.price) basics.push('Preis');
  if (vehicle.mileageKm === null) basics.push('Kilometerstand');
  if (!vehicle.firstRegistration) basics.push('Erstzulassung');
  if (basics.length >= 2) {
    result.push(
      observation(
        'basics_missing',
        'Grundlegende Angaben fehlen',
        `Nicht angegeben: ${joinGerman(basics)}. Ohne diese Angaben lässt sich das Angebot kaum einordnen – frag zuerst danach.`,
        'warning',
        'unknown',
        ['price', 'mileageKm', 'firstRegistration'],
      ),
    );
  } else if (vehicle.mileageKm === null) {
    result.push(
      observation(
        'mileage_missing',
        'Kilometerstand nicht angegeben',
        'Der Kilometerstand ist eine der wichtigsten Angaben. Frag danach, bevor du einen Termin vereinbarst.',
        'notice',
        'unknown',
        ['mileageKm'],
      ),
    );
  }

  if (
    vehicle.accidentHistory === null &&
    vehicle.serviceHistory === null &&
    vehicle.previousOwners === null
  ) {
    result.push(
      observation(
        'history_unknown',
        'Keine Angaben zur Vorgeschichte',
        'Zu Unfällen, Wartung und Vorbesitzern steht nichts im Inserat. Das heißt nicht, dass etwas nicht stimmt – frag gezielt danach.',
        'info',
        'unknown',
        ['accidentHistory', 'serviceHistory', 'previousOwners'],
      ),
    );
  }

  if (ctx.sourceType === 'kleinanzeigen_url') {
    if (listing.images.length === 0) {
      result.push(
        observation(
          'photos_missing',
          'Keine Fotos im Inserat',
          'Bitte den Verkäufer um aussagekräftige Fotos – rundum, Innenraum und Tacho.',
          'notice',
          'listing_fact',
          ['photos'],
        ),
      );
    } else if (listing.images.length < 3) {
      result.push(
        observation(
          'photos_few',
          'Nur wenige Fotos',
          `Das Inserat hat ${plural(listing.images.length, 'Foto', 'Fotos')}. Bitte um weitere Fotos, z. B. vom Innenraum und vom Tacho.`,
          'info',
          'listing_fact',
          ['photos'],
        ),
      );
    }
  }
  return result;
}

const SEVERITY_ORDER: Record<Severity, number> = { warning: 0, notice: 1, info: 2 };

/** Evidence-based observations ("Auffälligkeiten"), most important first. */
export function collectObservations(ctx: VehicleRuleContext): Observation[] {
  const all = [
    ...mileageRules(ctx),
    ...registrationRules(ctx),
    ...technicalConflictRules(ctx),
    ...accidentRules(ctx),
    ...huRules(ctx),
    ...priceRules(ctx),
    ...damageRules(ctx),
    ...offerRules(ctx),
    ...descriptionRules(ctx),
    ...missingInformationRules(ctx),
  ];
  return all
    .map((item, index) => ({ item, index }))
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a.item.severity] - SEVERITY_ORDER[b.item.severity] || a.index - b.index,
    )
    .map(({ item }) => item);
}
