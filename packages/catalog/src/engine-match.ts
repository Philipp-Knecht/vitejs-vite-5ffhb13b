/**
 * Maps the make and commercial name of the EEA's CO₂ monitoring data
 * („VOLKSWAGEN, VW“, „GOLF VARIANT“, „320D XDRIVE“) to KaufCheck's makes and
 * models. Names that fit no model are left out.
 */
import { foldName, MODELS, type ModelEntry } from './models';

const MAKE_PATTERNS: readonly [RegExp, string][] = [
  [/OLKSWAGEN|^VW\b/, 'vw'],
  [/^MERCEDES/, 'mercedes'],
  [/^BMW/, 'bmw'],
  [/^AUDI|^QUATTRO$/, 'audi'],
  [/^OPEL/, 'opel'],
  [/^FORD/, 'ford'],
  [/^SKODA/, 'skoda'],
  [/^SEAT/, 'seat'],
  [/^CUPRA/, 'cupra'],
  [/^RENAULT/, 'renault'],
  [/^DACIA/, 'dacia'],
  [/^PEUGEOT/, 'peugeot'],
  [/^CITROEN/, 'citroen'],
  [/^DS\b/, 'ds'],
  [/^FIAT|^ABARTH/, 'fiat'],
  [/^TOYOTA/, 'toyota'],
  [/^HYUNDAI(?!.*GENESIS)/, 'hyundai'],
  [/^KIA/, 'kia'],
  [/^NISSAN/, 'nissan'],
  [/^MAZDA/, 'mazda'],
  [/^VOLVO/, 'volvo'],
  [/^MINI/, 'mini'],
  [/^SMART/, 'smart'],
  [/^SUZUKI/, 'suzuki'],
  [/^HONDA/, 'honda'],
  [/^TESLA/, 'tesla'],
  [/^MITSUBISHI/, 'mitsubishi'],
  [/^JEEP/, 'jeep'],
  [/^PORSCHE/, 'porsche'],
  [/^LAND ?ROVER/, 'land-rover'],
  [/^ALFA/, 'alfa-romeo'],
  [/^MG\b/, 'mg'],
  [/^JAGUAR(?! LAND)/, 'jaguar'],
  [/^LEXUS/, 'lexus'],
  [/^SUBARU/, 'subaru'],
  [/^BYD/, 'byd'],
  [/^POLESTAR/, 'polestar'],
];

/** Makes whose models are also sold under the other name (Seat Leon Cupra, Citroën DS3). */
const RELATED_MAKES: Record<string, readonly string[]> = {
  seat: ['cupra'],
  cupra: ['seat'],
  citroen: ['ds'],
  ds: ['citroen'],
};

export function engineMakeId(mk: string | null): string | null {
  if (!mk) return null;
  const upper = mk.toUpperCase().trim();
  return MAKE_PATTERNS.find(([pattern]) => pattern.test(upper))?.[1] ?? null;
}

/** „i 30“ → „i30“, „ID.3“ → „id3“, „CX-30“ → „cx30“: a letter and the digits after it joined. */
const joinDigits = (value: string) => value.replace(/\b([a-z]{1,5})\s+(\d)/g, '$1$2');

const normalize = (value: string) => joinDigits(foldName(value));

/** Leading make names in the commercial name, also glued on: „MAZDA CX-5“, „AUDIA4“. */
const MAKE_WORDS =
  /^(volkswagen vw|volkswagen|vw|mercedes benz|mercedes amg|mercedes|amg|bmw|skoda|seat|cupra|toyota|mazda|peugeot|citroen|renault|dacia|fiat|abarth|opel|ford|hyundai|kia|nissan|honda|suzuki|mitsubishi|subaru|volvo|mini|smart|jeep|porsche|tesla|lexus|land rover|alfa romeo|alfa|jaguar|mg|byd|polestar|audi)\s*/;

/** After a key that ends in a digit, only a body or variant name may follow without a space. */
const AFTER_DIGIT =
  /^(avant|allroad|sportback|variant|kombi|cw|sw|touring|limousine|cabrio|coupe|tourer|plus|hybrid|e\b|gt\b|i\d)/;

function startsWithKey(name: string, key: string): boolean {
  if (name === key || name.startsWith(`${key} `)) return true;
  // Glued names: „GOLFPLUS“, „SPORTAGESLSLS“, „A4AVANT“, „I30I30CW“.
  const compactName = name.replace(/ /g, '');
  const compactKey = key.replace(/ /g, '');
  if (compactKey.length < 2 || !compactName.startsWith(compactKey)) return false;
  if (compactKey.length < 3 && !/\d$/.test(compactKey)) return false;
  const rest = compactName.slice(compactKey.length);
  return rest === '' || !/\d$/.test(compactKey) || AFTER_DIGIT.test(rest);
}

/** BMW names the engine: „118i“ is a 1er, „X1 xDrive25e“ an X1, „M440i“ a 4er. */
function bmwName(name: string): string {
  const series = /^m?([1-8])(?:\d\d[a-z]*|er)\b(.*)$/.exec(name);
  if (series) {
    // The body stays: „218i Active Tourer“ is a 2er Active Tourer, „220i Coupé“ a 2er Coupé.
    const body = series[2]!
      .replace(/\b(x|s)drive(\s?\d+[a-z]*)?\b|\biperformance\b|\bmild hybrid\b|\breihe\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return body ? `${series[1]}er ${body}` : `${series[1]}er`;
  }
  if (/^i3s?\b/.test(name)) return 'i3';
  return name;
}

/** Mercedes-Benz names the engine: „C 220 D“ is a C-Klasse, „GLC 300 DE“ a GLC. */
function mercedesName(name: string): string {
  const klasse = /^([abcesv])(?:\s?\d|\s?klasse|\s?class)/.exec(name);
  if (klasse) return `${klasse[1]} klasse`;
  return name;
}

interface Key {
  model: ModelEntry;
  key: string;
}

const keysByMake = new Map<string, Key[]>();

function keysOf(makeId: string): Key[] {
  let keys = keysByMake.get(makeId);
  if (keys) return keys;
  const makes = [makeId, ...(RELATED_MAKES[makeId] ?? [])];
  keys = MODELS.filter((model) => makes.includes(model.makeId))
    .flatMap((model) =>
      [...model.model.split('/'), ...(model.aliases ?? [])]
        .map(normalize)
        .filter(Boolean)
        .map((key) => ({ model, key })),
    )
    // The longest name first: „500X“ before „500“, „C3 Aircross“ before „C3“; for the same
    // name the make's own model („Leon“ of Cupra before the one of Seat).
    .sort(
      (a, b) =>
        b.key.length - a.key.length ||
        Number(b.model.makeId === makeId) - Number(a.model.makeId === makeId),
    );
  keysByMake.set(makeId, keys);
  return keys;
}

export function engineModelId(makeId: string, cn: string | null): string | null {
  if (!cn) return null;
  const folded = foldName(cn);
  let stripped = folded.replace(MAKE_WORDS, '');
  if (makeId === 'smart') stripped = stripped.replace(/^eq\s+/, '');
  // „MINI“ alone is the hatchback.
  if (makeId === 'mini') {
    // „Cooper S Countryman ALL4“ is a Countryman: the body decides, wherever it stands.
    if (/countryman/.test(stripped)) return 'mini-countryman';
    if (/clubman/.test(stripped)) return 'mini-clubman';
    // ALL4 (four-wheel drive) only came with Countryman, Clubman and Paceman.
    if (/paceman|coupe|roadster|all4/.test(stripped)) return null;
    if (stripped === '') return 'mini-cooper';
  }
  // Other models whose name starts like a catalog model.
  if (makeId === 'fiat' && /^500\s?l\b/.test(stripped)) return null;
  if (makeId === 'audi' && /\be ?tron gt\b/.test(stripped)) return null;
  if (makeId === 'toyota' && /^verso\s?s\b/.test(stripped)) return null;
  const names = new Set<string>();
  for (const base of [stripped, folded].filter(Boolean)) {
    let name = base;
    if (makeId === 'bmw') name = bmwName(name);
    if (makeId === 'mercedes') name = mercedesName(name);
    names.add(name);
    names.add(joinDigits(name));
  }
  for (const { model, key } of keysOf(makeId))
    for (const name of names) if (startsWithKey(name, key)) return model.id;
  return null;
}

/** Body and version words that do not make a model of their own. */
const BODY_WORDS =
  /\s+(cabriolet|cabrio|convertible|coupe|spyder|sportback|sportbrake|limousine|avant|plus|tdi|performance|srt)$/;

/** Porsche's versions: „Panamera 4S“, „Boxster S“, „Cayenne E-Hybrid“. */
const PORSCHE_VERSIONS = /\s+(4s|4|s|gts|turbo|diesel|e hybrid|hybrid)$/;

/**
 * Names in the EEA data that need a hand: a catalog model id („vw-up“) or
 * the name of the model („H-1“). Keys are folded names without spaces.
 */
const EXTRA_FIXES: Record<string, Record<string, string>> = {
  vw: { upue: 'vw-up' },
  kia: { edceed: 'kia-ceed', carensorrondo: 'Carens' },
  hyundai: { h1starexgrandstarex: 'H-1', i40: 'i40', ix20: 'ix20' },
  suzuki: { sx4suzukisx4: 'SX4', sx4suukisx4: 'SX4' },
  toyota: { landcruiser150: 'Land Cruiser', iq: 'iQ' },
  'land-rover': { discovery4: 'Discovery' },
  renault: { traffic: 'Trafic' },
  mazda: { cx60: 'CX-60', cx7: 'CX-7', mx30: 'MX-30' },
  mg: { ehspluginhybrid: 'EHS' },
  smart: { electricdrive: 'smart-fortwo' },
  mini: { johncooperworks: 'mini-cooper' },
  porsche: { '718boxster': 'Boxster', '718cayman': 'Cayman', panamera4: 'Panamera' },
  mitsubishi: { pajeromontero: 'Pajero' },
  'alfa-romeo': { mito: 'MiTo' },
  opel: { vivarob: 'Vivaro' },
  peugeot: { rcz: 'RCZ' },
  jaguar: { ftype: 'F-Type' },
  lexus: { ct200h: 'CT', nx300h: 'NX', rx450h: 'RX', ux250h: 'UX' },
  audi: { q440etron: 'Q4 e-tron', a8l: 'A8' },
};

/** Audi's sporty versions belong to the model: S3 and RS 3 to the A3, SQ5 to the Q5, TTS to the TT. */
function audiName(words: string[]): string[] {
  const joined = words
    .join(' ')
    .replace(/^(rs|s)\s?(\d)\b/, 'a$2')
    .replace(/^(rs|s)\s?(q\d)\b/, '$2');
  return joined.replace(/^tts\b/, 'tt').split(' ');
}

/**
 * A commercial name that fits no catalog model, as the key and name of a
 * model of its own („TOYOTA AVENSIS“ and „TOYOTAAVENSIS“ → „avensis“,
 * „Avensis“), or a catalog model it belongs to after all. Null for names that
 * stand for engines or are too vague (BMW and Mercedes-Benz name the engine,
 * „KOMBI“, „JA“).
 */
export function extraModel(
  makeId: string,
  cn: string | null,
): { key: string; name: string; makeId: string } | { modelId: string } | null {
  if (!cn || makeId === 'bmw' || makeId === 'mercedes') return null;
  let base = foldName(cn).replace(MAKE_WORDS, '');
  while (BODY_WORDS.test(base)) base = base.replace(BODY_WORDS, '');
  if (makeId === 'porsche')
    while (PORSCHE_VERSIONS.test(base)) base = base.replace(PORSCHE_VERSIONS, '');
  let words = base.split(' ').filter(Boolean);
  if (makeId === 'audi') words = audiName(words);
  if (words.length === 0 || ['kombi', 'pkw', 'limousine', 'ja'].includes(words.join(' ')))
    return null;
  let key = words.join('');
  // Citroën sold the DS models before DS became a make.
  const ownMake = makeId === 'citroen' && /^ds\d/.test(key) ? 'ds' : makeId;
  const fix = EXTRA_FIXES[ownMake]?.[key];
  if (fix && MODELS.some((model) => model.id === fix)) return { modelId: fix };
  if (fix) key = foldName(fix).replace(/ /g, '');
  if (key.length < 2) return null;
  const catalog = engineModelId(ownMake, words.join(' '));
  if (catalog) return { modelId: catalog };
  return { key, name: fix ?? words.map(wordName).join(' '), makeId: ownMake };
}

/** „sx4“ → „SX4“, „ds“ → „DS“, „avensis“ → „Avensis“. */
const wordName = (word: string) =>
  /\d/.test(word) || word.length <= 2 ? word.toUpperCase() : word[0]!.toUpperCase() + word.slice(1);

/** One typo, as in „IBIA“ for „IBIZA“: Levenshtein distance of at most 1. */
export function oneEditApart(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/** The catalog model one typo away from a name, for names of at least five letters. */
export function typoModelId(makeId: string, key: string): string | null {
  if (key.length < 4) return null;
  const found = keysOf(makeId).find(
    ({ key: modelKey }) => modelKey.length >= 5 && oneEditApart(modelKey.replace(/ /g, ''), key),
  );
  return found?.model.id ?? null;
}
