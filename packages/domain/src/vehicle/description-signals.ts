import type {
  AccidentHistoryType,
  FuelType,
  ServiceHistoryType,
  TransmissionType,
  YearMonth,
} from '@kaufcheck/shared';
import { parseYearMonth } from '../text/dates';
import { parseMileageKm, parsePower } from '../text/numbers';
import { snippetAround } from '../text/text';
import { DIESEL_TOKEN, PETROL_TOKEN } from './vocabulary';

/**
 * Statements a seller makes in the title or free-text description.
 * Every signal carries the verbatim snippet it was derived from, so the UI
 * can show the evidence and the user can judge it.
 */

export interface Quoted {
  quote: string;
}

export type DamageCategory =
  | 'engine'
  | 'transmission'
  | 'roadworthiness'
  | 'warning_light'
  | 'electrical'
  | 'rust'
  | 'body'
  | 'noise'
  | 'wear'
  | 'interior'
  | 'general';

export interface DamageMention extends Quoted {
  category: DamageCategory;
  severity: 'notice' | 'warning';
  term: string;
}

export type PositiveKey =
  | 'non_smoker'
  | 'garage'
  | 'new_brakes'
  | 'new_tires'
  | 'timing_renewed'
  | 'clutch_renewed'
  | 'german_vehicle'
  | 'second_tire_set';

export interface DescriptionSignals {
  mileageMentions: (Quoted & { km: number })[];
  registrationMentions: (Quoted & { value: YearMonth })[];
  buildYearMentions: (Quoted & { year: number })[];
  powerMentions: (Quoted & { ps: number; source: 'title' | 'description' })[];
  priceMentions: (Quoted & { amountEur: number })[];
  accident: (Quoted & { value: AccidentHistoryType; conflicting: boolean }) | null;
  accidentFreeClaim: Quoted | null;
  damageClaims: Quoted[];
  service: (Quoted & { value: ServiceHistoryType }) | null;
  owners: (Quoted & { count: number }) | null;
  huNew: Quoted | null;
  huMention: (Quoted & { value: YearMonth }) | null;
  damageMentions: DamageMention[];
  tuningMentions: Quoted[];
  emissionTampering: Quoted[];
  soldAs: (Quoted & { kind: 'bastler' | 'export' | 'defect' })[];
  commercialIndicators: Quoted[];
  privateSaleClaim: Quoted | null;
  vagueReferences: Quoted[];
  positives: (Quoted & { key: PositiveKey })[];
  transmissionMentions: (Quoted & { value: TransmissionType })[];
  fuelMentions: (Quoted & {
    value: Extract<FuelType, 'diesel' | 'petrol'>;
    source: 'title' | 'description';
  })[];
  importMention: Quoted | null;
  deregistered: Quoted | null;
  testDriveOffered: boolean;
  batteryInfo: Quoted | null;
}

interface Match {
  index: number;
  text: string;
  groups: (string | undefined)[];
}

/**
 * JavaScript's `\b` only knows ASCII letters, so `\bölverlust` would never
 * match. All patterns are compiled with a Unicode-aware word boundary.
 */
const WORD_CHAR = '[\\p{L}\\p{N}_]';
const UNICODE_BOUNDARY = `(?:(?<=${WORD_CHAR})(?!${WORD_CHAR})|(?<!${WORD_CHAR})(?=${WORD_CHAR}))`;
const compiledPatterns = new Map<string, RegExp>();

export function unicodeGlobal(pattern: RegExp): RegExp {
  const key = `${pattern.source}/${pattern.flags}`;
  let compiled = compiledPatterns.get(key);
  if (!compiled) {
    const flags = new Set([...pattern.flags, 'g', 'u']);
    compiled = new RegExp(pattern.source.replace(/\\b/g, UNICODE_BOUNDARY), [...flags].join(''));
    compiledPatterns.set(key, compiled);
  }
  compiled.lastIndex = 0;
  return compiled;
}

function allMatches(pattern: RegExp, text: string): Match[] {
  const matches: Match[] = [];
  for (const match of text.matchAll(unicodeGlobal(pattern))) {
    matches.push({ index: match.index, text: match[0], groups: match.slice(1) });
  }
  return matches;
}

function testPattern(pattern: RegExp, text: string): boolean {
  return allMatches(pattern, text).length > 0;
}

const NEGATIONS = /^(kein|keine|keinen|keinem|keiner|keines|nicht|ohne|nie|niemals)$/i;
const CLAUSE_BREAK =
  /[.!?\n;]|\b(?:aber|jedoch|allerdings|sonst|außer|ausser|bis auf|lediglich|nur)\b/gi;

/** True when a negation word precedes the match within the same clause (≤ 4 words). */
export function isNegated(text: string, index: number, length: number): boolean {
  const before = text.slice(Math.max(0, index - 60), index);
  let clauseStart = 0;
  for (const match of before.matchAll(unicodeGlobal(CLAUSE_BREAK))) {
    clauseStart = match.index + match[0].length;
  }
  const words = before
    .slice(clauseStart)
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}]/gu, ''))
    .filter((word) => word.length > 0)
    .slice(-4);
  if (words.some((word) => NEGATIONS.test(word))) return true;

  const after = text.slice(index + length, index + length + 50);
  return (
    testPattern(/^\s*[:=–-]\s*(?:nein|keine?[rsn]?|nicht\s+vorhanden)\b/i, after) ||
    testPattern(/^\s*(?:sind|ist|waren|war)?\s*(?:mir|uns)?\s*(?:nicht|keine)\s+bekannt\b/i, after)
  );
}

function quote(text: string, match: Match): string {
  return snippetAround(text, match.index, match.text.length);
}

function firstUnnegated(pattern: RegExp, text: string, allowNegated = false): Match | null {
  for (const match of allMatches(pattern, text)) {
    if (allowNegated || !isNegated(text, match.index, match.text.length)) return match;
  }
  return null;
}

// --- Accident history --------------------------------------------------------

const ACCIDENT_FREE_PATTERNS: readonly [RegExp, boolean][] = [
  // [pattern, negation-sensitive]
  [/\bunfallfrei(?:es|er|e|en)?\b/i, true],
  [
    /\bkein(?:e|en)?\s+(?:unfall|unfälle|unfallschaden|unfallschäden|vorschaden|vorschäden)\b/i,
    false,
  ],
  [
    /\b(?:ohne|frei\s+von)\s+(?:unfall|unfälle|unfallschaden|unfallschäden|vorschaden|vorschäden)\b/i,
    false,
  ],
  [/\bunfall\s*[:=]\s*(?:nein|keiner?)\b/i, false],
];

const PREVIOUS_DAMAGE_PATTERNS: readonly [RegExp, boolean][] = [
  [/\bnicht\s+unfallfrei\b/i, false],
  [
    /\b(?:unfallschaden|unfallschäden|vorschaden|vorschäden|unfallwagen|unfallfahrzeug|unfallauto)\b/i,
    true,
  ],
  [
    /\b(?:hatte|hat)\s+(?:mal\s+|schon\s+)?(?:einen|nen|1)\s+(?:kleinen\s+|leichten\s+)?(?:unfall|auffahrunfall|parkrempler|blechschaden)\b/i,
    false,
  ],
  [/\b(?:reparierter?|behobener?|instandgesetzter?)\s+(?:unfall-?|vor|blech)?schaden\b/i, false],
];

const UNREPAIRED_PATTERNS: readonly RegExp[] = [
  // Up to ~40 characters may sit between the damage and the statement ("… vorne rechts, noch nicht repariert").
  /\b(?:unfallschaden|unfallschäden|schaden|schäden)\b[^.!?\n]{0,40}?\b(?:nicht\s+repariert|unrepariert|nicht\s+behoben)\b/i,
  /\bunreparierte[rn]?\s+(?:unfall-?)?schaden\b/i,
];

function matchesFrom(patterns: readonly [RegExp, boolean][], text: string): Match[] {
  const found: Match[] = [];
  for (const [pattern, negationSensitive] of patterns) {
    for (const match of allMatches(pattern, text)) {
      if (negationSensitive && isNegated(text, match.index, match.text.length)) continue;
      found.push(match);
    }
  }
  return found.sort((a, b) => a.index - b.index);
}

// --- Service history ---------------------------------------------------------

const SERVICE_DOCUMENTED: readonly RegExp[] = [
  /\bscheckheft[\s-]*(?:gepflegt|gewartet)\b|\bscheckheftgepflegt\b/i,
  /\blückenlos(?:e|es|er|em)?\s+(?:scheckheft|serviceheft|servicehistorie|wartungshistorie|historie|dokumentation|nachweise?|wartung)\b/i,
  /\b(?:scheckheft|serviceheft|servicebuch|wartungsheft)\s+(?:ist\s+)?(?:vorhanden|lückenlos|gepflegt|komplett|vollständig|dabei)\b/i,
  /\b(?:alle|sämtliche)\s+(?:wartungs-?|werkstatt-?|service-?)?rechnungen\s+(?:sind\s+)?(?:vorhanden|dabei)\b/i,
  /\b(?:rechnungen|wartungsnachweise|servicenachweise)\s+(?:sind\s+)?(?:vorhanden|dabei)\b/i,
  /\bdigitale[sr]?\s+(?:serviceheft|scheckheft|servicehistorie)\b/i,
];

const SERVICE_CLAIMED: readonly RegExp[] = [
  /\bregelmäßig\s+(?:gewartet|gepflegt|in\s+der\s+werkstatt|zur\s+inspektion|inspiziert|beim\s+service)\b/i,
  /\b(?:inspektion|service|ölwechsel|kundendienst|wartung)\s+(?:ist\s+|wurde\s+)?(?:neu|frisch|gemacht|durchgeführt|erledigt)\b/i,
  /\b(?:neue|frische)\s+(?:inspektion|wartung)\b|\bfrisch\s+(?:gewartet|inspiziert)\b/i,
  /\b(?:immer|stets)\s+(?:gut\s+)?gewartet\b/i,
  /\bwerkstattgepflegt\b/i,
];

const SERVICE_NONE: readonly RegExp[] = [
  /\b(?:kein|ohne)\s+(?:scheckheft|serviceheft|servicebuch|wartungsnachweise?|rechnungen)\b/i,
  /\b(?:scheckheft|serviceheft|servicebuch)\s+(?:ist\s+)?(?:nicht\s+vorhanden|fehlt|verloren)\b/i,
];

// --- Damage and defects ------------------------------------------------------

const DAMAGE_TERMS: readonly {
  pattern: RegExp;
  category: DamageCategory;
  severity: 'notice' | 'warning';
  negationSensitive?: boolean;
}[] = [
  {
    pattern: /\bmotorschaden\b|\bmotor\s+(?:ist\s+)?defekt\b/i,
    category: 'engine',
    severity: 'warning',
  },
  {
    pattern: /\bgetriebeschaden\b|\bgetriebe\s+(?:ist\s+)?defekt\b/i,
    category: 'transmission',
    severity: 'warning',
  },
  {
    pattern:
      /\bkupplung\s+(?:rutscht|ist\s+defekt|defekt|kommt\s+spät|muss\s+(?:neu|gemacht\s+werden))\b/i,
    category: 'transmission',
    severity: 'warning',
  },
  {
    pattern: /\b(?:getriebe\s+)?(?:ruckelt|ruckeln|schaltet\s+(?:hart|ruppig|verzögert))\b/i,
    category: 'transmission',
    severity: 'notice',
  },
  {
    pattern: /\bölverlust\b|\bverliert\s+öl\b|\böl\s+tropft\b/i,
    category: 'engine',
    severity: 'warning',
  },
  { pattern: /\b(?:erhöhter\s+)?ölverbrauch\b/i, category: 'engine', severity: 'notice' },
  { pattern: /\bzylinderkopfdichtung\b/i, category: 'engine', severity: 'warning' },
  { pattern: /\bturbo(?:lader)?\s+(?:ist\s+)?defekt\b/i, category: 'engine', severity: 'warning' },
  {
    pattern:
      /\bspringt\s+nicht\s+(?:mehr\s+)?an\b|\bnicht\s+(?:fahrbereit|fahrtüchtig|fahrtauglich)\b|\bfährt\s+nicht\b/i,
    category: 'roadworthiness',
    severity: 'warning',
    negationSensitive: false,
  },
  {
    pattern: /\b(?:motorkontroll(?:leuchte|lampe)|motor-kontrollleuchte|mkl)\b/i,
    category: 'warning_light',
    severity: 'warning',
  },
  {
    pattern:
      /\b(?:airbag|abs|esp)-?(?:kontroll)?(?:leuchte|lampe)\b|\bkontrollleuchte\s+leuchtet\b|\bfehlermeldung(?:en)?\b|\bfehlerspeicher\b/i,
    category: 'warning_light',
    severity: 'notice',
  },
  {
    pattern:
      /\bklima(?:anlage)?\s+(?:ist\s+)?(?:defekt|kühlt\s+nicht|geht\s+nicht|funktioniert\s+nicht|muss\s+(?:neu\s+)?befüllt\s+werden|ist\s+leer)\b/i,
    category: 'electrical',
    severity: 'notice',
  },
  {
    pattern:
      /\belektrik(?:probleme?|fehler)\b|\b(?:elektrik|elektronik)\s+(?:spinnt|defekt)\b|\bsteuergerät\s+defekt\b/i,
    category: 'electrical',
    severity: 'notice',
  },
  { pattern: /\b(?:durchgerostet|rostloch|rostlöcher)\b/i, category: 'rust', severity: 'warning' },
  {
    pattern: /\brost(?:ansatz|ansätze|stellen?|blasen|nester|befall|schaden|schäden|spuren)?\b/i,
    category: 'rust',
    severity: 'notice',
  },
  {
    pattern:
      /\b(?:kratzer|delle|dellen|beule|beulen|steinschlag|steinschläge|lackschaden|lackschäden|lackplatzer|parkrempler|parkschaden|schramme|schrammen|macke|macken|hagelschaden)\b/i,
    category: 'body',
    severity: 'notice',
  },
  {
    pattern: /\b(?:nachlackiert|teillackiert|neu\s+lackiert)\b/i,
    category: 'body',
    severity: 'notice',
  },
  {
    pattern:
      /\b(?:frontscheibe|windschutzscheibe|scheibe)\s+(?:hat\s+(?:einen\s+)?)?(?:riss|gerissen|steinschlag)\b/i,
    category: 'body',
    severity: 'notice',
  },
  {
    pattern:
      /\bohne\s+(?:tüv|hu)\b|\b(?:tüv|hu)\s+(?:ist\s+)?abgelaufen\b|\bkein(?:en)?\s+(?:tüv|hu)\b/i,
    category: 'roadworthiness',
    severity: 'notice',
    negationSensitive: false,
  },
  {
    pattern:
      /\b(?:geräusch|geräusche|klappert|klappern|quietscht|quietschen|brummt|klackert|klackern|pfeift)\b/i,
    category: 'noise',
    severity: 'notice',
  },
  { pattern: /\b(?:verschlissen|abgefahren)\b/i, category: 'wear', severity: 'notice' },
  { pattern: /\b(?:mängel|mangel|mängelliste)\b/i, category: 'general', severity: 'notice' },
  {
    pattern:
      /\b(?:wasserschaden|feuchtigkeit\s+im\s+innenraum|schimmel|marderschaden|marderbiss|brandschaden)\b/i,
    category: 'interior',
    severity: 'notice',
  },
  { pattern: /\bdefekt(?:e|en|er|es)?\b/i, category: 'general', severity: 'notice' },
];

// --- Other claims ------------------------------------------------------------

const TUNING: readonly RegExp[] = [
  /\b(?:chip-?tuning|chipgetunt|leistungssteigerung|software-?optimierung|softwareoptimiert|software\s+optimiert|kennfeldoptimierung|stage\s*[123]|getunt)\b/i,
  /\b(?:tiefergelegt|tieferlegung|gewindefahrwerk|luftfahrwerk|distanzscheiben|spurverbreiterung)\b/i,
  /\b(?:sportauspuff|klappenauspuff|downpipe)\b/i,
];

const EMISSION_TAMPERING =
  /\b(?:dpf|partikelfilter|opf|kat|katalysator|agr|adblue)\s*(?:wurde\s+|ist\s+)?(?:entfernt|ausgeräumt|gelöscht|deaktiviert|stillgelegt|ausgebaut|off)\b|\b(?:dpf|agr|adblue)[\s-]?(?:off|delete)\b/i;

const SOLD_AS: readonly { kind: 'bastler' | 'export' | 'defect'; pattern: RegExp }[] = [
  { kind: 'bastler', pattern: /\b(?:für\s+)?bastler(?:fahrzeug|auto)?\b/i },
  { kind: 'export', pattern: /\b(?:nur\s+)?export\b/i },
  { kind: 'defect', pattern: /\bteileträger\b|\bschlachtfahrzeug\b|\bzum\s+ausschlachten\b/i },
];

const COMMERCIAL: readonly RegExp[] = [
  /\bfinanzierung\s+(?:ist\s+)?(?:möglich|auf\s+anfrage)\b/i,
  /\binzahlungnahme\s+(?:ist\s+)?möglich\b/i,
  /\b\d{1,2}\s+monate?\s+(?:gewährleistung|garantie)\b/i,
  /\b(?:gewährleistung|garantie)\s+(?:von\s+)?\d{1,2}\s+monate?\b/i,
  /\bmwst\.?\s+(?:ausweisbar|ausgewiesen)\b/i,
  /\bunser(?:e|em|en)?\s+(?:autohaus|firma|betrieb|showroom|verkaufsteam)\b|\bbesuchen\s+sie\s+uns\b|\böffnungszeiten\b/i,
  /\b(?:gebrauchtwagen)?garantie\s+(?:möglich|inklusive|inkl\.?|gegen\s+aufpreis)\b/i,
  /\bzulassungsservice\b|\büberführung\s+(?:ist\s+)?(?:möglich|gegen\s+aufpreis)\b/i,
];

const VAGUE: readonly RegExp[] = [
  /\b(?:details|infos|informationen|alles\s+weitere|rest|mehr)\s+(?:gerne\s+)?(?:bei\s+(?:der\s+)?besichtigung|vor\s+ort|telefonisch|am\s+telefon|per\s+(?:nachricht|mail|telefon)|auf\s+anfrage)\b/i,
  /\bbei\s+(?:fragen|interesse)\s+(?:einfach\s+)?(?:melden|schreiben|anrufen)\b/i,
];

const POSITIVES: readonly { key: PositiveKey; pattern: RegExp }[] = [
  { key: 'non_smoker', pattern: /\bnichtraucher(?:fahrzeug|auto|wagen)?\b/i },
  {
    key: 'garage',
    pattern:
      /\bgaragen(?:wagen|fahrzeug|auto)\b|\b(?:stand|steht|parkt)\s+(?:immer\s+)?in\s+(?:der|einer)\s+garage\b/i,
  },
  {
    key: 'new_brakes',
    pattern:
      /\b(?:bremsen|bremsscheiben|bremsbeläge|bremsanlage)\s+(?:vorne\s+|hinten\s+|rundum\s+)?(?:sind\s+|wurden\s+)?(?:neu|erneuert|gewechselt)\b|\bneue\s+bremsen\b/i,
  },
  {
    key: 'new_tires',
    pattern:
      /\b(?:neue|neuwertige)\s+(?:reifen|sommerreifen|winterreifen|ganzjahresreifen|allwetterreifen)\b|\breifen\s+(?:sind\s+)?(?:neu|neuwertig)\b/i,
  },
  {
    key: 'timing_renewed',
    pattern:
      /\bzahnriemen(?:wechsel|satz)?\s+(?:ist\s+|wurde\s+)?(?:neu|gemacht|erneuert|gewechselt)\b|\bneuer?\s+zahnriemen\b|\bsteuerkette\s+(?:ist\s+|wurde\s+)?(?:neu|erneuert|gewechselt)\b/i,
  },
  {
    key: 'clutch_renewed',
    pattern: /\bkupplung\s+(?:ist\s+|wurde\s+)?(?:neu|erneuert|gewechselt)\b|\bneue\s+kupplung\b/i,
  },
  {
    key: 'german_vehicle',
    pattern: /\bdeutsche[sr]?\s+(?:fahrzeug|auto|ausführung|erstauslieferung)\b/i,
  },
  {
    key: 'second_tire_set',
    pattern:
      /\bsommer-?\s*(?:und|&|\+|\/)\s*winterreifen\b|\bwinter-?\s*(?:und|&|\+|\/)\s*sommerreifen\b|\b8[\s-]?fach\s+bereift\b|\bzwei\s+(?:reifen)?sätze\b/i,
  },
];

const AUTOMATIC_TOKENS =
  /\b(?:automatik(?:getriebe)?|dsg|s[\s-]?tronic|tiptronic|steptronic|multitronic|[5-9]g-?tronic|pdk|powershift|doppelkupplungsgetriebe|wandlerautomatik)\b/i;
const MANUAL_TOKENS =
  /\b(?:schaltgetriebe|handschalter|handschaltung|manuelle[sr]?\s+getriebe|\d-gang[\s-]?(?:schaltgetriebe|schalter|handschaltung))\b/i;

// --- Numeric mentions ----------------------------------------------------------

const FILLER = String.raw`(?:\s*(?:[:=]|von|ca\.?|circa|etwa|rund|bei|beträgt|liegt|aktuell|zurzeit|derzeit|momentan|jetzt|nur|erst|zeigt|steht|genau|knapp|über|unter))*`;
const MILEAGE_NUMBER = String.raw`(\d{1,3}(?:[.\s]\d{3})+|\d{4,7}|\d{1,3}(?:[.,]\d)?\s*(?:tkm|tsd\.?(?:\s*km)?|tausend))`;
const MILEAGE_BEFORE = new RegExp(
  String.raw`\b(?:kilometerstand|km-?stand|km\s+stand|laufleistung|tachostand|tacho)${FILLER}\s*${MILEAGE_NUMBER}\s*(?:km|kilometer)?`,
  'gi',
);
// A plain number needs an explicit unit ("185.000 km gelaufen"); "142 Tkm gelaufen" carries its own.
const MILEAGE_AFTER = new RegExp(
  String.raw`(?:(\d{1,3}(?:[.\s]\d{3})+|\d{4,7})\s*(?:km|kilometer)|(\d{1,3}(?:[.,]\d)?\s*(?:tkm|tsd\.?\s*km|tausend\s*km)))\s+(?:gelaufen|gefahren|laufleistung|auf\s+dem\s+tacho|runter|drauf)`,
  'gi',
);
const REGISTRATION =
  /\b(?:ez|erstzulassung|erstzul\.?|erstmals\s+zugelassen|zugelassen\s+seit)\s*[:.]?\s*(?:im\s+|am\s+)?((?:\d{1,2}\s*[./-]\s*)?\d{4}|\d{1,2}\s*[./]\s*\d{2}\b|[a-zäöü]{3,9}\.?\s+\d{4})/gi;
const BUILD_YEAR = /\b(?:baujahr|bj\.?)\s*[:.]?\s*((?:\d{1,2}\s*[./]\s*)?\d{4})\b/gi;
const HU_DATE =
  /\b(?:tüv|hu|hu\/au|hauptuntersuchung)\s*(?:bis|gültig\s+bis|neu\s+bis)?\s*[:.]?\s*((?:\d{1,2}\s*[./]\s*)\d{2,4}|[a-zäöü]{3,9}\.?\s+\d{4})/gi;
const HU_NEW =
  /\b(?:tüv|hu|hu\/au|hauptuntersuchung)\s+(?:ist\s+|wurde\s+)?(?:neu|frisch|gerade\s+(?:neu\s+)?gemacht|neu\s+gemacht)\b|\b(?:neuer?|frischer?)\s+(?:tüv|hu)\b/i;
const PRICE_MENTION =
  /\b(?:preis(?:vorstellung)?|festpreis|verhandlungsbasis|kaufpreis)\s*(?::|von|liegt\s+bei|ist|beträgt)?\s*(?:ca\.?\s*)?(\d{1,3}(?:\.\d{3})+|\d{3,7})(?:,-|,00)?\s*(?:€|euro|eur)?/gi;
const OWNERS_PATTERNS: readonly { pattern: RegExp; count: (m: Match) => number | null }[] = [
  { pattern: /\b([1-9])\.\s*hand\b/gi, count: (m) => Number(m.groups[0]) },
  {
    pattern: /\b(?:aus\s+)?(erste[rn]?|zweite[rn]?|dritte[rn]?|vierte[rn]?)\s+hand\b/gi,
    count: (m) =>
      ({ erst: 1, zwei: 2, drit: 3, vier: 4 })[(m.groups[0] ?? '').slice(0, 4).toLowerCase()] ??
      null,
  },
  { pattern: /\berstbesitz(?:er)?\b|\berster\s+besitzer\b/gi, count: () => 1 },
  {
    pattern: /\b([1-9])\s*(?:vorbesitzer|halter|fahrzeughalter|vorhalter)\b/gi,
    count: (m) => Number(m.groups[0]),
  },
  {
    pattern: /\b(?:vorbesitzer|fahrzeughalter|halter)\s*[:=]\s*([1-9])\b/gi,
    count: (m) => Number(m.groups[0]),
  },
];

const PER_YEAR =
  /^\s*(?:km|kilometer)?\s*(?:pro|im|je|\/)\s*jahr|^\s*(?:km|kilometer)?\s*jährlich/i;

function extractMileage(text: string): DescriptionSignals['mileageMentions'] {
  const mentions: DescriptionSignals['mileageMentions'] = [];
  for (const pattern of [MILEAGE_BEFORE, MILEAGE_AFTER]) {
    for (const match of allMatches(pattern, text)) {
      const raw = match.groups.find((group) => group !== undefined);
      if (!raw) continue;
      // "15.000 km pro Jahr" is a yearly figure, not the odometer reading.
      if (
        PER_YEAR.test(
          text.slice(match.index + match.text.length, match.index + match.text.length + 25),
        )
      )
        continue;
      const km = parseMileageKm(raw);
      if (km === null || km < 100) continue;
      mentions.push({ km, quote: quote(text, match) });
    }
  }
  return mentions;
}

function extractPower(
  text: string,
  source: 'title' | 'description',
): DescriptionSignals['powerMentions'] {
  const mentions: DescriptionSignals['powerMentions'] = [];
  for (const match of allMatches(/\b(\d{2,4})\s*(?:ps|hp|kw)\b/gi, text)) {
    const power = parsePower(match.text);
    if (power) mentions.push({ ps: power.ps, source, quote: quote(text, match) });
  }
  return mentions;
}

export function extractDescriptionSignals(
  description: string | null,
  title: string | null,
  referenceDate: Date,
): DescriptionSignals {
  const text = description ?? '';
  const titleText = title ?? '';
  const combined = `${titleText}\n${text}`;

  // Accident history
  const free = matchesFrom(ACCIDENT_FREE_PATTERNS, combined);
  const previous = matchesFrom(PREVIOUS_DAMAGE_PATTERNS, combined);
  const unrepaired = UNREPAIRED_PATTERNS.map((pattern) => firstUnnegated(pattern, combined)).filter(
    (match): match is Match => match !== null,
  );
  let accident: DescriptionSignals['accident'] = null;
  const conflicting = free.length > 0 && (previous.length > 0 || unrepaired.length > 0);
  if (unrepaired[0]) {
    accident = { value: 'unrepaired_damage', quote: quote(combined, unrepaired[0]), conflicting };
  } else if (previous[0]) {
    accident = { value: 'previous_damage', quote: quote(combined, previous[0]), conflicting };
  } else if (free[0]) {
    accident = { value: 'accident_free', quote: quote(combined, free[0]), conflicting: false };
  }

  // Service history: an explicit "no records" statement wins.
  let service: DescriptionSignals['service'] = null;
  const none = SERVICE_NONE.map((pattern) => firstUnnegated(pattern, combined, true)).find(Boolean);
  const documented = SERVICE_DOCUMENTED.map((pattern) => firstUnnegated(pattern, combined)).find(
    Boolean,
  );
  const documentedNegated = SERVICE_DOCUMENTED.map((pattern) =>
    firstUnnegated(pattern, combined, true),
  ).find((match) => match && isNegated(combined, match.index, match.text.length));
  const claimed = SERVICE_CLAIMED.map((pattern) => firstUnnegated(pattern, combined)).find(Boolean);
  if (none) service = { value: 'none', quote: quote(combined, none) };
  else if (documentedNegated)
    service = { value: 'none', quote: quote(combined, documentedNegated) };
  else if (documented) service = { value: 'documented', quote: quote(combined, documented) };
  else if (claimed) service = { value: 'claimed', quote: quote(combined, claimed) };

  // Owners
  let owners: DescriptionSignals['owners'] = null;
  for (const { pattern, count } of OWNERS_PATTERNS) {
    const match = allMatches(pattern, combined)[0];
    const value = match ? count(match) : null;
    if (match && value !== null && value >= 1 && value <= 20) {
      owners = { count: value, quote: quote(combined, match) };
      break;
    }
  }

  // HU
  const huNewMatch = firstUnnegated(HU_NEW, combined);
  let huMention: DescriptionSignals['huMention'] = null;
  for (const match of allMatches(HU_DATE, combined)) {
    const value = match.groups[0] ? parseYearMonth(match.groups[0], referenceDate, 4) : null;
    if (value?.month) {
      huMention = { value, quote: quote(combined, match) };
      break;
    }
  }

  // Damage mentions (specific terms first; generic "defekt" only if not overlapping)
  const damageMentions: DamageMention[] = [];
  const covered: [number, number][] = [];
  for (const term of DAMAGE_TERMS) {
    for (const match of allMatches(term.pattern, text)) {
      const start = match.index;
      const end = match.index + match.text.length;
      if (covered.some(([a, b]) => start < b + 12 && end > a - 12)) continue;
      if ((term.negationSensitive ?? true) && isNegated(text, start, match.text.length)) continue;
      covered.push([start, end]);
      damageMentions.push({
        category: term.category,
        severity: term.severity,
        term: match.text,
        quote: quote(text, match),
      });
    }
  }

  const registrationMentions: DescriptionSignals['registrationMentions'] = [];
  for (const match of allMatches(REGISTRATION, combined)) {
    const value = match.groups[0] ? parseYearMonth(match.groups[0], referenceDate, 1) : null;
    if (value) registrationMentions.push({ value, quote: quote(combined, match) });
  }
  const buildYearMentions: DescriptionSignals['buildYearMentions'] = [];
  for (const match of allMatches(BUILD_YEAR, combined)) {
    const value = match.groups[0] ? parseYearMonth(match.groups[0], referenceDate, 1) : null;
    if (value) buildYearMentions.push({ year: value.year, quote: quote(combined, match) });
  }
  const priceMentions: DescriptionSignals['priceMentions'] = [];
  for (const match of allMatches(PRICE_MENTION, text)) {
    const raw = match.groups[0];
    const amount = raw ? Number(raw.replace(/\./g, '')) : NaN;
    if (Number.isFinite(amount) && amount >= 100)
      priceMentions.push({ amountEur: amount, quote: quote(text, match) });
  }

  const transmissionMentions: DescriptionSignals['transmissionMentions'] = [];
  const automatic = firstUnnegated(AUTOMATIC_TOKENS, combined);
  if (automatic)
    transmissionMentions.push({ value: 'automatic', quote: quote(combined, automatic) });
  const manual = firstUnnegated(MANUAL_TOKENS, combined);
  if (manual) transmissionMentions.push({ value: 'manual', quote: quote(combined, manual) });

  const fuelMentions: DescriptionSignals['fuelMentions'] = [];
  const titleDiesel = allMatches(DIESEL_TOKEN, titleText)[0];
  if (titleDiesel) fuelMentions.push({ value: 'diesel', source: 'title', quote: titleText });
  const titlePetrol = allMatches(PETROL_TOKEN, titleText)[0];
  if (titlePetrol) fuelMentions.push({ value: 'petrol', source: 'title', quote: titleText });

  const descriptionFuels = new Map<'diesel' | 'petrol', Match>();
  for (const [value, pattern] of [
    ['diesel', /\b(?:diesel|tdi|cdi|crdi|hdi|dci|tdci|cdti)\b/i],
    ['petrol', /\b(?:benziner|benzin|benzinmotor|tsi|tfsi)\b/i],
  ] as const) {
    const match = firstUnnegated(pattern, text);
    if (match) descriptionFuels.set(value, match);
  }
  for (const [value, match] of descriptionFuels) {
    fuelMentions.push({ value, source: 'description', quote: quote(text, match) });
  }

  const tuningMentions = TUNING.map((pattern) => firstUnnegated(pattern, combined))
    .filter((match): match is Match => match !== null)
    .map((match) => ({ quote: quote(combined, match) }));
  const tampering = allMatches(EMISSION_TAMPERING, combined).map((match) => ({
    quote: quote(combined, match),
  }));

  const soldAs = SOLD_AS.flatMap(({ kind, pattern }) => {
    const match = firstUnnegated(pattern, combined);
    return match ? [{ kind, quote: quote(combined, match) }] : [];
  });

  const commercialIndicators = COMMERCIAL.map((pattern) => firstUnnegated(pattern, text))
    .filter((match): match is Match => match !== null)
    .map((match) => ({ quote: quote(text, match) }));
  const privateSale = firstUnnegated(
    /\bprivatverkauf\b|\bprivater\s+verkauf\b|\bverkauf\s+von\s+privat\b/i,
    text,
  );

  const vagueReferences = VAGUE.map((pattern) => firstUnnegated(pattern, text))
    .filter((match): match is Match => match !== null)
    .map((match) => ({ quote: quote(text, match) }));

  const positives = POSITIVES.flatMap(({ key, pattern }) => {
    const match = firstUnnegated(pattern, combined);
    return match ? [{ key, quote: quote(combined, match) }] : [];
  });

  const importMatch = firstUnnegated(
    /\b(?:re-?)?import(?:fahrzeug|wagen|auto)?\b|\b(?:eu|us)-?(?:fahrzeug|import|modell)\b/i,
    combined,
  );
  const deregistered = firstUnnegated(/\babgemeldet\b/i, text);
  const battery = firstUnnegated(
    /\b(?:soh|state\s+of\s+health|batterie-?(?:zertifikat|zustand|check|gutachten)|akku-?(?:zertifikat|zustand|check)|batteriekapazität)\b/i,
    combined,
  );

  return {
    mileageMentions: extractMileage(text),
    registrationMentions,
    buildYearMentions,
    powerMentions: [...extractPower(titleText, 'title'), ...extractPower(text, 'description')],
    priceMentions,
    accident,
    accidentFreeClaim: free[0] ? { quote: quote(combined, free[0]) } : null,
    damageClaims: [...previous, ...unrepaired].map((match) => ({ quote: quote(combined, match) })),
    service,
    owners,
    huNew: huNewMatch ? { quote: quote(combined, huNewMatch) } : null,
    huMention,
    damageMentions,
    tuningMentions,
    emissionTampering: tampering,
    soldAs,
    commercialIndicators,
    privateSaleClaim: privateSale ? { quote: quote(text, privateSale) } : null,
    vagueReferences,
    positives,
    transmissionMentions,
    fuelMentions,
    importMention: importMatch ? { quote: quote(combined, importMatch) } : null,
    deregistered: deregistered ? { quote: quote(text, deregistered) } : null,
    testDriveOffered: testPattern(
      /\bprobefahrt\s+(?:ist\s+)?(?:möglich|nach\s+(?:absprache|vereinbarung)|gerne|jederzeit)\b/i,
      text,
    ),
    batteryInfo: battery ? { quote: quote(combined, battery) } : null,
  };
}
