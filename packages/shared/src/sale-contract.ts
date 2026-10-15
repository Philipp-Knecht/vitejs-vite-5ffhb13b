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
  odometerKm: string;
  /** What the seller knows about the total mileage. */
  totalMileage: '' | 'matches' | 'unknown' | 'differs';
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
    text: 'Das Fahrzeug hatte während der Besitzzeit des Verkäufers einen Unfall oder einen anderen erheblichen Schaden.',
    own: true,
    detail: 'Welcher Schaden, wie und von wem repariert?',
  },
  damageBefore: {
    text: 'Das Fahrzeug hatte vor der Besitzzeit des Verkäufers einen Unfall oder einen anderen erheblichen Schaden.',
    detail: 'Welcher Schaden, wie repariert?',
  },
  commercialUse: {
    text: 'Das Fahrzeug wurde gewerblich genutzt, etwa als Taxi, Miet- oder Fahrschulwagen.',
    detail: 'Wie und wann?',
  },
  imported: {
    text: 'Das Fahrzeug wurde aus dem Ausland eingeführt (Import oder Reimport).',
    detail: 'Aus welchem Land?',
  },
  engineReplaced: {
    text: 'Der Motor wurde ersetzt (Austausch- oder Gebrauchtmotor).',
    detail: 'Wann, und wie viele Kilometer hat der Motor gelaufen?',
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

/** Control characters; in multi-line text, line breaks and tabs are allowed. */
function hasControl(value: string, multiline: boolean): boolean {
  return [...value].some((char) => {
    const code = char.charCodeAt(0);
    if (multiline && (char === '\n' || char === '\r' || char === '\t')) return false;
    return code < 32 || (code >= 127 && code < 160) || code === 0x2028 || code === 0x2029;
  });
}

/** Whole euros or kilometres, also typed as „12.500“ or „12 500“. */
export function parseWholeNumber(value: string): number | null {
  const compact = value.trim().replace(/[\s.]/g, '').replace(/,-*$/, '');
  return /^\d{1,10}$/.test(compact) ? Number(compact) : null;
}

/** A date from an `<input type="date">` (YYYY-MM-DD) that exists. */
function isDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toISOString().slice(0, 10) === value;
}

const MAX_PRICE = 9_999_999;

export function validateSaleContract(values: SaleContractValues): SaleContractErrors {
  const errors: SaleContractErrors = {};
  const check = (field: SaleContractField, value: string, max: number, multiline = false) => {
    if (value.length > max) errors[field] = `Bitte höchstens ${max} Zeichen.`;
    else if (hasControl(value, multiline)) errors[field] = 'Bitte nur normalen Text eingeben.';
  };

  for (const role of ['seller', 'buyer'] as const) {
    const party = values[role];
    check(`${role}.name`, party.name, CONTRACT_LIMITS.line);
    check(`${role}.street`, party.street, CONTRACT_LIMITS.line);
    check(`${role}.city`, party.city, CONTRACT_LIMITS.line);
    check(`${role}.phone`, party.phone, CONTRACT_LIMITS.short);
    check(`${role}.email`, party.email, CONTRACT_LIMITS.line);
    check(`${role}.idNumber`, party.idNumber, CONTRACT_LIMITS.short);
    if (party.birthDate && !isDate(party.birthDate))
      errors[`${role}.birthDate`] = 'Bitte gib ein gültiges Datum an.';
  }

  for (const field of ['make', 'model', 'color', 'handoverPlace'] as const)
    check(field, values[field], CONTRACT_LIMITS.line);
  for (const field of ['plate', 'firstRegistration', 'registrationPart2Number'] as const)
    check(field, values[field], CONTRACT_LIMITS.short);
  for (const field of ['knownDefects', 'accessories', 'notIncluded', 'otherAgreements'] as const)
    check(field, values[field], CONTRACT_LIMITS.text, true);
  for (const statement of CONTRACT_STATEMENTS)
    check(`details.${statement}`, values.details[statement], CONTRACT_LIMITS.details, true);

  const vin = values.vin.replace(/\s/g, '');
  if (vin) {
    if (!/^[A-Z0-9]{1,17}$/i.test(vin))
      errors.vin = 'Die FIN besteht aus Buchstaben und Ziffern, höchstens 17 Zeichen.';
    else if (vin.length === 17 && /[IOQ]/i.test(vin))
      errors.vin = 'I, O und Q kommen in einer FIN nicht vor – meist ist 1 oder 0 gemeint.';
  }

  if (values.huUntil && !/^(0?[1-9]|1[0-2])\/\d{4}$/.test(values.huUntil.trim()))
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
  if (values.totalMileage === 'differs')
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

  for (const field of ['handoverDate', 'reRegisterBy'] as const)
    if (values[field] && !isDate(values[field])) errors[field] = 'Bitte gib ein gültiges Datum an.';
  if (
    values.registration === 'registered' &&
    values.reRegisterBy &&
    values.handoverDate &&
    !errors.reRegisterBy &&
    !errors.handoverDate &&
    values.reRegisterBy < values.handoverDate
  )
    errors.reRegisterBy = 'Die Ummeldung kann nicht vor der Übergabe liegen.';
  if (values.handoverTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(values.handoverTime))
    errors.handoverTime = 'Bitte gib eine Uhrzeit an, zum Beispiel 14:30.';

  return errors;
}

// ---------------------------------------------------------------------------
// The contract as printable blocks

export type ContractBlock =
  | { kind: 'title'; text: string; subtitle: string }
  | { kind: 'heading'; text: string }
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
    row('Name, Vorname', (party) => party.name.trim()),
    row('Straße, Hausnummer', (party) => party.street.trim()),
    row('PLZ, Ort', (party) => party.city.trim()),
    row('Geburtsdatum', (party) => formatDate(party.birthDate)),
    row('Telefon', (party) => party.phone.trim()),
    row('E-Mail', (party) => party.email.trim()),
    row('Ausweis- oder Passnummer', (party) => party.idNumber.trim()),
  ];
}

const EV_FUELS: ReadonlySet<FuelType | ''> = new Set(['electric', 'plugin_hybrid']);

export function saleContractBlocks(values: SaleContractValues): ContractBlock[] {
  const blocks: ContractBlock[] = [];
  const add = (...items: ContractBlock[]) => blocks.push(...items);

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
      text: 'Verkäufer und Käufer schließen diesen Vertrag als Privatpersonen. Der Verkäufer verkauft das Fahrzeug nicht im Rahmen einer gewerblichen oder selbständigen beruflichen Tätigkeit.',
    },
  );

  // § 2 Vehicle
  const keepers = parseWholeNumber(values.keepers);
  add(
    { kind: 'heading', text: '§ 2 Fahrzeug' },
    {
      kind: 'fields',
      rows: [
        { label: 'Hersteller', value: values.make.trim() },
        { label: 'Modell', value: values.model.trim() },
        {
          label: 'Fahrzeug-Identifizierungsnummer (FIN)',
          value: values.vin.replace(/\s/g, '').toUpperCase(),
        },
        { label: 'Amtliches Kennzeichen', value: values.plate.trim().toUpperCase() },
        { label: 'Erstzulassung', value: values.firstRegistration.trim() },
        {
          label: 'Nummer der Zulassungsbescheinigung Teil II',
          value: values.registrationPart2Number.trim().toUpperCase(),
        },
        { label: 'Leistung', value: amount(values.powerKw) && `${amount(values.powerKw)} kW` },
        {
          label: 'Kraftstoff oder Energiequelle',
          value: values.fuel ? FUEL_LABELS[values.fuel] : '',
        },
        { label: 'Farbe', value: values.color.trim() },
        { label: 'Hauptuntersuchung gültig bis', value: values.huUntil.trim() },
        {
          label: 'Zahl der Halter laut Zulassungsbescheinigung Teil II',
          value: keepers === null ? '' : String(keepers),
        },
        {
          label: 'Tachostand bei Übergabe (abgelesen)',
          value: amount(values.odometerKm) && `${amount(values.odometerKm)} km`,
        },
      ],
    },
    {
      kind: 'choice',
      text: 'Der Tachostand gibt nur wieder, was der Kilometerzähler anzeigt. Zur Gesamtlaufleistung des Fahrzeugs erklärt der Verkäufer:',
      options: [
        'Sie entspricht nach seiner Kenntnis dem Tachostand.',
        'Sie ist ihm nicht bekannt.',
        'Sie weicht vom Tachostand ab und beträgt nach seiner Kenntnis etwa:',
      ],
      checked:
        values.totalMileage === 'matches'
          ? 0
          : values.totalMileage === 'unknown'
            ? 1
            : values.totalMileage === 'differs'
              ? 2
              : null,
      detail: {
        option: 2,
        label: 'Gesamtlaufleistung',
        value:
          values.totalMileage === 'differs' && amount(values.totalMileageKm)
            ? `${amount(values.totalMileageKm)} km`
            : '',
      },
    },
  );
  if (EV_FUELS.has(values.fuel) || values.battery) {
    add({
      kind: 'choice',
      text: 'Die Antriebsbatterie',
      options: [
        'gehört zum Fahrzeug und wird mitverkauft.',
        'ist gemietet oder geleast; der Käufer klärt die Übernahme des Vertrags selbst mit dem Vermieter.',
      ],
      checked: values.battery === 'included' ? 0 : values.battery === 'rented' ? 1 : null,
    });
  }

  // § 3 Seller's statements
  add(
    { kind: 'heading', text: '§ 3 Angaben des Verkäufers' },
    {
      kind: 'paragraph',
      text: 'Der Verkäufer macht die folgenden Angaben zum Fahrzeug. Sie gehören zur vereinbarten Beschaffenheit. „Nicht bekannt“ bedeutet: Der Verkäufer weiß es nicht und macht dazu keine Angabe.',
    },
  );
  for (const statement of CONTRACT_STATEMENTS) {
    const labels = answerLabels(statement);
    const answer = values.answers[statement];
    add({
      kind: 'choice',
      text: CONTRACT_STATEMENT_TEXTS[statement].text,
      options: [labels.yes, labels.no, labels.unknown],
      checked: answer === 'yes' ? 0 : answer === 'no' ? 1 : answer === 'unknown' ? 2 : null,
      detail: {
        option: 0,
        label: 'Falls ja',
        value: answer === 'yes' ? values.details[statement].trim() : '',
      },
    });
  }
  add(
    {
      kind: 'lines',
      label: 'Weitere dem Verkäufer bekannte Mängel und Schäden',
      value: values.knownDefects.trim(),
      lines: 3,
    },
    {
      kind: 'paragraph',
      text: 'Die in diesem Paragrafen angegebenen Unfälle, Schäden und Mängel kennt der Käufer. Wegen dieser Punkte hat er keine Rechte gegen den Verkäufer, soweit sie zutreffend beschrieben sind.',
    },
    {
      kind: 'paragraph',
      text: 'Der Verkäufer erklärt, dass er dem Käufer das Eigentum am Fahrzeug frei von Rechten Dritter verschaffen kann. Das Fahrzeug ist insbesondere nicht finanziert, nicht zur Sicherheit übereignet und nicht gepfändet.',
    },
  );

  // § 4 Price and payment
  const price = priceText(values.price);
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
    {
      kind: 'choice',
      text: 'Der Käufer zahlt den Kaufpreis',
      options: [
        'bar bei der Übergabe.',
        'per Überweisung. Das Geld muss vor der Übergabe auf dem Konto des Verkäufers eingegangen sein.',
      ],
      checked: values.payment === 'cash' ? 0 : values.payment === 'transfer' ? 1 : null,
    },
  );
  if (deposit)
    add({
      kind: 'paragraph',
      text: `Eine Anzahlung von ${formatNumber(deposit)} Euro hat der Verkäufer bereits erhalten; er bestätigt das mit seiner Unterschrift unter diesem Vertrag. Sie wird auf den Kaufpreis angerechnet.`,
    });
  add({
    kind: 'paragraph',
    text: 'Das Fahrzeug bleibt bis zur vollständigen Zahlung des Kaufpreises Eigentum des Verkäufers. Fahrzeug, Schlüssel und Zulassungsbescheinigung Teil II übergibt der Verkäufer, sobald der Kaufpreis vollständig bezahlt ist.',
  });

  // § 5 Liability for defects
  add(
    { kind: 'heading', text: '§ 5 Haftung für Sachmängel' },
    {
      kind: 'paragraph',
      text: '(1) Das Fahrzeug wird gebraucht verkauft. Rechte und Ansprüche des Käufers wegen Sachmängeln sind ausgeschlossen, soweit sich aus Absatz 2 nichts anderes ergibt.',
    },
    {
      kind: 'paragraph',
      text: '(2) Der Ausschluss gilt nicht',
    },
    {
      kind: 'paragraph',
      text: 'a) für Ansprüche auf Schadensersatz wegen einer Verletzung des Lebens, des Körpers oder der Gesundheit, die auf einer fahrlässigen oder vorsätzlichen Pflichtverletzung des Verkäufers, seines gesetzlichen Vertreters oder seines Erfüllungsgehilfen beruht;',
    },
    {
      kind: 'paragraph',
      text: 'b) für Ansprüche auf Schadensersatz wegen sonstiger Schäden, die auf einer grob fahrlässigen oder vorsätzlichen Pflichtverletzung des Verkäufers, seines gesetzlichen Vertreters oder seines Erfüllungsgehilfen beruhen;',
    },
    { kind: 'paragraph', text: 'c) wenn der Verkäufer einen Mangel arglistig verschwiegen hat;' },
    {
      kind: 'paragraph',
      text: 'd) soweit der Verkäufer eine Garantie für die Beschaffenheit des Fahrzeugs übernommen hat;',
    },
    {
      kind: 'paragraph',
      text: 'e) soweit das Fahrzeug bei der Übergabe nicht die in diesem Vertrag vereinbarte Beschaffenheit hat, insbesondere nach § 2 und § 3.',
    },
    {
      kind: 'paragraph',
      text: '(3) Rechte des Käufers wegen Rechtsmängeln bleiben unberührt. Ansprüche gegen Dritte wegen Mängeln des Fahrzeugs, etwa aus einer Herstellergarantie, tritt der Verkäufer an den Käufer ab, soweit sie abtretbar sind.',
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
        { label: 'Übergabe in (Ort)', value: values.handoverPlace.trim() },
        { label: 'Zahl der Fahrzeugschlüssel', value: amount(values.keys) },
      ],
    },
    {
      kind: 'paragraph',
      text: 'Mit der Übergabe gehen die Gefahr des zufälligen Untergangs und der zufälligen Verschlechterung des Fahrzeugs, die Nutzungen und die Lasten auf den Käufer über. Der Verkäufer löst das Fahrzeug vor der Übergabe aus seinen Hersteller-Apps und Online-Diensten, soweit es dort verknüpft ist.',
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
      value: values.accessories.trim(),
      lines: 2,
    },
    {
      kind: 'lines',
      label: 'Nicht mitverkauft',
      value: values.notIncluded.trim(),
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
        `noch auf den Verkäufer zugelassen. Der Käufer meldet es spätestens am ${reRegisterBy || '_______________'} auf sich um; bis dahin bleiben die Kennzeichen am Fahrzeug.`,
      ],
      checked:
        values.registration === 'deregistered'
          ? 0
          : values.registration === 'registered'
            ? 1
            : null,
    },
    {
      kind: 'paragraph',
      text: 'Bleibt das Fahrzeug nach der Übergabe auf den Verkäufer zugelassen, erstattet der Käufer ihm die Kfz-Steuer und den Versicherungsbeitrag, die auf die Zeit ab der Übergabe entfallen. Von Bußgeldern, Gebühren und Ansprüchen Dritter, die ab der Übergabe durch den Gebrauch des Fahrzeugs entstehen, stellt der Käufer den Verkäufer frei.',
    },
    {
      kind: 'paragraph',
      text: 'Der Verkäufer zeigt den Verkauf unverzüglich seiner Kfz-Versicherung und der Zulassungsbehörde an und gibt dabei Namen und Anschrift des Käufers an.',
    },
  );

  // § 8 Other agreements, signatures
  add(
    { kind: 'heading', text: '§ 8 Weitere Vereinbarungen' },
    {
      kind: 'lines',
      value: values.otherAgreements.trim(),
      lines: 3,
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
      text: 'Der Käufer bestätigt, das Fahrzeug, die Schlüssel und die in § 6 angekreuzten Unterlagen erhalten zu haben.',
    },
    {
      kind: 'fields',
      rows: [
        { label: 'Datum und Uhrzeit der Übergabe', value: '' },
        { label: 'Tachostand bei Übergabe', value: '' },
        { label: 'Zahl der übergebenen Schlüssel', value: '' },
      ],
    },
    {
      kind: 'signatures',
      text: `Der Verkäufer bestätigt, den Kaufpreis von ${price.figures || '_______________ Euro'} vollständig erhalten zu haben.`,
      left: 'Verkäufer',
      right: 'Käufer',
    },
  );

  return blocks;
}
