import { FUEL_LABELS, type FuelType } from './labels';
import { numberInWords } from './number-words';

/**
 * Purchase contract for a used car between two private persons (Verbraucher,
 * § 13 BGB). KaufCheck's own wording; the reasons for each clause are in
 * DECISIONS.md. Everything the user leaves empty becomes a line to fill in by
 * hand, and no statement about the car's condition is preselected.
 */

/** The seller's answer to a statement about the car; empty = not answered (ticked by hand). */
export type ContractAnswer = '' | 'yes' | 'no' | 'unknown';

export const CONTRACT_STATEMENTS = [
  'damageOwn',
  'damageBefore',
  'commercialUse',
  'imported',
  'engineReplaced',
  'openRecalls',
] as const;
export type ContractStatement = (typeof CONTRACT_STATEMENTS)[number];

export const CONTRACT_DOCUMENTS = [
  'registrationPart1',
  'registrationPart2',
  'inspectionReport',
  'serviceRecords',
  'manual',
  'invoices',
  'coc',
] as const;
export type ContractDocument = (typeof CONTRACT_DOCUMENTS)[number];

export const CONTRACT_DOCUMENT_LABELS: Record<ContractDocument, string> = {
  registrationPart1: 'Zulassungsbescheinigung Teil I (Fahrzeugschein)',
  registrationPart2: 'Zulassungsbescheinigung Teil II (Fahrzeugbrief)',
  inspectionReport: 'Bericht der letzten Hauptuntersuchung',
  serviceRecords: 'Serviceheft oder Wartungsnachweise',
  manual: 'Bedienungsanleitung',
  invoices: 'Rechnungen über Reparaturen',
  coc: 'Übereinstimmungsbescheinigung (CoC-Papier)',
};

export interface ContractParty {
  name: string;
  street: string;
  city: string;
  birthDate: string;
  phone: string;
  email: string;
  idNumber: string;
  /** Who signs for the party, with a power of attorney. */
  representative: string;
}

export interface SaleContractValues {
  seller: ContractParty;
  buyer: ContractParty;
  make: string;
  model: string;
  vin: string;
  plate: string;
  firstRegistration: string;
  registrationPart2Number: string;
  powerKw: string;
  fuel: FuelType | '';
  color: string;
  huUntil: string;
  keepers: string;
  /** The name in the registration certificate part II. */
  registeredKeeper: string;
  odometerKm: string;
  /**
   * The total mileage: what the seller knows (`matches`, `unknown`, `differs`)
   * or a binding figure (`agreed`).
   */
  totalMileage: '' | 'matches' | 'unknown' | 'differs' | 'agreed';
  totalMileageKm: string;
  /** Traction battery of an electric car or plug-in hybrid. */
  battery: '' | 'included' | 'rented';
  answers: Record<ContractStatement, ContractAnswer>;
  details: Record<ContractStatement, string>;
  knownDefects: string;
  price: string;
  payment: '' | 'cash' | 'transfer';
  deposit: string;
  handoverDate: string;
  handoverTime: string;
  handoverPlace: string;
  registration: '' | 'deregistered' | 'registered';
  reRegisterBy: string;
  documents: ContractDocument[];
  keys: string;
  accessories: string;
  notIncluded: string;
  otherAgreements: string;
}

const EMPTY_PARTY: ContractParty = {
  name: '',
  street: '',
  city: '',
  birthDate: '',
  phone: '',
  email: '',
  idNumber: '',
  representative: '',
};

const byStatement = <T>(value: T) =>
  Object.fromEntries(CONTRACT_STATEMENTS.map((key) => [key, value])) as Record<
    ContractStatement,
    T
  >;

export const EMPTY_SALE_CONTRACT: SaleContractValues = {
  seller: EMPTY_PARTY,
  buyer: EMPTY_PARTY,
  make: '',
  model: '',
  vin: '',
  plate: '',
  firstRegistration: '',
  registrationPart2Number: '',
  powerKw: '',
  fuel: '',
  color: '',
  huUntil: '',
  keepers: '',
  registeredKeeper: '',
  odometerKm: '',
  totalMileage: '',
  totalMileageKm: '',
  battery: '',
  answers: byStatement<ContractAnswer>(''),
  details: byStatement(''),
  knownDefects: '',
  price: '',
  payment: '',
  deposit: '',
  handoverDate: '',
  handoverTime: '',
  handoverPlace: '',
  registration: '',
  reRegisterBy: '',
  documents: [],
  keys: '',
  accessories: '',
  notIncluded: '',
  otherAgreements: '',
};

/** Maximum lengths, so that the contract stays readable. */
export const CONTRACT_LIMITS = { line: 100, short: 30, details: 300, text: 1500 } as const;

export const CONTRACT_STATEMENT_TEXTS: Record<
  ContractStatement,
  { text: string; /** Only the seller's own time: a plain „Nein“. */ own?: boolean; detail: string }
> = {
  damageOwn: {
    text: 'Das Fahrzeug hatte während der Besitzzeit des Verkäufers einen Unfall- oder anderen Schaden, der über Bagatellschäden (ganz geringfügige äußere Lackschäden wie Kratzer oder Steinschläge) hinausgeht.',
    own: true,
    detail: 'Welcher Schaden, wie und von wem repariert?',
  },
  damageBefore: {
    text: 'Das Fahrzeug hatte vor der Besitzzeit des Verkäufers einen Unfall- oder anderen Schaden, der über Bagatellschäden (ganz geringfügige äußere Lackschäden wie Kratzer oder Steinschläge) hinausgeht.',
    detail: 'Welcher Schaden, wie repariert?',
  },
  commercialUse: {
    text: 'Das Fahrzeug wurde als Taxi, Mietwagen, Carsharing- oder Fahrschulwagen genutzt.',
    detail: 'Wie und wann?',
  },
  imported: {
    text: 'Das Fahrzeug war vor seiner ersten Zulassung in Deutschland im Ausland zugelassen oder wurde für einen ausländischen Markt gebaut (Import oder Reimport).',
    detail: 'Aus welchem Land?',
  },
  engineReplaced: {
    text: 'Der Motor wurde ersetzt (Austausch- oder Gebrauchtmotor).',
    detail: 'Wann eingebaut, und Laufleistung des Motors nach Kenntnis des Verkäufers',
  },
  openRecalls: {
    text: 'Für das Fahrzeug gibt es Rückrufe des Herstellers, die noch nicht erledigt sind.',
    detail: 'Welche?',
  },
};

/** Labels of the answers, as printed. */
export function answerLabels(
  statement: ContractStatement,
): Record<Exclude<ContractAnswer, ''>, string> {
  return {
    yes: 'Ja',
    no: CONTRACT_STATEMENT_TEXTS[statement].own ? 'Nein' : 'Nein, soweit dem Verkäufer bekannt',
    unknown: 'Nicht bekannt',
  };
}

// ---------------------------------------------------------------------------
// Validation

export type SaleContractField =
  | `seller.${keyof ContractParty}`
  | `buyer.${keyof ContractParty}`
  | Exclude<keyof SaleContractValues, 'seller' | 'buyer' | 'answers' | 'details'>
  | `details.${ContractStatement}`;

export type SaleContractErrors = Partial<Record<SaleContractField, string>>;

/** Characters that only make sense on screen: control characters and the soft hyphen. */
// eslint-disable-next-line no-control-regex
const INVISIBLE = /[\u0000-\u0008\u000e-\u001f\u007f-\u0084\u0086-\u009f\u00ad\u200b\ufeff]/g;

/** One line of text as printed: pasted tabs and line breaks become spaces. */
export function cleanLine(value: string): string {
  return value
    .normalize('NFC')
    .replace(INVISIBLE, '')
    .replace(/[\s\u0085\u2028\u2029]+/g, ' ')
    .trim();
}

/** Text with paragraphs as printed: any line separator becomes a line break. */
export function cleanText(value: string): string {
  return (
    value
      .normalize('NFC')
      .replace(INVISIBLE, '')
      // eslint-disable-next-line no-control-regex
      .replace(/\r\n?|[\u000b\u000c\u0085\u2028\u2029]/g, '\n')
      .replace(/[^\S\n]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}

/**
 * Whole euros or kilometres: „12500“, „12.500“ or „12 500“ (groups of three),
 * optionally „12.500,-“. „12.50“ is rejected instead of read as 1250.
 */
export function parseWholeNumber(value: string): number | null {
  const compact = value.trim().replace(/,-*$/, '');
  // Groups by dot or space, also the no-break spaces of pasted text.
  if (!/^\d{1,10}$/.test(compact) && !/^\d{1,3}([. \u00a0\u202f]\d{3})+$/.test(compact))
    return null;
  return Number(compact.replace(/[. \u00a0\u202f]/g, ''));
}

/** A date from an `<input type="date">` (YYYY-MM-DD) that exists. */
function isDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toISOString().slice(0, 10) === value;
}

const isoDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const MAX_PRICE = 9_999_999;
const MAX_LINES = { details: 5, text: 20 } as const;

/** Checks what is shown; fields hidden by an answer are ignored, as they are not printed. */
export function validateSaleContract(
  values: SaleContractValues,
  now: Date = new Date(),
): SaleContractErrors {
  const errors: SaleContractErrors = {};
  const check = (field: SaleContractField, value: string, max: number, maxLines?: number) => {
    const text = maxLines ? cleanText(value) : cleanLine(value);
    if (text.length > max) errors[field] = `Bitte höchstens ${max} Zeichen.`;
    else if (maxLines && text.split('\n').length > maxLines)
      errors[field] = `Bitte höchstens ${maxLines} Zeilen.`;
  };
  const today = isoDay(now);

  for (const role of ['seller', 'buyer'] as const) {
    const party = values[role];
    check(`${role}.name`, party.name, CONTRACT_LIMITS.line);
    check(`${role}.street`, party.street, CONTRACT_LIMITS.line);
    check(`${role}.city`, party.city, CONTRACT_LIMITS.line);
    check(`${role}.phone`, party.phone, CONTRACT_LIMITS.short);
    check(`${role}.email`, party.email, CONTRACT_LIMITS.line);
    check(`${role}.idNumber`, party.idNumber, CONTRACT_LIMITS.short);
    check(`${role}.representative`, party.representative, CONTRACT_LIMITS.line);
    if (
      party.birthDate &&
      (!isDate(party.birthDate) || party.birthDate < '1900-01-01' || party.birthDate >= today)
    )
      errors[`${role}.birthDate`] = 'Bitte gib ein gültiges Geburtsdatum an.';
  }

  for (const field of ['make', 'model', 'color', 'handoverPlace', 'registeredKeeper'] as const)
    check(field, values[field], CONTRACT_LIMITS.line);
  for (const field of ['plate', 'firstRegistration', 'registrationPart2Number'] as const)
    check(field, values[field], CONTRACT_LIMITS.short);
  for (const field of ['knownDefects', 'accessories', 'notIncluded', 'otherAgreements'] as const)
    check(field, values[field], CONTRACT_LIMITS.text, MAX_LINES.text);
  for (const statement of CONTRACT_STATEMENTS)
    if (values.answers[statement] === 'yes')
      check(
        `details.${statement}`,
        values.details[statement],
        CONTRACT_LIMITS.details,
        MAX_LINES.details,
      );

  const vin = values.vin.replace(/\s/g, '');
  if (vin) {
    if (!/^[A-Z0-9]{1,17}$/i.test(vin))
      errors.vin = 'Die FIN besteht aus Buchstaben und Ziffern, höchstens 17 Zeichen.';
    else if (vin.length === 17 && /[IOQ]/i.test(vin))
      errors.vin = 'I, O und Q kommen in einer FIN nicht vor – meist ist 1 oder 0 gemeint.';
  }

  const hu = /^(0?[1-9]|1[0-2])\/(\d{4})$/.exec(values.huUntil.trim());
  if (
    values.huUntil.trim() &&
    (!hu || Number(hu[2]) < 1950 || Number(hu[2]) > now.getFullYear() + 3)
  )
    errors.huUntil = 'Bitte als Monat/Jahr angeben, zum Beispiel 09/2027.';

  const number = (field: SaleContractField, value: string, max: number, message: string) => {
    if (!value.trim()) return null;
    const parsed = parseWholeNumber(value);
    if (parsed === null || parsed > max) errors[field] = message;
    return parsed;
  };
  number('powerKw', values.powerKw, 2000, 'Bitte gib die Leistung in kW als ganze Zahl an.');
  number('keepers', values.keepers, 99, 'Bitte gib die Zahl der Halter als ganze Zahl an.');
  number('keys', values.keys, 20, 'Bitte gib die Zahl der Schlüssel als ganze Zahl an.');
  number(
    'odometerKm',
    values.odometerKm,
    2_000_000,
    'Bitte gib den Tachostand in ganzen Kilometern an.',
  );
  if (values.totalMileage === 'differs' || values.totalMileage === 'agreed')
    number(
      'totalMileageKm',
      values.totalMileageKm,
      2_000_000,
      'Bitte gib die Laufleistung in ganzen Kilometern an.',
    );

  const priceMessage = 'Bitte gib den Preis in ganzen Euro an, zum Beispiel 12500.';
  const price = number('price', values.price, MAX_PRICE, priceMessage);
  if (price === 0) errors.price = priceMessage;
  const deposit = number(
    'deposit',
    values.deposit,
    MAX_PRICE,
    'Bitte gib die Anzahlung in ganzen Euro an.',
  );
  if (deposit !== null && price !== null && deposit >= price && !errors.deposit)
    errors.deposit = 'Die Anzahlung muss kleiner als der Kaufpreis sein.';

  if (values.handoverDate && !isDate(values.handoverDate))
    errors.handoverDate = 'Bitte gib ein gültiges Datum an.';
  if (values.registration === 'registered' && values.reRegisterBy) {
    if (!isDate(values.reRegisterBy)) errors.reRegisterBy = 'Bitte gib ein gültiges Datum an.';
    else if (
      values.handoverDate &&
      !errors.handoverDate &&
      values.reRegisterBy < values.handoverDate
    )
      errors.reRegisterBy = 'Die Ummeldung kann nicht vor der Übergabe liegen.';
  }
  if (values.handoverTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(values.handoverTime))
    errors.handoverTime = 'Bitte gib eine Uhrzeit an, zum Beispiel 14:30.';

  return errors;
}

// ---------------------------------------------------------------------------
// The contract as printable blocks

export type ContractBlock =
  | { kind: 'title'; text: string; subtitle: string }
  /** `keepTogether`: the whole section up to the next heading stays on one page. */
  | { kind: 'heading'; text: string; keepTogether?: boolean }
  | { kind: 'paragraph'; text: string }
  /** Label and value; an empty value is printed as a line to fill in. */
  | { kind: 'fields'; title?: string; rows: { label: string; value: string }[] }
  /** Seller and buyer side by side; empty values are lines to fill in. */
  | { kind: 'parties'; rows: { label: string; seller: string; buyer: string }[] }
  /** One statement with boxes; `checked` is the index of the ticked option, or null. */
  | {
      kind: 'choice';
      text: string;
      options: string[];
      checked: number | null;
      /** Asked only with the option at `option`; printed while that or nothing is ticked. */
      detail?: { label: string; value: string; option: number };
    }
  /** Boxes that can each be ticked. */
  | { kind: 'checklist'; items: { text: string; checked: boolean }[] }
  /** Free text, or empty lines to write on. */
  | { kind: 'lines'; label?: string; value: string; lines: number }
  /** `text` is printed right above, on the same page as the signatures. */
  | { kind: 'signatures'; text: string; left: string; right: string }
  | { kind: 'pageBreak' };

const formatDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : '';
};

const formatNumber = (value: number) => value.toLocaleString('de-DE');

function amount(value: string): string {
  const parsed = parseWholeNumber(value);
  return parsed === null ? '' : formatNumber(parsed);
}

/** „12.500 Euro (in Worten: zwölftausendfünfhundert Euro)“, or lines to fill in. */
function priceText(value: string): { figures: string; words: string } {
  const parsed = parseWholeNumber(value);
  if (parsed === null || parsed === 0) return { figures: '', words: '' };
  return { figures: `${formatNumber(parsed)} Euro`, words: `${numberInWords(parsed)} Euro` };
}

function partyRows(seller: ContractParty, buyer: ContractParty) {
  const row = (label: string, value: (party: ContractParty) => string) => ({
    label,
    seller: value(seller),
    buyer: value(buyer),
  });
  return [
    row('Name, Vorname', (party) => cleanLine(party.name)),
    row('Straße, Hausnummer', (party) => cleanLine(party.street)),
    row('PLZ, Ort', (party) => cleanLine(party.city)),
    row('Geburtsdatum', (party) => formatDate(party.birthDate)),
    row('Telefon', (party) => cleanLine(party.phone)),
    row('E-Mail', (party) => cleanLine(party.email)),
    row('Ausweis- oder Passnummer', (party) => cleanLine(party.idNumber)),
    row('Vertreten durch (Vollmacht anbei)', (party) => cleanLine(party.representative)),
  ];
}

const EV_FUELS: ReadonlySet<FuelType | ''> = new Set(['electric', 'plugin_hybrid']);

/** Keeps „Teil II“ on one line. */
const NBSP = '\u00a0';

/** The ticked option for a value, or null while nothing is chosen. */
function optionIndex<T extends string>(value: T | '', options: readonly T[]): number | null {
  const index = value === '' ? -1 : options.indexOf(value);
  return index === -1 ? null : index;
}

export function saleContractBlocks(values: SaleContractValues): ContractBlock[] {
  const blocks: ContractBlock[] = [];
  const add = (...items: ContractBlock[]) => blocks.push(...items);
  const blank = '_______________';

  add({
    kind: 'title',
    text: 'Kaufvertrag über ein gebrauchtes Kraftfahrzeug',
    subtitle: 'zwischen Privatpersonen',
  });

  // § 1 Parties
  add(
    { kind: 'heading', text: '§ 1 Vertragsparteien' },
    { kind: 'parties', rows: partyRows(values.seller, values.buyer) },
    {
      kind: 'paragraph',
      text: 'Verkäufer und Käufer schließen diesen Vertrag als Privatpersonen. Der Verkäufer erklärt, dass das Fahrzeug zu seinem Privatvermögen gehört und er es nicht im Rahmen einer gewerblichen oder selbständigen beruflichen Tätigkeit verkauft.',
    },
  );

  // § 2 Vehicle
  const keepers = parseWholeNumber(values.keepers);
  const mileage = amount(values.totalMileageKm);
  const mileageFor = (option: SaleContractValues['totalMileage']) =>
    values.totalMileage === option && mileage ? `${mileage} km` : `${blank} km`;
  add(
    { kind: 'heading', text: '§ 2 Fahrzeug' },
    {
      kind: 'fields',
      rows: [
        { label: 'Hersteller', value: cleanLine(values.make) },
        { label: 'Modell', value: cleanLine(values.model) },
        {
          label: 'Fahrzeug-Identifizierungsnummer (FIN)',
          value: values.vin.replace(/\s/g, '').toUpperCase(),
        },
        { label: 'Amtliches Kennzeichen', value: cleanLine(values.plate).toUpperCase() },
        { label: 'Erstzulassung', value: cleanLine(values.firstRegistration) },
        {
          label: `Nummer der Zulassungsbescheinigung Teil${NBSP}II`,
          value: cleanLine(values.registrationPart2Number).toUpperCase(),
        },
        {
          label: `Als Halter eingetragen in der Zulassungsbescheinigung Teil${NBSP}II`,
          value: cleanLine(values.registeredKeeper),
        },
        {
          label: `Zahl der Halter laut Zulassungsbescheinigung Teil${NBSP}II`,
          value: keepers === null ? '' : String(keepers),
        },
        { label: 'Leistung', value: amount(values.powerKw) && `${amount(values.powerKw)} kW` },
        {
          label: 'Kraftstoff oder Energiequelle',
          value: values.fuel ? FUEL_LABELS[values.fuel] : '',
        },
        { label: 'Farbe', value: cleanLine(values.color) },
        {
          label: 'Nächste Hauptuntersuchung fällig (laut Prüfplakette)',
          value: cleanLine(values.huUntil),
        },
        {
          label: 'Tachostand bei Vertragsschluss (abgelesen)',
          value: amount(values.odometerKm) && `${amount(values.odometerKm)} km`,
        },
      ],
    },
    {
      kind: 'choice',
      text: 'Der Tachostand gibt nur wieder, was der Kilometerzähler anzeigt. Zur Gesamtlaufleistung des Fahrzeugs gilt:',
      options: [
        'Sie entspricht nach Kenntnis des Verkäufers dem Tachostand.',
        'Sie ist dem Verkäufer nicht bekannt.',
        `Sie weicht vom Tachostand ab und beträgt nach Kenntnis des Verkäufers etwa ${mileageFor('differs')}.`,
        `Sie betrug bei Vertragsschluss höchstens ${mileageFor('agreed')}; das gehört zur vereinbarten Beschaffenheit.`,
      ],
      checked: optionIndex(values.totalMileage, ['matches', 'unknown', 'differs', 'agreed']),
    },
  );
  // An electric drive, or an unknown fuel on a blank contract: a battery answer left over from
  // another fuel is not printed.
  const battery = EV_FUELS.has(values.fuel) || values.fuel === '';
  if (battery) {
    add({
      kind: 'choice',
      text:
        values.fuel === ''
          ? 'Nur bei Elektroautos und Plug-in-Hybriden: Die Antriebsbatterie'
          : 'Die Antriebsbatterie',
      options: [
        'gehört zum Fahrzeug und wird mitverkauft.',
        'ist gemietet oder geleast. Der Käufer klärt die Übernahme des Vertrags mit dem Vermieter; bis zur Übernahme erstattet er dem Verkäufer die ab der Übergabe fällige Miete.',
      ],
      checked: values.fuel === '' ? null : optionIndex(values.battery, ['included', 'rented']),
    });
  }

  // § 3 Seller's statements
  add(
    { kind: 'heading', text: '§ 3 Angaben des Verkäufers' },
    {
      kind: 'paragraph',
      text: 'Der Verkäufer macht die folgenden Angaben zum Fahrzeug. Angaben mit „Ja“ oder „Nein“ und die Beschreibungen unter „Falls ja“ gehören zur vereinbarten Beschaffenheit. Angaben „Nein, soweit dem Verkäufer bekannt“ und Angaben „nach Kenntnis des Verkäufers“ in § 2 geben nur wieder, was der Verkäufer weiß; sie sind keine Beschaffenheitsvereinbarung; der Verkäufer muss sie aber nach seinem tatsächlichen Wissen machen. „Nicht bekannt“ bedeutet: Der Verkäufer weiß es nicht und macht dazu keine Angabe.',
    },
  );
  for (const statement of CONTRACT_STATEMENTS) {
    const labels = answerLabels(statement);
    const answer = values.answers[statement];
    add({
      kind: 'choice',
      text: CONTRACT_STATEMENT_TEXTS[statement].text,
      options: [labels.yes, labels.no, labels.unknown],
      checked: optionIndex(answer, ['yes', 'no', 'unknown']),
      detail: {
        option: 0,
        label: 'Falls ja',
        value: answer === 'yes' ? cleanText(values.details[statement]) : '',
      },
    });
  }
  add(
    {
      kind: 'lines',
      label: 'Weitere dem Verkäufer bekannte Mängel und Schäden',
      value: cleanText(values.knownDefects),
      lines: 3,
    },
    {
      kind: 'paragraph',
      text: 'Die in diesem Paragrafen als vorhanden angegebenen Unfälle, Schäden und Mängel gehören zur vereinbarten Beschaffenheit; wegen ihnen hat der Käufer keine Rechte. Ist ein angegebener Schaden oder Mangel größer als beschrieben, gilt das nur im beschriebenen Umfang.',
    },
    {
      kind: 'paragraph',
      text: `Der Verkäufer kann dem Käufer das Eigentum am Fahrzeug frei von Rechten Dritter verschaffen. Das Fahrzeug ist insbesondere nicht zur Sicherheit übereignet (etwa an eine Bank), steht nicht unter dem Eigentumsvorbehalt eines Dritten und ist weder verpfändet noch gepfändet.${battery ? ' Ausgenommen ist eine in § 2 als gemietet oder geleast angegebene Antriebsbatterie.' : ''}`,
    },
  );

  // § 4 Price and payment
  const price = priceText(values.price);
  const total = parseWholeNumber(values.price);
  const deposit = parseWholeNumber(values.deposit);
  add(
    { kind: 'heading', text: '§ 4 Kaufpreis und Zahlung' },
    {
      kind: 'fields',
      rows: [
        { label: 'Kaufpreis', value: price.figures },
        { label: 'in Worten', value: price.words },
      ],
    },
  );
  if (deposit) {
    const rest = total ? `${formatNumber(total - deposit)} Euro` : `${blank} Euro`;
    add(
      {
        kind: 'paragraph',
        text: `Vereinbart ist eine Anzahlung von ${formatNumber(deposit)} Euro, die auf den Kaufpreis angerechnet wird. Der restliche Kaufpreis beträgt ${rest}.`,
      },
      {
        kind: 'fields',
        rows: [{ label: 'Anzahlung erhalten (Datum, Unterschrift Verkäufer)', value: '' }],
      },
    );
  }
  add(
    {
      kind: 'choice',
      text: deposit
        ? 'Der Käufer zahlt den restlichen Kaufpreis'
        : 'Der Käufer zahlt den Kaufpreis',
      options: [
        'bar bei der Übergabe.',
        'durch Überweisung. Das Geld muss vor der Übergabe auf dem Konto des Verkäufers eingegangen sein.',
      ],
      checked: optionIndex(values.payment, ['cash', 'transfer']),
    },
    {
      kind: 'paragraph',
      text: `Das Fahrzeug bleibt bis zur vollständigen Zahlung des Kaufpreises Eigentum des Verkäufers. Das Eigentum geht mit der Übergabe auf den Käufer über, jedoch nicht vor vollständiger Zahlung des Kaufpreises. Fahrzeug, Schlüssel und die Zulassungsbescheinigungen Teil${NBSP}I und Teil${NBSP}II übergibt der Verkäufer bei der Übergabe nach § 6, nicht jedoch vor vollständiger Zahlung.`,
    },
  );

  // § 5 Liability for defects
  add(
    { kind: 'heading', text: '§ 5 Haftung für Sachmängel' },
    {
      kind: 'paragraph',
      text: '(1) Das Fahrzeug wird gebraucht verkauft. Rechte und Ansprüche des Käufers wegen Sachmängeln sind ausgeschlossen, soweit sich aus Absatz 2 nichts anderes ergibt.',
    },
    { kind: 'paragraph', text: '(2) Der Ausschluss gilt nicht' },
    {
      kind: 'paragraph',
      text: 'a) für Ansprüche auf Schadensersatz wegen einer Verletzung des Lebens, des Körpers oder der Gesundheit, die auf einer fahrlässigen oder vorsätzlichen Pflichtverletzung des Verkäufers, seines gesetzlichen Vertreters oder seines Erfüllungsgehilfen beruht;',
    },
    {
      kind: 'paragraph',
      text: 'b) für Ansprüche auf Schadensersatz wegen sonstiger Schäden, die auf einer grob fahrlässigen oder vorsätzlichen Pflichtverletzung des Verkäufers, seines gesetzlichen Vertreters oder seines Erfüllungsgehilfen beruhen;',
    },
    { kind: 'paragraph', text: 'c) soweit der Verkäufer einen Mangel arglistig verschwiegen hat;' },
    {
      kind: 'paragraph',
      text: 'd) soweit der Verkäufer eine Garantie für die Beschaffenheit des Fahrzeugs übernommen hat;',
    },
    {
      kind: 'paragraph',
      text: 'e) soweit das Fahrzeug bei Gefahrübergang nicht die vereinbarte Beschaffenheit hat (insbesondere nach § 2 und § 3; zu Angaben nach Kenntnis des Verkäufers siehe § 3) oder nicht mit dem vereinbarten Zubehör und den vereinbarten Unterlagen (§ 6) übergeben wird;',
    },
    {
      kind: 'paragraph',
      text: 'f) für Mängel, die nach Abschluss dieses Vertrags und vor der Übergabe entstehen.',
    },
    {
      kind: 'paragraph',
      text: '(3) Rechte des Käufers wegen Rechtsmängeln bleiben unberührt. Mit vollständiger Zahlung des Kaufpreises tritt der Verkäufer seine Ansprüche gegen Dritte auf Beseitigung von Mängeln des Fahrzeugs (etwa aus einer Hersteller- oder Händlergarantie oder Gewährleistung) an den Käufer ab, soweit sie abtretbar sind; eigene Zahlungsansprüche des Verkäufers bleiben bei ihm.',
    },
  );

  // § 6 Handover
  const handoverAt = [
    formatDate(values.handoverDate),
    values.handoverTime && `${values.handoverTime} Uhr`,
  ]
    .filter(Boolean)
    .join(', ');
  add(
    { kind: 'heading', text: '§ 6 Übergabe, Schlüssel und Unterlagen' },
    {
      kind: 'fields',
      rows: [
        { label: 'Übergabe am (Datum, Uhrzeit)', value: handoverAt },
        { label: 'Übergabe in (Ort)', value: cleanLine(values.handoverPlace) },
        { label: 'Zahl der Fahrzeugschlüssel', value: amount(values.keys) },
      ],
    },
    {
      kind: 'paragraph',
      text: 'Mit der Übergabe gehen die Gefahr des zufälligen Untergangs und der zufälligen Verschlechterung des Fahrzeugs, die Nutzungen und die Lasten auf den Käufer über. Der Verkäufer löst das Fahrzeug vor der Übergabe aus seinen Hersteller-Apps und Online-Diensten, soweit es dort verknüpft ist, und löscht seine persönlichen Daten im Fahrzeug.',
    },
    {
      kind: 'paragraph',
      text: 'Mit dem Fahrzeug übergibt der Verkäufer die angekreuzten Unterlagen:',
    },
    {
      kind: 'checklist',
      items: CONTRACT_DOCUMENTS.map((document) => ({
        text: CONTRACT_DOCUMENT_LABELS[document],
        checked: values.documents.includes(document),
      })),
    },
    {
      kind: 'lines',
      label: 'Mitverkauftes Zubehör (zum Beispiel zweiter Radsatz)',
      value: cleanText(values.accessories),
      lines: 2,
    },
    {
      kind: 'lines',
      label: 'Nicht mitverkauft',
      value: cleanText(values.notIncluded),
      lines: 1,
    },
  );

  // § 7 Registration, insurance, tax
  const reRegisterBy = formatDate(values.reRegisterBy);
  add(
    { kind: 'heading', text: '§ 7 Zulassung, Versicherung und Steuer' },
    {
      kind: 'choice',
      text: 'Bei der Übergabe ist das Fahrzeug',
      options: [
        'abgemeldet (außer Betrieb gesetzt).',
        `noch auf den Verkäufer zugelassen. Der Käufer meldet es unverzüglich, spätestens am ${reRegisterBy || blank}, auf sich um oder setzt es außer Betrieb und schickt dem Verkäufer sofort eine Kopie der neuen Zulassungsbescheinigung Teil${NBSP}I oder der Abmeldebestätigung. Bis dahin bleiben die Kennzeichen am Fahrzeug.`,
      ],
      checked: optionIndex(values.registration, ['deregistered', 'registered']),
    },
  );
  if (values.registration !== 'deregistered') {
    add({
      kind: 'paragraph',
      text: 'Bleibt das Fahrzeug nach der Übergabe auf den Verkäufer zugelassen, erstattet der Käufer ihm die Kfz-Steuer und den Versicherungsbeitrag, die der Verkäufer für die Zeit von der Übergabe bis zur Umschreibung oder Außerbetriebsetzung zahlen muss. Von Bußgeldern, Gebühren und Ansprüchen Dritter, die ab der Übergabe durch den Gebrauch des Fahrzeugs entstehen, stellt der Käufer den Verkäufer frei, soweit sie nicht auf einer Pflichtverletzung des Verkäufers beruhen.',
    });
  }
  add({
    kind: 'paragraph',
    // The insurance passes to the buyer also for a deregistered car (§§ 95, 97 VVG); the
    // registration authority needs no notice then (§ 15 Abs. 6 FZV).
    text:
      values.registration === 'deregistered'
        ? 'Der Verkäufer zeigt den Verkauf unverzüglich seiner Kfz-Versicherung an.'
        : 'Der Verkäufer zeigt den Verkauf unverzüglich seiner Kfz-Versicherung und der Zulassungsbehörde an und gibt dabei das Kennzeichen sowie Namen und Anschrift des Käufers an.',
  });

  // § 8 Other agreements, signatures
  add(
    // The last section stays on the page with the signatures.
    { kind: 'heading', text: '§ 8 Weitere Vereinbarungen', keepTogether: true },
    { kind: 'lines', value: cleanText(values.otherAgreements), lines: 3 },
    {
      kind: 'paragraph',
      text: 'Weicht eine Angabe in einer Anzeige zum Fahrzeug von diesem Vertrag ab, gilt dieser Vertrag. Nicht benutzte Zeilen und Kästchen werden vor der Unterschrift durchgestrichen.',
    },
    {
      kind: 'signatures',
      text: 'Der Vertrag wird zweimal ausgefertigt; Verkäufer und Käufer erhalten je ein Exemplar.',
      left: 'Verkäufer',
      right: 'Käufer',
    },
  );

  // Handover record and receipt
  add(
    { kind: 'pageBreak' },
    { kind: 'heading', text: 'Übergabeprotokoll und Quittung' },
    {
      kind: 'paragraph',
      // Names the registration certificates (§ 15 Abs. 5 FZV) unless they were left unticked.
      text:
        values.documents.length === 0 ||
        (values.documents.includes('registrationPart1') &&
          values.documents.includes('registrationPart2'))
          ? `Der Käufer bestätigt, das Fahrzeug, die Schlüssel und die in § 6 angekreuzten Unterlagen erhalten zu haben, darunter die Zulassungsbescheinigungen Teil${NBSP}I und Teil${NBSP}II.`
          : 'Der Käufer bestätigt, das Fahrzeug, die Schlüssel und die in § 6 angekreuzten Unterlagen erhalten zu haben.',
    },
    {
      kind: 'fields',
      rows: [
        { label: 'Datum und Uhrzeit der Übergabe', value: '' },
        { label: 'Tachostand bei Übergabe', value: '' },
        { label: 'Zahl der übergebenen Schlüssel', value: '' },
        { label: 'Bemerkungen (zum Beispiel Schäden seit Vertragsschluss)', value: '' },
      ],
    },
    {
      kind: 'signatures',
      text: `Der Verkäufer bestätigt, den Kaufpreis von ${price.figures || `${blank} Euro`} vollständig erhalten zu haben.`,
      left: 'Verkäufer',
      right: 'Käufer',
    },
  );

  return blocks;
}
