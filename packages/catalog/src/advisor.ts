import type { GenerationSummary, ModelSummary } from './knowledge-index';
import type { SearchFuel } from './search-query';
import type { Segment } from './types';

/**
 * The car advisor: ranks the researched models for a person's needs. It is a
 * transparent points system, not a buying recommendation – every suggestion
 * comes with the reasons that led to it.
 */
export const USAGES = ['stadt', 'pendeln', 'familie', 'gepaeck', 'anhaenger'] as const;
export type Usage = (typeof USAGES)[number];

export const USAGE_LABELS: Record<Usage, string> = {
  stadt: 'Stadt und Kurzstrecke',
  pendeln: 'Pendeln und Langstrecke',
  familie: 'Familie und Alltag',
  gepaeck: 'Freizeit und viel Gepäck',
  anhaenger: 'Anhänger oder Wohnwagen ziehen',
};

export const MILEAGES = ['wenig', 'mittel', 'viel'] as const;
export type Mileage = (typeof MILEAGES)[number];

export const MILEAGE_LABELS: Record<Mileage, string> = {
  wenig: 'unter 10.000 km',
  mittel: '10.000 bis 20.000 km',
  viel: 'über 20.000 km',
};

export const PEOPLE = [2, 4, 5, 7] as const;
export type People = (typeof PEOPLE)[number];

export const PRIORITIES = ['zuverlaessigkeit', 'kosten', 'komfort', 'platz', 'umwelt'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_LABELS: Record<Priority, string> = {
  zuverlaessigkeit: 'Zuverlässigkeit',
  kosten: 'Niedrige Kosten',
  komfort: 'Komfort',
  platz: 'Viel Platz',
  umwelt: 'Umwelt und Verbrauch',
};

export interface AdvisorAnswers {
  /** Highest purchase price in euros. */
  budget: number | null;
  usage: Usage | null;
  mileage: Mileage | null;
  people: People | null;
  /** Can charge at home or at work. */
  charging: boolean | null;
  transmission: 'manual' | 'automatic' | null;
  /** At most two. */
  priorities: Priority[];
}

export interface Recommendation {
  model: ModelSummary;
  /** The newest generation that fits the answers. */
  generation: GenerationSummary;
  score: number;
  reasons: string[];
  /** Fuels that suit the person, among those the generation offers. */
  fuels: SearchFuel[];
}

const USAGE_FIT: Record<Usage, Partial<Record<Segment, number>>> = {
  stadt: { kleinstwagen: 3, kleinwagen: 3, kompakt: 2, suv_klein: 2, van_klein: 1 },
  pendeln: {
    kompakt: 3,
    mittelklasse: 3,
    obere_mittelklasse: 3,
    oberklasse: 2,
    suv_kompakt: 2,
    suv_mittel: 2,
    kleinwagen: 1,
  },
  familie: {
    van: 3,
    hochdachkombi: 3,
    suv_kompakt: 3,
    suv_mittel: 3,
    van_klein: 2,
    kompakt: 2,
    mittelklasse: 2,
    bus: 2,
  },
  gepaeck: {
    van: 3,
    hochdachkombi: 3,
    bus: 3,
    suv_mittel: 2,
    suv_gross: 2,
    mittelklasse: 2,
    obere_mittelklasse: 2,
  },
  anhaenger: {
    suv_mittel: 3,
    suv_gross: 3,
    obere_mittelklasse: 2,
    mittelklasse: 2,
    bus: 2,
    van: 1,
  },
};

const USAGE_REASONS: Record<Usage, string> = {
  stadt: 'Handlich für Stadt und Kurzstrecke',
  pendeln: 'Komfortabel auf langen Strecken',
  familie: 'Alltagstauglich für die Familie',
  gepaeck: 'Viel Platz für Gepäck und Freizeit',
  anhaenger: 'Geeignet als Zugfahrzeug',
};

/** Fuels that fit the driving profile, in order of preference. */
function preferredFuels(answers: AdvisorAnswers): SearchFuel[] {
  const fuels: SearchFuel[] = [];
  if (answers.charging) fuels.push('electric', 'plugin_hybrid');
  if (answers.mileage === 'viel') fuels.push('diesel');
  fuels.push('hybrid', 'petrol');
  if (answers.mileage !== 'wenig' && !fuels.includes('diesel')) fuels.push('diesel');
  return fuels;
}

/**
 * Rough new price of a class in euros (mid trim, list prices of the last
 * decade). The sources name no used prices for most generations, so the
 * advisor estimates which model years a budget reaches from class and age –
 * a rule of thumb; the marketplaces show the real prices.
 */
const NEW_PRICE_EUR: Record<Segment, number> = {
  kleinstwagen: 14_000,
  kleinwagen: 20_000,
  kompakt: 29_000,
  mittelklasse: 38_000,
  obere_mittelklasse: 52_000,
  oberklasse: 90_000,
  suv_klein: 24_000,
  suv_kompakt: 33_000,
  suv_mittel: 45_000,
  suv_gross: 65_000,
  van_klein: 27_000,
  van: 34_000,
  hochdachkombi: 30_000,
  bus: 50_000,
  sportwagen: 45_000,
};

/** Makes whose cars cost clearly more (or less) than their class's average. */
const MAKE_PRICE_FACTOR: Readonly<Record<string, number>> = {
  Audi: 1.2,
  BMW: 1.2,
  'Mercedes-Benz': 1.2,
  Volvo: 1.2,
  Lexus: 1.2,
  Jaguar: 1.2,
  'Land Rover': 1.2,
  Porsche: 1.2,
  Tesla: 1.2,
  Polestar: 1.2,
  'Alfa Romeo': 1.2,
  MINI: 1.2,
  'DS Automobiles': 1.2,
  Dacia: 0.8,
};

/** Premium makes lose value faster: −10 % a year instead of −8 %. */
const PREMIUM = new Set(
  Object.entries(MAKE_PRICE_FACTOR)
    .filter(([, factor]) => factor > 1)
    .map(([make]) => make),
);

/** Share of the new price a car of this age typically fetches: −15 % in the first year, then yearly. */
const typicalShare = (age: number, premium: boolean) =>
  age <= 0 ? 1 : 0.85 * (premium ? 0.9 : 0.92) ** (age - 1);

/** Cheaper offers (more kilometres, basic trims) cost less than typical ones – more so for older cars. */
const cheaperOffers = (age: number) => Math.max(0.72, 0.95 - 0.03 * age);

/** New cars got dearer: about 3 % per model year (2018 = the class price above). */
const priceLevel = (modelYear: number) => Math.max(0.6, 1 + 0.03 * (modelYear - 2018));

/** The newest model year a budget reaches at the cheaper end of the market (rough estimate). */
export function newestAffordableYear(
  model: Pick<ModelSummary, 'make' | 'segment'>,
  budget: number,
  year = new Date().getFullYear(),
): number {
  const classPrice = NEW_PRICE_EUR[model.segment] * (MAKE_PRICE_FACTOR[model.make] ?? 1);
  const premium = PREMIUM.has(model.make);
  for (let age = 0; age < 40; age += 1) {
    const modelYear = year - age;
    const price =
      classPrice * priceLevel(modelYear) * typicalShare(age, premium) * cheaperOffers(age);
    if (price <= budget) return modelYear;
  }
  return year - 40;
}

function affordable(
  model: ModelSummary,
  generation: GenerationSummary,
  budget: number | null,
  year: number,
): boolean {
  if (budget === null) return true;
  if (generation.typicalPriceEur) return generation.typicalPriceEur[0] <= budget;
  // At least one full model year of the generation has to be old enough.
  return generation.years[0] + 1 <= newestAffordableYear(model, budget, year);
}

function fitsHard(
  model: ModelSummary,
  generation: GenerationSummary,
  answers: AdvisorAnswers,
  year: number,
): boolean {
  if (answers.people === 7 && !generation.seats.some((seats) => seats >= 7)) return false;
  if (answers.transmission === 'automatic' && !generation.automatic) return false;
  if (!answers.charging && generation.fuels.every((fuel) => fuel === 'electric')) return false;
  return affordable(model, generation, answers.budget, year);
}

/** The newest fitting generation (the newest one the budget reaches). */
function pickGeneration(
  model: ModelSummary,
  answers: AdvisorAnswers,
  year: number,
): GenerationSummary | null {
  const fitting = model.generations.filter((generation) =>
    fitsHard(model, generation, answers, year),
  );
  return fitting.sort((a, b) => b.years[0] - a.years[0])[0] ?? null;
}

export function recommend(
  models: readonly ModelSummary[],
  answers: AdvisorAnswers,
  limit = 5,
  year = new Date().getFullYear(),
): Recommendation[] {
  const preferred = preferredFuels(answers);
  const results: Recommendation[] = [];
  for (const model of models) {
    // Technically identical models would only repeat a suggestion.
    if (model.twinOf) continue;
    const generation = pickGeneration(model, answers, year);
    if (!generation) continue;
    const reasons: string[] = [];
    let score = 0;

    const usageFit = answers.usage ? (USAGE_FIT[answers.usage][model.segment] ?? 0) : 1;
    if (answers.usage && usageFit === 0) continue;
    score += usageFit * 3;
    if (answers.usage && usageFit >= 3) reasons.push(USAGE_REASONS[answers.usage]);

    const { reliability, runningCosts, space, comfort } = model.ratings;
    const weight = (priority: Priority) => (answers.priorities.includes(priority) ? 3 : 1);
    score += reliability * weight('zuverlaessigkeit');
    score += runningCosts * weight('kosten');
    score += comfort * (answers.priorities.includes('komfort') ? 3 : 0.5);
    score += space * (answers.priorities.includes('platz') ? 3 : answers.people === 5 ? 1 : 0.5);
    if (reliability >= 4) reasons.push('Gilt als zuverlässig');
    if (answers.priorities.includes('kosten') && runningCosts >= 4)
      reasons.push('Günstig im Unterhalt');
    if (answers.priorities.includes('komfort') && comfort >= 4) reasons.push('Bequem und leise');
    if ((answers.priorities.includes('platz') || answers.people === 7) && space >= 4)
      reasons.push('Viel Platz');
    if (answers.people === 7) reasons.push('Mit sieben Sitzen erhältlich');

    const fuels = preferred.filter((fuel) => generation.fuels.includes(fuel));
    if (answers.charging && generation.fuels.includes('electric')) {
      score += answers.priorities.includes('umwelt') ? 6 : 3;
      reasons.push('Als Elektroauto erhältlich');
    } else if (
      answers.priorities.includes('umwelt') &&
      generation.fuels.some((fuel) => fuel === 'hybrid' || fuel === 'plugin_hybrid')
    ) {
      score += 3;
      reasons.push('Als Hybrid erhältlich');
    }
    if (answers.mileage === 'viel' && generation.fuels.includes('diesel')) score += 2;
    if (answers.transmission === 'automatic') reasons.push('Mit Automatik erhältlich');

    // Known serious weaknesses count against a generation.
    score -= generation.severeIssueCount * 1.5;

    results.push({ model, generation, score, reasons: reasons.slice(0, 4), fuels });
  }
  return results
    .sort((a, b) => b.score - a.score || a.model.id.localeCompare(b.model.id))
    .slice(0, limit);
}
