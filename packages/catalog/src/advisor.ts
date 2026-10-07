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

function affordable(generation: GenerationSummary, budget: number | null): boolean {
  if (budget === null || generation.typicalPriceEur === null) return true;
  return generation.typicalPriceEur[0] <= budget;
}

function fitsHard(generation: GenerationSummary, answers: AdvisorAnswers): boolean {
  if (answers.people === 7 && !generation.seats.some((seats) => seats >= 7)) return false;
  if (answers.transmission === 'automatic' && !generation.automatic) return false;
  if (!answers.charging && generation.fuels.every((fuel) => fuel === 'electric')) return false;
  return affordable(generation, answers.budget);
}

/** The newest fitting generation (the newest one the budget reaches). */
function pickGeneration(model: ModelSummary, answers: AdvisorAnswers): GenerationSummary | null {
  const fitting = model.generations.filter((generation) => fitsHard(generation, answers));
  return fitting.sort((a, b) => b.years[0] - a.years[0])[0] ?? null;
}

export function recommend(
  models: readonly ModelSummary[],
  answers: AdvisorAnswers,
  limit = 5,
): Recommendation[] {
  const preferred = preferredFuels(answers);
  const results: Recommendation[] = [];
  for (const model of models) {
    // Technically identical models would only repeat a suggestion.
    if (model.twinOf) continue;
    const generation = pickGeneration(model, answers);
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

    // Known serious weaknesses count against a generation; unknown prices make the fit less certain.
    score -= generation.severeIssueCount * 1.5;
    if (answers.budget !== null && generation.typicalPriceEur === null) score -= 2;

    results.push({ model, generation, score, reasons: reasons.slice(0, 4), fuels });
  }
  return results
    .sort((a, b) => b.score - a.score || a.model.id.localeCompare(b.model.id))
    .slice(0, limit);
}
