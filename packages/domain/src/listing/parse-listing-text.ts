import type { ListingAttribute } from '@kaufcheck/shared';
import { cleanInline, cleanText, foldGerman, uniqueBy, wordCount } from '../text/text';
import { canonicalMake, findMakeInText, mapFuel, mapTransmission } from '../vehicle/vocabulary';
import {
  attributeKeyForLabel,
  KNOWN_LABELS,
  normalizeLabel,
  type AttributeKey,
} from './attribute-keys';
import { emptyParsedListing, stripTitleMarkers, type ParsedListing } from './parsed-listing';

/**
 * Parses listing text pasted by the user. Handles text copied from the pages
 * of Kleinanzeigen, mobile.de, AutoScout24, eBay and similar marketplaces
 * (labels and values on separate lines or on one line), "Label: Wert" lists
 * written by sellers and plain descriptions.
 */

const SECTION_HEADERS = new Map<string, 'details' | 'equipment' | 'description'>([
  ['details', 'details'],
  ['fahrzeugdetails', 'details'],
  ['fahrzeugdaten', 'details'],
  ['technische daten', 'details'],
  // AutoScout24 and eBay group their details under these headings.
  ['basisdaten', 'details'],
  ['fahrzeughistorie', 'details'],
  ['energieverbrauch', 'details'],
  ['farbe und innenausstattung', 'details'],
  ['artikelmerkmale', 'details'],
  ['ausstattung', 'equipment'],
  ['ausstattungsmerkmale', 'equipment'],
  ['extras', 'equipment'],
  ['komfort', 'equipment'],
  ['sicherheit', 'equipment'],
  ['unterhaltung/media', 'equipment'],
  ['unterhaltung / media', 'equipment'],
  ['beschreibung', 'description'],
  ['fahrzeugbeschreibung', 'description'],
  ['fahrzeugbeschreibung laut anbieter', 'description'],
  ['artikelbeschreibung', 'description'],
  ['artikelbeschreibung des verkaeufers', 'description'],
  ['beschreibung des verkaeufers', 'description'],
]);

/** Lines after which the listing itself ends (other listings follow). */
const PAGE_END_PREFIXES = [
  'aehnliche anzeigen',
  'weitere anzeigen',
  'anzeigen des anbieters',
  'mehr anzeigen des anbieters',
  'das koennte dich auch interessieren',
  'das koennte sie auch interessieren',
  'top-anzeigen',
  'aehnliche fahrzeuge',
  'aehnliche angebote',
  'aehnliche artikel',
  'weitere fahrzeuge des haendlers',
  'weitere angebote des haendlers',
  'fahrzeuge des haendlers',
];

/** Lines that end the description section (page chrome when copying the whole page). */
const TERMINATOR_PREFIXES = [
  'anzeigen-id',
  'anzeige melden',
  'aehnliche anzeigen',
  'weitere anzeigen',
  'anzeigen des anbieters',
  'das koennte dich auch interessieren',
  'sicherheitshinweis',
  'nachricht schreiben',
  'nachricht an',
  'verkaeufer kontaktieren',
  'top-anzeigen',
  'mehr anzeigen des anbieters',
  'haendler kontaktieren',
  'anbieter kontaktieren',
  'kontakt aufnehmen',
  'e-mail an den haendler',
  'e-mail an den anbieter',
  'aehnliche fahrzeuge',
  'aehnliche angebote',
  'aehnliche artikel',
];

const JUNK_LINES = new Set([
  'kleinanzeigen',
  'anzeige aufgeben',
  'meins',
  'nachrichten',
  'merkliste',
  'einloggen',
  'registrieren',
  'merken',
  'teilen',
  'drucken',
  'anrufen',
  'telefonnummer anzeigen',
  'sicher bezahlen',
  'direkt kaufen',
  'versand moeglich',
  'nur abholung',
  'zurueck',
  'zurueck zur suche',
  'startseite',
  'alle kategorien',
  'suchen',
  'finden',
  'filter',
  'profil ansehen',
  'folgen',
  'nutzer folgen',
  'freundlich',
  'sehr freundlich',
  'zuverlaessig',
  'top zufriedenheit',
  'besonders zufrieden',
  'privater nutzer',
  'gewerblicher nutzer',
  'privatanbieter',
  'gewerblicher anbieter',
  'verkaeufer',
  'anbieter',
  'details',
  'bilder',
  'fotos',
  'standort',
  'karte',
  'mehr',
  'weniger',
  'mehr anzeigen',
  'weniger anzeigen',
  'reserviert',
  'parken',
  'geparkt',
  'vergleichen',
  'melden',
  'beobachten',
  'auf die beobachtungsliste',
  'sofort-kaufen',
  'in den warenkorb',
  'preis vorschlagen',
  'probefahrt vereinbaren',
  'e-mail',
  'chat',
  'brutto',
  'netto',
  'inkl. mwst',
  'zurueck zu den suchergebnissen',
  'zurueck zur trefferliste',
  'haendler',
  'privat',
]);

const JUNK_PATTERNS: readonly RegExp[] = [
  /^\d+\s+ansichten?$/,
  /^antwortet\s/,
  /^aktiv seit\b/,
  /^(?:mehr als )?\d+\s+anzeigen?\s+online$/,
  /^\d+\s+follower$/,
  /^(?:bild|foto)\s+\d+\s+(?:von|\/)\s+\d+$/,
  /^\d+\s*\/\s*\d+$/,
  /cookie|datenschutzeinstellungen|zustimmen/,
  /^(?:heute|gestern),?\s+\d{1,2}:\d{2}$/,
];

const AMOUNT = String.raw`(?:\d{1,3}(?:[.\s]\d{3})*|\d+)(?:,\d{2}|,-)?`;
/** "8.450 € VB", "€ 18.900,-" (AutoScout24), "EUR 12.990,00" (eBay), "12.990 € (Brutto)" (mobile.de). */
const PRICE_LINE = new RegExp(
  String.raw`^(?:preis\s*:?\s*)?(?:ca\.\s*)?(?:(?:€|eur)\s*${AMOUNT}(?:\s*vb)?|${AMOUNT}\s*(?:€|eur|euro)\s*[¹²³*]?(?:\s*vb)?(?:\s*\(?(?:brutto|netto)\)?)?|vb|zu verschenken)$`,
  'i',
);
const LOCATION_LINE = /^(\d{5})\s+([A-ZÄÖÜ][\p{L}.' -]{1,60}?)(?:\s+-\s+([\p{L}.' -]{1,60}))?$/u;
const DATE_LINE =
  /^(?:\d{2}\.\d{2}\.\d{4}|heute(?:,\s*\d{1,2}:\d{2})?|gestern(?:,\s*\d{1,2}:\d{2})?)$/i;
const SELLER_TYPE =
  /(gewerblicher?\s+(?:nutzer|anbieter|händler|verkäufer)|privater?\s+(?:nutzer|anbieter|verkäufer))/i;
/** Seller lines on mobile.de, AutoScout24 and eBay ("Privatanbieter", "Händler"). */
const SELLER_TYPE_LINE = /^(privatanbieter|privatverkäufer|privat|händler|gewerblich)$/i;

function isJunk(line: string): boolean {
  const folded = foldGerman(line)
    .replace(/[.:!]+$/, '')
    .trim();
  return JUNK_LINES.has(folded) || JUNK_PATTERNS.some((pattern) => pattern.test(folded));
}

function headerType(line: string) {
  return SECTION_HEADERS.get(normalizeLabel(line)) ?? null;
}

function isPageEnd(line: string): boolean {
  const folded = foldGerman(line).trim();
  return PAGE_END_PREFIXES.some((prefix) => folded.startsWith(prefix));
}

/** Seller-box lines that follow the description when the whole page is copied. */
const TERMINATOR_LINES = new Set([
  'privater nutzer',
  'gewerblicher nutzer',
  'privatanbieter',
  'gewerblicher anbieter',
  'nutzer folgen',
]);

function isTerminator(line: string): boolean {
  const folded = foldGerman(line).trim();
  return (
    TERMINATOR_PREFIXES.some((prefix) => folded.startsWith(prefix)) ||
    TERMINATOR_LINES.has(folded.replace(/[.:]+$/, '')) ||
    /^aktiv seit\b/.test(folded) ||
    /^antwortet\s/.test(folded)
  );
}

/** Plausibility check for values found without an explicit "Label:" separator. */
function plausibleValue(key: AttributeKey, value: string): boolean {
  const v = value.trim();
  if (v.length === 0 || v.length > 60) return false;
  // Values are short facts, not sentences ("TÜV neu, Inspektion neu gemacht." is prose).
  if (/[.!?]\s+\S/.test(v) || /[!?]$/.test(v) || (/\.$/.test(v) && v.split(/\s+/).length > 2))
    return false;
  switch (key) {
    case 'mileage':
      return /\d/.test(v) && !/\d{2}\.\d{2}\.\d{4}/.test(v);
    case 'power':
      return /\d{2,4}\s*(?:ps|kw|hp)?\b/i.test(v) && v.length <= 30;
    case 'firstRegistration':
      return /\d{4}|\d{1,2}\s*[/.]\s*\d{2}/.test(v);
    case 'hu':
      return /\d{4}|\d{1,2}\s*[/.]\s*\d{2}/.test(v) || /^(?:neu|frisch|neu gemacht)$/i.test(v);
    case 'fuel':
      return mapFuel(v) !== null;
    case 'transmission':
      return mapTransmission(v) !== null;
    case 'make':
      return canonicalMake(v) !== null || findMakeInText(v) !== null;
    case 'previousOwners':
      return /^\d{1,2}\b/.test(v);
    case 'doors':
      return /^\d/.test(v);
    case 'price':
      return /\d|vb|verschenken/i.test(v);
    case 'bodyType':
      // AutoScout24's "Fahrzeugart" says new or used, not the body style.
      return (
        !/^(?:gebraucht|neu|neuwagen|jahreswagen|vorführ|tageszulassung|oldtimer)/i.test(v) &&
        v.split(/\s+/).length <= 5
      );
    default:
      return v.split(/\s+/).length <= 5;
  }
}

interface LineInfo {
  text: string;
  consumed: boolean;
}

/** Tries "Label: Wert", "Label Wert" (known labels only) on a single line. */
function matchInlineAttribute(
  line: string,
): { key: AttributeKey; label: string; value: string } | null {
  const colon = /^([^:]{2,40}):\s*(.+)$/.exec(line);
  if (colon?.[1] && colon[2]) {
    const key = attributeKeyForLabel(colon[1]);
    if (key && colon[2].length <= 120) {
      return { key, label: cleanInline(colon[1]), value: cleanInline(colon[2]) };
    }
  }
  const folded = foldGerman(line);
  for (const label of KNOWN_LABELS) {
    // Very short labels ("km", "ps", "ez") only count with an explicit colon.
    if (label.length < 4) continue;
    if (folded.startsWith(`${label} `)) {
      const key = attributeKeyForLabel(label);
      const value = line.slice(label.length).trim();
      if (key && plausibleValue(key, value)) {
        return { key, label: line.slice(0, label.length).trim(), value: cleanInline(value) };
      }
    }
  }
  return null;
}

function nextContentIndex(lines: LineInfo[], from: number): number {
  for (let j = from; j < lines.length; j += 1) {
    if ((lines[j]?.text.length ?? 0) > 0) return j;
  }
  return -1;
}

function looksLikeEquipmentItem(line: string): boolean {
  return (
    line.length <= 60 &&
    /\p{L}{2}/u.test(line) &&
    line.split(/\s+/).length <= 6 &&
    !/[.!?](?:\s|$)/.test(line)
  );
}

function splitEquipmentLine(line: string): string[] {
  return line
    .split(/\s*[,;•|·]\s*/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && part.length <= 60);
}

export function parseListingText(input: string): ParsedListing {
  const result = emptyParsedListing();
  const text = cleanText(input);
  const lines: LineInfo[] = text.split('\n').map((line) => ({ text: line, consumed: false }));

  // 1. Locate the description section; its content is never parsed as details.
  let descriptionStart = -1;
  let descriptionEnd = lines.length;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) continue;
    if (descriptionStart === -1 && headerType(line.text) === 'description') {
      descriptionStart = i + 1;
      line.consumed = true;
      continue;
    }
    if (descriptionStart !== -1 && (isTerminator(line.text) || isPageEnd(line.text))) {
      descriptionEnd = i;
      break;
    }
  }
  const inDescription = (index: number) =>
    descriptionStart !== -1 && index >= descriptionStart && index < descriptionEnd;

  // 2. Detail attributes and equipment outside the description.
  const attributes: ListingAttribute[] = [];
  const equipment: string[] = [];
  let section: 'details' | 'equipment' | null = null;
  const pageEnd = lines.findIndex((line, index) => !inDescription(index) && isPageEnd(line.text));
  const contentEnd = pageEnd === -1 ? lines.length : pageEnd;

  for (let i = 0; i < contentEnd; i += 1) {
    const line = lines[i];
    if (!line || line.text.length === 0) continue;
    if (inDescription(i) || isTerminator(line.text)) {
      // The equipment list never continues past the description or the seller box.
      section = null;
      continue;
    }
    if (line.consumed) continue;
    const header = headerType(line.text);
    if (header === 'details' || header === 'equipment') {
      section = header;
      line.consumed = true;
      continue;
    }

    const inline = matchInlineAttribute(line.text);
    if (inline) {
      line.consumed = true;
      section = section === 'equipment' ? null : section;
      if (inline.key === 'price') result.priceText ??= inline.value;
      else attributes.push({ label: inline.label, value: inline.value });
      continue;
    }

    const key = attributeKeyForLabel(line.text);
    if (key && line.text.length <= 40) {
      const valueIndex = nextContentIndex(lines, i + 1);
      const valueLine = valueIndex === -1 ? undefined : lines[valueIndex];
      if (
        valueLine &&
        valueIndex < contentEnd &&
        !inDescription(valueIndex) &&
        !attributeKeyForLabel(valueLine.text) &&
        !headerType(valueLine.text) &&
        plausibleValue(key, valueLine.text)
      ) {
        line.consumed = true;
        valueLine.consumed = true;
        section = section === 'equipment' ? null : section;
        if (key === 'price') result.priceText ??= cleanInline(valueLine.text);
        else attributes.push({ label: cleanInline(line.text), value: cleanInline(valueLine.text) });
        i = valueIndex;
        continue;
      }
    }

    if (section === 'equipment' && !isJunk(line.text)) {
      const parts = splitEquipmentLine(line.text);
      if (parts.length > 0 && parts.every(looksLikeEquipmentItem) && !/[.!?]$/.test(line.text)) {
        line.consumed = true;
        equipment.push(...parts);
      } else {
        // Prose after the equipment list (e.g. a description without header).
        section = null;
      }
    }
  }
  result.attributes = uniqueBy(attributes, (attribute) => normalizeLabel(attribute.label));
  result.equipment = uniqueBy(equipment, (item) => item.toLowerCase()).slice(0, 80);

  // 3. Price, location and date lines.
  let priceIndex = -1;
  for (let i = 0; i < contentEnd; i += 1) {
    const line = lines[i];
    if (!line || line.consumed || inDescription(i)) continue;
    if (!result.priceText && PRICE_LINE.test(line.text)) {
      result.priceText = line.text;
      line.consumed = true;
      priceIndex = i;
    } else if (!result.locationText && LOCATION_LINE.test(line.text)) {
      result.locationText = line.text;
      line.consumed = true;
    } else if (!result.postedAtText && DATE_LINE.test(line.text)) {
      result.postedAtText = line.text;
      line.consumed = true;
    }
  }

  // 4. Seller type, membership, ad id, status (outside the description).
  const outside = lines
    .filter((_, index) => !inDescription(index))
    .map((line) => line.text)
    .join('\n');
  const seller =
    SELLER_TYPE.exec(outside) ??
    lines
      .filter((_, index) => !inDescription(index))
      .map((line) => SELLER_TYPE_LINE.exec(line.text.trim()))
      .find((match) => match !== null);
  result.sellerTypeText = seller?.[1] ? cleanInline(seller[1]) : null;
  const member = /aktiv\s+seit\s+(\d{2}\.\d{2}\.\d{4})/i.exec(outside);
  result.memberSinceText = member?.[1] ?? null;
  const adId = /anzeigen-?id\s*:?\s*\n?\s*(\d{6,12})/i.exec(text);
  result.externalId = adId?.[1] ?? null;
  if (/^reserviert\b/im.test(outside)) result.status ??= 'reserved';
  if (/^gelöscht\b/im.test(outside)) result.status ??= 'deleted';

  // Breadcrumbs ("Auto, Rad & Boot › Autos › Audi") hint at the category.
  for (const line of lines) {
    if (/[›>»]/.test(line.text) && line.text.length <= 160) {
      result.categoryHints.push(
        ...line.text
          .split(/\s*[›>»]\s*/)
          .map((part) => part.trim())
          .filter((part) => part.length > 0 && part.length <= 60),
      );
      line.consumed = true;
    } else if (/^autos$/i.test(line.text)) {
      result.categoryHints.push('Autos');
    }
  }

  // 5. Title: the line right before the price, else the first line naming a make.
  const titleCandidate = (line: LineInfo | undefined): boolean =>
    !!line &&
    !line.consumed &&
    line.text.length >= 4 &&
    line.text.length <= 110 &&
    !isJunk(line.text) &&
    !headerType(line.text) &&
    !isTerminator(line.text) &&
    !/[.!?]\s+\S/.test(line.text) &&
    !line.text.endsWith(':');
  const searchEnd = Math.min(contentEnd, descriptionStart === -1 ? 25 : descriptionStart, 25);
  if (priceIndex > 0) {
    // The title is the line right before the price – or, when a subtitle such as
    // "Navi | LED | AHK" sits in between (mobile.de, AutoScout24), the nearest line naming a make.
    const nearby: LineInfo[] = [];
    for (let i = priceIndex - 1; i >= Math.max(0, priceIndex - 4) && nearby.length < 2; i -= 1) {
      const line = lines[i];
      if (!line || line.text.length === 0) continue;
      if (!titleCandidate(line)) break;
      nearby.push(line);
    }
    const line = nearby.find((candidate) => findMakeInText(candidate.text)) ?? nearby[0];
    if (line) {
      const { title, status } = stripTitleMarkers(line.text);
      result.title = title;
      result.status ??= status;
      line.consumed = true;
    }
  }
  if (!result.title) {
    for (let i = 0; i < searchEnd; i += 1) {
      const line = lines[i];
      if (titleCandidate(line) && line && findMakeInText(line.text) && !/[.!?]$/.test(line.text)) {
        const { title, status } = stripTitleMarkers(line.text);
        result.title = title;
        result.status ??= status;
        line.consumed = true;
        break;
      }
    }
  }

  // 6. Description: explicit section, else the remaining unconsumed prose.
  if (descriptionStart !== -1) {
    const description = cleanText(
      lines
        .slice(descriptionStart, descriptionEnd)
        .map((line) => line.text)
        .join('\n'),
    );
    result.description = description.length > 0 ? description : null;
  } else {
    const remaining = lines
      .slice(0, contentEnd)
      .filter((line) => !line.consumed && !isJunk(line.text) && !headerType(line.text))
      .map((line) => line.text);
    const description = cleanText(remaining.join('\n'));
    result.description = wordCount(description) >= 5 ? description : null;
  }

  return result;
}
