import type {
  AccidentHistoryType,
  FactSource,
  FieldProvenance,
  ListingAttribute,
  ServiceHistoryType,
  Vehicle,
  VehicleField,
} from '@kaufcheck/shared';
import { attributeKeyForLabel, type AttributeKey } from '../listing/attribute-keys';
import type { ParsedListing } from '../listing/parsed-listing';
import { parseYearMonth } from '../text/dates';
import { parseMileageKm, parsePower } from '../text/numbers';
import { cleanInline, foldGerman, snippetAround, truncate, uniqueBy } from '../text/text';
import type { DescriptionSignals } from './description-signals';
import {
  AWD_TOKEN,
  canonicalMake,
  findMakeInText,
  mapCondition,
  mapDrivetrain,
  mapFuel,
  mapTransmission,
} from './vocabulary';

/** Title words that describe the offer, not the vehicle ("TOP", "TÜV neu", …). */
const TITLE_NOISE =
  /^(?:top|tüv|hu|au|neu|vb|festpreis|scheckheft\w*|unfallfrei|garantie|tausch|finanzierung|euro\d?|export|motorschaden|defekt|gepflegt|zustand|sofort|preis|angebot|inzahlungnahme|reserviert|mit|und|ohne|aus|1\.?|2\.?|hand|km|tkm|ps|kw|navi|leder|xenon|led|ahk|panorama|pano|standheizung|shz|pdc|kamera|voll|vollausstattung|8-fach|mwst\.?)$/i;

const TOKEN = /^[\p{L}\p{N}][\p{L}\p{N}.+-]{0,15}$/u;

function titleTokensAfterMake(title: string): string[] {
  const match = findMakeInText(title);
  if (!match) return [];
  return title
    .slice(match.index + match.length)
    .split(/\s+/)
    .map((token) => token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}.+]+$/gu, ''))
    .filter((token) => token.length > 0);
}

function modelFromTitle(title: string): string | null {
  const tokens = titleTokensAfterMake(title);
  const first = tokens[0];
  if (!first || TITLE_NOISE.test(first) || !TOKEN.test(first)) return null;
  const second = tokens[1];
  // "C 220", "E 350", "X 5": single-letter model series followed by a number.
  if (/^[A-Z]$/.test(first) && second && /^\d{2,3}[a-z]?$/i.test(second))
    return `${first} ${second}`;
  return first;
}

/** Engine/trim designation from the title, e.g. "Sportback 3.0 TFSI quattro S tronic". */
export function deriveVariant(title: string | null, model: string | null): string | null {
  if (!title) return null;
  const tokens = titleTokensAfterMake(title);
  if (tokens.length === 0) return null;
  let start = 0;
  if (model) {
    const modelTokens = model.split(/\s+/).map((token) => token.toLowerCase());
    const index = tokens.findIndex((token) => token.toLowerCase() === modelTokens[0]);
    start = index === -1 ? 0 : index + modelTokens.length;
  }
  const variant: string[] = [];
  for (const token of tokens.slice(start)) {
    if (TITLE_NOISE.test(token) || !TOKEN.test(token) || /[*!|/,]/.test(token)) break;
    variant.push(token);
    if (variant.length === 6) break;
  }
  const result = variant.join(' ').trim();
  return result.length >= 2 ? result : null;
}

/**
 * The seller's title from the make onwards, without offer noise
 * ("BMW 530d Touring M Sport *TOP* TÜV neu" → "BMW 530d Touring M Sport").
 */
export function deriveVehicleTitle(title: string | null): string | null {
  if (!title) return null;
  const match = findMakeInText(title);
  if (!match) return null;
  const make = title.slice(match.index, match.index + match.length);
  const kept: string[] = [];
  for (const token of titleTokensAfterMake(title)) {
    if (TITLE_NOISE.test(token) || !TOKEN.test(token) || /[*!|/,]/.test(token)) break;
    kept.push(token);
    if (kept.length === 7) break;
  }
  return kept.length > 0 ? `${make} ${kept.join(' ')}` : null;
}

function yesNo(value: string): boolean | null {
  const v = foldGerman(value).trim();
  if (/^(ja|yes|vorhanden|j)$/.test(v)) return true;
  if (/^(nein|no|nicht vorhanden|n)$/.test(v)) return false;
  return null;
}

export function normalizeVehicle(
  parsed: ParsedListing,
  signals: DescriptionSignals,
  referenceDate: Date,
): Vehicle {
  const fieldSources: Partial<Record<VehicleField, FieldProvenance>> = {};
  const provenance = (field: VehicleField, source: FactSource, raw: string) => {
    fieldSources[field] = { source, raw: truncate(cleanInline(raw), 200) };
  };

  const details = new Map<AttributeKey, ListingAttribute>();
  for (const attribute of parsed.attributes) {
    const key = attributeKeyForLabel(attribute.label);
    if (key && !details.has(key)) details.set(key, attribute);
  }
  const detail = (key: AttributeKey) => details.get(key);
  const detailRaw = (attribute: ListingAttribute) => `${attribute.label}: ${attribute.value}`;
  const title = parsed.title;
  const description = parsed.description ?? '';

  // Make and model
  let make: string | null = null;
  const makeDetail = detail('make');
  if (makeDetail && !/^andere/i.test(makeDetail.value)) {
    make =
      canonicalMake(makeDetail.value) ??
      findMakeInText(makeDetail.value)?.make ??
      cleanInline(makeDetail.value);
    provenance('make', 'details', detailRaw(makeDetail));
  } else if (title && findMakeInText(title)) {
    make = findMakeInText(title)?.make ?? null;
    provenance('make', 'title', title);
  } else {
    const intro = description.slice(0, 300);
    const found = findMakeInText(intro);
    if (found) {
      make = found.make;
      provenance('make', 'description', snippetAround(intro, found.index, found.length));
    }
  }

  let model: string | null = null;
  const modelDetail = detail('model');
  if (modelDetail && !/^(andere|weitere|sonstige)/i.test(modelDetail.value)) {
    model = cleanInline(modelDetail.value);
    provenance('model', 'details', detailRaw(modelDetail));
  } else if (title) {
    model = modelFromTitle(title);
    if (model) provenance('model', 'title', title);
  }

  const variant = deriveVariant(title, model);
  if (variant && title) provenance('variant', 'title', title);

  // Mileage
  let mileageKm: number | null = null;
  const mileageDetail = detail('mileage');
  if (mileageDetail) {
    mileageKm = parseMileageKm(mileageDetail.value);
    if (mileageKm !== null) provenance('mileageKm', 'details', detailRaw(mileageDetail));
  }
  if (mileageKm === null && signals.mileageMentions[0]) {
    mileageKm = signals.mileageMentions[0].km;
    provenance('mileageKm', 'description', signals.mileageMentions[0].quote);
  }

  // First registration
  let firstRegistration: Vehicle['firstRegistration'] = null;
  const registrationDetail = detail('firstRegistration');
  if (registrationDetail) {
    firstRegistration = parseYearMonth(registrationDetail.value, referenceDate, 1);
    if (firstRegistration)
      provenance('firstRegistration', 'details', detailRaw(registrationDetail));
  }
  if (!firstRegistration && signals.registrationMentions[0]) {
    firstRegistration = signals.registrationMentions[0].value;
    provenance('firstRegistration', 'description', signals.registrationMentions[0].quote);
  }

  // Fuel
  let fuel: Vehicle['fuel'] = null;
  const fuelDetail = detail('fuel');
  if (fuelDetail) {
    fuel = mapFuel(fuelDetail.value);
    if (fuel) provenance('fuel', 'details', detailRaw(fuelDetail));
  }
  if (!fuel) {
    const titleFuels = new Set(
      signals.fuelMentions.filter((m) => m.source === 'title').map((m) => m.value),
    );
    const [only] = [...titleFuels];
    if (titleFuels.size === 1 && only && title) {
      fuel = only;
      provenance('fuel', 'title', title);
    }
  }
  if (!fuel) {
    const described = signals.fuelMentions.filter((m) => m.source === 'description');
    const [only] = described;
    if (described.length === 1 && only) {
      fuel = only.value;
      provenance('fuel', 'description', only.quote);
    }
  }

  // Power
  let powerKw: number | null = null;
  let powerPs: number | null = null;
  const powerDetail = detail('power');
  const detailPower = powerDetail ? parsePower(powerDetail.value) : null;
  if (powerDetail && detailPower) {
    powerKw = detailPower.kw;
    powerPs = detailPower.ps;
    provenance('power', 'details', detailRaw(powerDetail));
  } else {
    const mention =
      signals.powerMentions.find((m) => m.source === 'title') ?? signals.powerMentions[0] ?? null;
    if (mention) {
      const power = parsePower(`${mention.ps} PS`);
      if (power) {
        powerKw = power.kw;
        powerPs = power.ps;
        provenance('power', mention.source, mention.quote);
      }
    }
  }

  // Transmission
  let transmission: Vehicle['transmission'] = null;
  const transmissionDetail = detail('transmission');
  if (transmissionDetail) {
    transmission = mapTransmission(transmissionDetail.value);
    if (transmission) provenance('transmission', 'details', detailRaw(transmissionDetail));
  }
  if (
    !transmission &&
    signals.transmissionMentions.length === 1 &&
    signals.transmissionMentions[0]
  ) {
    transmission = signals.transmissionMentions[0].value;
    provenance('transmission', 'description', signals.transmissionMentions[0].quote);
  }

  // Drivetrain
  let drivetrain: Vehicle['drivetrain'] = null;
  const drivetrainDetail = detail('drivetrain');
  if (drivetrainDetail) {
    drivetrain = mapDrivetrain(drivetrainDetail.value);
    if (drivetrain) provenance('drivetrain', 'details', detailRaw(drivetrainDetail));
  }
  if (!drivetrain && title && AWD_TOKEN.test(title)) {
    drivetrain = 'awd';
    provenance('drivetrain', 'title', title);
  }
  if (!drivetrain) {
    const tag = parsed.equipment.find((item) => /allrad|4x4/i.test(item));
    if (tag) {
      drivetrain = 'awd';
      provenance('drivetrain', 'equipment', tag);
    }
  }
  if (!drivetrain) {
    const match = AWD_TOKEN.exec(description);
    if (match) {
      drivetrain = 'awd';
      provenance(
        'drivetrain',
        'description',
        snippetAround(description, match.index, match[0].length),
      );
    }
  }

  // HU
  let huUntil: Vehicle['huUntil'] = null;
  const huDetail = detail('hu');
  if (huDetail) {
    const value = parseYearMonth(huDetail.value, referenceDate, 4);
    if (value) {
      huUntil = value;
      provenance('huUntil', 'details', detailRaw(huDetail));
    }
  }
  if (!huUntil && signals.huMention) {
    huUntil = signals.huMention.value;
    provenance('huUntil', 'description', signals.huMention.quote);
  }

  // Previous owners
  let previousOwners: number | null = null;
  const ownersDetail = detail('previousOwners');
  const ownersValue = ownersDetail ? /^(\d{1,2})\b/.exec(ownersDetail.value.trim()) : null;
  if (ownersDetail && ownersValue?.[1]) {
    previousOwners = Number(ownersValue[1]);
    provenance('previousOwners', 'details', detailRaw(ownersDetail));
  } else if (signals.owners) {
    previousOwners = signals.owners.count;
    provenance('previousOwners', 'description', signals.owners.quote);
  }

  // Service history
  let serviceHistory: ServiceHistoryType | null = null;
  const serviceDetail = detail('serviceBook');
  const serviceYesNo = serviceDetail ? yesNo(serviceDetail.value) : null;
  const serviceTag = parsed.equipment.find((item) => /scheckheft/i.test(item));
  if (serviceDetail && serviceYesNo !== null) {
    serviceHistory = serviceYesNo ? 'documented' : 'none';
    provenance('serviceHistory', 'details', detailRaw(serviceDetail));
  } else if (serviceTag) {
    serviceHistory = 'documented';
    provenance('serviceHistory', 'equipment', serviceTag);
  } else if (signals.service) {
    serviceHistory = signals.service.value;
    provenance('serviceHistory', 'description', signals.service.quote);
  }

  // Condition and accident history
  const conditionDetail = detail('condition');
  const condition = conditionDetail ? mapCondition(conditionDetail.value) : null;
  if (conditionDetail && condition) provenance('condition', 'details', detailRaw(conditionDetail));

  let accidentHistory: AccidentHistoryType | null = null;
  const accidentDetail = detail('accidentFree');
  const accidentYesNo = accidentDetail ? yesNo(accidentDetail.value) : null;
  if (accidentDetail && accidentYesNo !== null) {
    const label = foldGerman(accidentDetail.label);
    const saysAccidentFree = label.includes('unfallfrei') ? accidentYesNo : !accidentYesNo;
    accidentHistory = saysAccidentFree ? 'accident_free' : 'previous_damage';
    provenance('accidentHistory', 'details', detailRaw(accidentDetail));
  } else if (conditionDetail && /unfall/i.test(conditionDetail.value)) {
    accidentHistory = 'previous_damage';
    provenance('accidentHistory', 'details', detailRaw(conditionDetail));
  } else if (signals.accident) {
    accidentHistory = signals.accident.value;
    provenance('accidentHistory', 'description', signals.accident.quote);
  }

  const simple = (key: AttributeKey, field: VehicleField): string | null => {
    const attribute = detail(key);
    if (!attribute) return null;
    provenance(field, 'details', detailRaw(attribute));
    return truncate(cleanInline(attribute.value), 60);
  };

  const equipment = uniqueBy(
    parsed.equipment
      .map((item) => truncate(cleanInline(item), 60))
      .filter((item) => item.length > 0),
    (item) => item.toLowerCase(),
  ).slice(0, 80);
  if (equipment.length > 0) provenance('equipment', 'equipment', equipment.slice(0, 5).join(', '));

  return {
    make,
    model,
    variant,
    mileageKm,
    firstRegistration,
    fuel,
    powerKw,
    powerPs,
    transmission,
    drivetrain,
    huUntil,
    previousOwners,
    serviceHistory,
    accidentHistory,
    condition,
    bodyType: simple('bodyType', 'bodyType'),
    color: simple('color', 'color'),
    doors: simple('doors', 'doors'),
    emissionClass: simple('emissionClass', 'emissionClass'),
    equipment,
    fieldSources,
  };
}
