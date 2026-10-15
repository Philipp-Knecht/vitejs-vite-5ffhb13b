import { FUEL_LABELS, TRANSMISSION_LABELS, type FuelType, type TransmissionType } from './labels';
import {
  cleanLine,
  cleanText,
  CONTRACT_LIMITS,
  EMPTY_SALE_CONTRACT,
  parseWholeNumber,
  type ContractAnswer,
  type ContractStatement,
  type SaleContractValues,
} from './sale-contract';

/**
 * The text of a listing for a private sale, built from the seller's answers by
 * fixed rules (no AI). What a listing says about the car can count as agreed
 * even if liability is excluded in the contract (BGH, VIII ZR 161/23), so the
 * statements about its history ask the same questions as the purchase
 * contract, say only what the seller knows and mark the rest as unknown.
 */

/** Statements of the purchase contract that also belong into a listing. */
export const LISTING_STATEMENTS = [
  'damageOwn',
  'damageBefore',
  'commercialUse',
  'imported',
  'engineReplaced',
] as const satisfies readonly ContractStatement[];
export type ListingStatement = (typeof LISTING_STATEMENTS)[number];

export type ListingServiceHistory = '' | 'complete' | 'partial' | 'none';
export type ListingDefects = '' | 'none' | 'listed';
export type ListingSmoking = '' | 'nonSmoker' | 'smoker';
export type ListingRegistration = '' | 'registered' | 'deregistered';

export interface ListingTextValues {
  make: string;
  model: string;
  /** Version or trim, e.g. „1.5 TSI Life“. */
  variant: string;
  /** MM/YYYY, MM.YYYY or the year alone. */
  firstRegistration: string;
  odometerKm: string;
  /** The total mileage as far as the seller knows; like the contract, without „agreed“. */
  totalMileage: '' | 'matches' | 'unknown' | 'differs';
  totalMileageKm: string;
  fuel: FuelType | '';
  powerKw: string;
  transmission: TransmissionType | '';
  color: string;
  /** MM/YYYY or MM.YYYY. */
  huUntil: string;
  keepers: string;
  keys: string;
  registration: ListingRegistration;
  answers: Record<ListingStatement, ContractAnswer>;
  details: Record<ListingStatement, string>;
  serviceHistory: ListingServiceHistory;
  lastService: string;
  /** Recent repairs and new parts, e.g. timing belt, brakes, tyres. */
  recentWork: string;
  /** Modifications, e.g. a tow bar or other wheels, and whether they are registered. */
  modifications: string;
  defects: ListingDefects;
  defectsText: string;
  /** Traction battery of an electric car or plug-in hybrid. */
  battery: string;
  smoking: ListingSmoking;
  equipment: string;
  accessories: string;
  reason: string;
  /** Where to see the car: a town or district, no street. */
  location: string;
}

const byStatement = <T>(value: T) =>
  Object.fromEntries(LISTING_STATEMENTS.map((key) => [key, value])) as Record<ListingStatement, T>;

export const EMPTY_LISTING_TEXT: ListingTextValues = {
  make: '',
  model: '',
  variant: '',
  firstRegistration: '',
  odometerKm: '',
  totalMileage: '',
  totalMileageKm: '',
  fuel: '',
  powerKw: '',
  transmission: '',
  color: '',
  huUntil: '',
  keepers: '',
  keys: '',
  registration: '',
  answers: byStatement<ContractAnswer>(''),
  details: byStatement(''),
  serviceHistory: '',
  lastService: '',
  recentWork: '',
  modifications: '',
  defects: '',
  defectsText: '',
  battery: '',
  smoking: '',
  equipment: '',
  accessories: '',
  reason: '',
  location: '',
};

export const LISTING_LIMITS = { line: 100, short: 30, details: 300, text: 1500 } as const;
/** The same limits as in the purchase contract, which takes over defects and accessories. */
const MAX_LINES = { details: 5, text: 20 } as const;

/** The question to the seller, and how the answer reads in the listing. */
export const LISTING_STATEMENT_TEXTS: Record<
  ListingStatement,
  {
    question: string;
    detail: string;
    /** What the listing says for each answer; `yes` is followed by the details. */
    yes: string;
    no: string;
    unknown: string;
  }
> = {
  damageOwn: {
    question:
      'Hatte das Auto, seit es dir gehört, einen Unfall- oder anderen Schaden, der über Bagatellschäden (ganz geringfügige Lackschäden wie Kratzer oder Steinschläge) hinausgeht?',
    detail: 'Welcher Schaden, wie und von wem repariert?',
    yes: 'Schäden in meiner Besitzzeit',
    no: 'In meiner Besitzzeit keine Unfall- oder anderen Schäden über Bagatellschäden hinaus',
    unknown: 'Ob es in meiner Besitzzeit Schäden gab, weiß ich nicht',
  },
  damageBefore: {
    question:
      'Hatte das Auto vor deiner Besitzzeit einen solchen Schaden? Antworte nur „Nein“, wenn du es weißt, etwa aus Unterlagen.',
    detail: 'Welcher Schaden, wie repariert?',
    yes: 'Schäden vor meiner Besitzzeit',
    no: 'Von Unfall- oder anderen Schäden vor meiner Besitzzeit ist mir nichts bekannt',
    unknown: 'Ob es vor meiner Besitzzeit Schäden gab, weiß ich nicht',
  },
  commercialUse: {
    question: 'Wurde das Auto als Taxi, Mietwagen, Carsharing- oder Fahrschulwagen genutzt?',
    detail: 'Wie und wann?',
    yes: 'Gewerbliche Nutzung',
    no: 'Keine Nutzung als Taxi, Mietwagen, Carsharing- oder Fahrschulwagen bekannt',
    unknown: 'Ob es gewerblich genutzt wurde, weiß ich nicht',
  },
  imported: {
    question:
      'War das Auto vor seiner ersten Zulassung in Deutschland im Ausland zugelassen, oder wurde es für einen ausländischen Markt gebaut?',
    detail: 'Aus welchem Land?',
    yes: 'Import oder Reimport',
    no: 'Kein Import oder Reimport bekannt',
    unknown: 'Ob es ein Import ist, weiß ich nicht',
  },
  engineReplaced: {
    question: 'Wurde der Motor ersetzt (Austausch- oder Gebrauchtmotor)?',
    detail: 'Wann eingebaut, und wie viele Kilometer hat der Motor nach deiner Kenntnis?',
    yes: 'Der Motor wurde ersetzt',
    no: 'Kein Motortausch bekannt',
    unknown: 'Ob der Motor ersetzt wurde, weiß ich nicht',
  },
};

export const SERVICE_HISTORY_TEXTS: Record<Exclude<ListingServiceHistory, ''>, string> = {
  complete: 'Alle Wartungen nach Herstellervorgabe mit Serviceheft oder Rechnungen belegt',
  partial: 'Wartungen teilweise mit Serviceheft oder Rechnungen belegt',
  none: 'Keine Wartungsnachweise vorhanden',
};

export const SMOKING_TEXTS: Record<Exclude<ListingSmoking, ''>, string> = {
  nonSmoker: 'In meiner Besitzzeit wurde im Auto nicht geraucht',
  smoker: 'Im Auto wurde geraucht',
};

export const REGISTRATION_TEXTS: Record<Exclude<ListingRegistration, ''>, string> = {
  registered: 'Das Auto ist zugelassen.',
  deregistered: 'Das Auto ist abgemeldet.',
};

// ---------------------------------------------------------------------------
// Validation

export type ListingTextField =
  Exclude<keyof ListingTextValues, 'answers' | 'details'> | `details.${ListingStatement}`;

export type ListingTextErrors = Partial<Record<ListingTextField, string>>;

/** „09/2016“, „09.2016“, „9-2016“ or „09 2016“. */
const MONTH_YEAR = /^(0?[1-9]|1[0-2])\s*[/.\-\s]\s*(\d{4})$/;

function parseMonthYear(value: string): { month: number; year: number } | null {
  const match = MONTH_YEAR.exec(value.trim());
  return match ? { month: Number(match[1]), year: Number(match[2]) } : null;
}

/** A first registration: month and year, or the year alone as in „Mein Auto“. */
function parseRegistration(value: string): { month: number | null; year: number } | null {
  const year = /^\d{4}$/.exec(value.trim());
  return year ? { month: null, year: Number(year[0]) } : parseMonthYear(value);
}

const EV_FUELS: ReadonlySet<FuelType | ''> = new Set(['electric', 'plugin_hybrid']);

/** Checks what is shown; fields hidden by an answer are ignored, as they are not printed. */
export function validateListingText(
  values: ListingTextValues,
  now: Date = new Date(),
): ListingTextErrors {
  const errors: ListingTextErrors = {};
  const check = (field: ListingTextField, value: string, max: number, maxLines?: number) => {
    const text = maxLines ? cleanText(value) : cleanLine(value);
    if (text.length > max) errors[field] = `Bitte höchstens ${max} Zeichen.`;
    else if (maxLines && text.split('\n').length > maxLines)
      errors[field] = `Bitte höchstens ${maxLines} Zeilen.`;
  };

  if (!cleanLine(values.make)) errors.make = 'Bitte gib die Marke an.';
  else check('make', values.make, LISTING_LIMITS.line);
  if (!cleanLine(values.model)) errors.model = 'Bitte gib das Modell an.';
  else check('model', values.model, LISTING_LIMITS.line);
  for (const field of ['variant', 'color', 'location', 'lastService'] as const)
    check(field, values[field], LISTING_LIMITS.line);
  if (EV_FUELS.has(values.fuel)) check('battery', values.battery, LISTING_LIMITS.line);
  for (const field of [
    'recentWork',
    'modifications',
    'equipment',
    'accessories',
    'reason',
  ] as const)
    check(field, values[field], LISTING_LIMITS.text, MAX_LINES.text);
  if (values.defects === 'listed') {
    if (!cleanText(values.defectsText))
      errors.defectsText = 'Bitte beschreib die Mängel, oder wähl eine andere Antwort.';
    else check('defectsText', values.defectsText, LISTING_LIMITS.text, MAX_LINES.text);
  }
  for (const statement of LISTING_STATEMENTS)
    if (values.answers[statement] === 'yes') {
      if (!cleanText(values.details[statement]))
        errors[`details.${statement}`] = 'Bitte beschreib es kurz.';
      else
        check(
          `details.${statement}`,
          values.details[statement],
          LISTING_LIMITS.details,
          MAX_LINES.details,
        );
    }

  const thisYear = now.getFullYear();
  const registration = parseRegistration(values.firstRegistration);
  if (
    values.firstRegistration.trim() &&
    (!registration ||
      registration.year < 1900 ||
      registration.year * 12 + (registration.month ?? 1) > thisYear * 12 + now.getMonth() + 1)
  )
    errors.firstRegistration = 'Bitte als Monat/Jahr angeben, zum Beispiel 09/2016.';
  const hu = parseMonthYear(values.huUntil);
  if (values.huUntil.trim() && (!hu || hu.year < 1950 || hu.year > thisYear + 3))
    errors.huUntil = 'Bitte als Monat/Jahr angeben, zum Beispiel 09/2027.';

  const number = (field: ListingTextField, value: string, max: number, message: string) => {
    if (!value.trim()) return;
    const parsed = parseWholeNumber(value);
    if (parsed === null || parsed > max) errors[field] = message;
  };
  number('powerKw', values.powerKw, 2000, 'Bitte gib die Leistung in kW als ganze Zahl an.');
  number('keepers', values.keepers, 99, 'Bitte gib die Zahl der Halter als ganze Zahl an.');
  if (!errors.keepers && values.keepers.trim() && parseWholeNumber(values.keepers) === 0)
    errors.keepers = 'Ein Auto hat mindestens einen Halter.';
  number('keys', values.keys, 20, 'Bitte gib die Zahl der Schlüssel als ganze Zahl an.');
  if (!errors.keys && values.keys.trim() && parseWholeNumber(values.keys) === 0)
    errors.keys = 'Bitte gib die Zahl der Schlüssel an, die du übergibst.';
  number(
    'odometerKm',
    values.odometerKm,
    2_000_000,
    'Bitte gib den Tachostand in ganzen Kilometern an.',
  );
  if (values.totalMileage === 'differs') {
    if (!values.totalMileageKm.trim())
      errors.totalMileageKm = 'Bitte gib die Laufleistung nach deiner Kenntnis an.';
    else
      number(
        'totalMileageKm',
        values.totalMileageKm,
        2_000_000,
        'Bitte gib die Laufleistung in ganzen Kilometern an.',
      );
  }
  if (values.powerKw.trim() && !errors.powerKw && powerKw(values) === null)
    errors.powerKw = 'Bitte gib die Leistung in kW als ganze Zahl an.';
  return errors;
}

function powerKw(values: ListingTextValues): number | null {
  const kw = parseWholeNumber(values.powerKw);
  return kw !== null && kw > 0 ? kw : null;
}

// ---------------------------------------------------------------------------
// The text

/**
 * KaufCheck's own limit for a short title. The marketplaces limit the length
 * without publishing a figure (mobile.de: „begrenzt“).
 */
export const LISTING_TITLE_MAX = 60;

const formatNumber = (value: number) => value.toLocaleString('de-DE');

const monthYearText = (value: string) => {
  const parsed = parseMonthYear(value);
  return parsed ? `${String(parsed.month).padStart(2, '0')}/${parsed.year}` : '';
};

const registrationText = (value: string) => {
  const parsed = parseRegistration(value);
  if (!parsed) return '';
  return parsed.month === null
    ? String(parsed.year)
    : `${String(parsed.month).padStart(2, '0')}/${parsed.year}`;
};

/** Cut at a word boundary, without a dangling comma or dash at the end. */
function cutAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max + 1);
  const space = cut.lastIndexOf(' ');
  return (space > 0 ? cut.slice(0, space) : cut.slice(0, max)).replace(/[\s,;:–-]+$/, '');
}

/** Lines of a free text as list items; empty lines are dropped. */
const items = (value: string) =>
  cleanText(value)
    .split('\n')
    .map((line) => line.replace(/^[-–•*]\s*/, '').trim())
    .filter(Boolean);

/** kW to PS (1 PS = 0.73549875 kW), as on the registration certificate. */
export const kwToPs = (kw: number) => Math.round(kw / 0.73549875);

function km(value: string): string {
  const parsed = parseWholeNumber(value);
  return parsed === null ? '' : `${formatNumber(parsed)} km`;
}

/** Make, model and version, then as many key facts as fit. */
export function listingTitle(values: ListingTextValues): string {
  const name = [values.make, values.model, values.variant].map(cleanLine).filter(Boolean).join(' ');
  let title = cutAtWord(name, LISTING_TITLE_MAX);
  const facts = [
    km(values.odometerKm),
    registrationText(values.firstRegistration) &&
      `EZ ${registrationText(values.firstRegistration)}`,
    monthYearText(values.huUntil) && `HU ${monthYearText(values.huUntil)}`,
  ].filter(Boolean);
  for (const fact of facts) {
    const next = `${title}, ${fact}`;
    if (next.length <= LISTING_TITLE_MAX) title = next;
  }
  return title;
}

/** The description as plain text that can be pasted into any marketplace. */
export function listingDescription(values: ListingTextValues): string {
  const sections: string[] = [];
  const section = (heading: string, lines: string[]) => {
    if (lines.length > 0) sections.push([heading, ...lines.map((line) => `- ${line}`)].join('\n'));
  };
  const name = [values.make, values.model, values.variant].map(cleanLine).filter(Boolean).join(' ');
  sections.push(`Ich verkaufe privat mein Auto: ${name}.`);

  const facts: string[] = [];
  const registration = registrationText(values.firstRegistration);
  if (registration) facts.push(`Erstzulassung: ${registration}`);
  const odometer = km(values.odometerKm);
  if (odometer) facts.push(`Kilometerstand laut Tacho: ${odometer}`);
  if (values.totalMileage === 'matches')
    facts.push('Gesamtlaufleistung: entspricht nach meiner Kenntnis dem Tachostand');
  else if (values.totalMileage === 'unknown')
    facts.push('Gesamtlaufleistung: ist mir nicht bekannt');
  else if (values.totalMileage === 'differs' && km(values.totalMileageKm))
    facts.push(`Gesamtlaufleistung nach meiner Kenntnis: ${km(values.totalMileageKm)}`);
  if (values.fuel) facts.push(`Kraftstoff: ${FUEL_LABELS[values.fuel]}`);
  const kw = powerKw(values);
  if (kw !== null) facts.push(`Leistung: ${formatNumber(kw)} kW (${formatNumber(kwToPs(kw))} PS)`);
  if (values.transmission) facts.push(`Getriebe: ${TRANSMISSION_LABELS[values.transmission]}`);
  const color = cleanLine(values.color);
  if (color) facts.push(`Farbe: ${color}`);
  const hu = monthYearText(values.huUntil);
  if (hu) facts.push(`HU bis: ${hu}`);
  const keepers = parseWholeNumber(values.keepers);
  if (keepers !== null && keepers > 0)
    facts.push(`Halter laut Fahrzeugbrief: ${formatNumber(keepers)}`);
  const keys = parseWholeNumber(values.keys);
  if (keys !== null && keys > 0) facts.push(`Schlüssel: ${formatNumber(keys)}`);
  section('Eckdaten', facts);

  const history: string[] = [];
  for (const statement of LISTING_STATEMENTS) {
    const answer = values.answers[statement];
    if (!answer) continue;
    const texts = LISTING_STATEMENT_TEXTS[statement];
    history.push(
      answer === 'yes' ? `${texts.yes}: ${cleanLine(values.details[statement])}` : texts[answer],
    );
  }
  if (values.serviceHistory) history.push(SERVICE_HISTORY_TEXTS[values.serviceHistory]);
  const lastService = cleanLine(values.lastService);
  if (lastService) history.push(`Letzte Wartung: ${lastService}`);
  if (EV_FUELS.has(values.fuel)) {
    const battery = cleanLine(values.battery);
    if (battery) history.push(`Antriebsbatterie: ${battery}`);
  }
  if (values.smoking) history.push(SMOKING_TEXTS[values.smoking]);
  section('Zustand und Vorgeschichte', history);

  section('Zuletzt gemacht', items(values.recentWork));
  section('Umbauten', items(values.modifications));

  if (values.defects === 'listed') section('Bekannte Mängel', items(values.defectsText));
  else if (values.defects === 'none')
    sections.push('Bekannte Mängel: Mir sind keine Mängel bekannt.');

  section('Ausstattung', items(values.equipment));
  section('Wird mitverkauft', items(values.accessories));

  const reason = cleanText(values.reason).replace(/\n+/g, ' ');
  if (reason) sections.push(`Grund für den Verkauf: ${reason}`);

  const location = cleanLine(values.location);
  // A deregistered car may not be driven on public roads without a short-term plate.
  const viewing =
    values.registration === 'deregistered' ? 'Besichtigung' : 'Besichtigung und Probefahrt';
  sections.push(
    [
      ...(values.registration ? [REGISTRATION_TEXTS[values.registration]] : []),
      location ? `${viewing} nach Absprache in ${location}.` : `${viewing} nach Absprache.`,
      ...(values.registration === 'deregistered'
        ? []
        : ['Zur Probefahrt bitte Personalausweis und Führerschein mitbringen.']),
      'Privatverkauf: Ich beschreibe das Auto nach bestem Wissen. Die Haftung für Sachmängel schließen wir im schriftlichen Kaufvertrag aus, soweit das gesetzlich zulässig ist.',
    ].join('\n'),
  );

  return sections.join('\n\n');
}

/**
 * The listing taken over into a purchase contract: the vehicle data and the
 * same statements about the car, so that listing and contract say the same.
 * What only the contract asks (parties, price, handover, open recalls) stays
 * as it is; the odometer is read at the handover and is not taken over.
 */
export function applyListingToContract(
  contract: SaleContractValues,
  values: ListingTextValues,
): SaleContractValues {
  const answers = { ...contract.answers };
  const details = { ...contract.details };
  for (const statement of LISTING_STATEMENTS) {
    answers[statement] = values.answers[statement];
    details[statement] =
      values.answers[statement] === 'yes'
        ? cleanText(values.details[statement]).slice(0, CONTRACT_LIMITS.details)
        : '';
  }
  const line = (value: string) => cutAtWord(cleanLine(value), CONTRACT_LIMITS.line);
  const short = (value: string) => cleanLine(value).slice(0, CONTRACT_LIMITS.short);
  const keepers = parseWholeNumber(values.keepers);
  const keys = parseWholeNumber(values.keys);
  return {
    ...contract,
    make: line(values.make),
    model: line([values.model, values.variant].map(cleanLine).filter(Boolean).join(' ')),
    firstRegistration: short(registrationText(values.firstRegistration)),
    fuel: values.fuel,
    // A battery answer belongs to an electric drive only.
    battery: EV_FUELS.has(values.fuel) ? contract.battery : '',
    powerKw: powerKw(values) === null ? '' : String(powerKw(values)),
    color: line(values.color),
    huUntil: monthYearText(values.huUntil),
    keepers: keepers !== null && keepers > 0 && keepers <= 99 ? String(keepers) : '',
    keys: keys !== null && keys > 0 && keys <= 20 ? String(keys) : contract.keys,
    totalMileage: values.totalMileage,
    totalMileageKm: values.totalMileage === 'differs' ? short(values.totalMileageKm) : '',
    answers,
    details,
    knownDefects:
      values.defects === 'listed'
        ? cleanText(values.defectsText).slice(0, CONTRACT_LIMITS.text)
        : '',
    accessories: cleanText(values.accessories).slice(0, CONTRACT_LIMITS.text),
  };
}

/** A new purchase contract prefilled from the listing. */
export const saleContractFromListing = (values: ListingTextValues): SaleContractValues =>
  applyListingToContract(EMPTY_SALE_CONTRACT, values);
