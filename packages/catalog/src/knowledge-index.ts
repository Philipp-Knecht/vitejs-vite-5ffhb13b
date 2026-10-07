import type { FuelType } from '@kaufcheck/shared';
import type { BodyType, CarModel, Segment } from './types';

/**
 * What the advisor needs to rank all researched models – without the long
 * texts, so the advisor page does not load every model file. Built from
 * data/models into data/index.json (`npm run catalog:index`); a test keeps
 * both in step.
 */
export interface GenerationSummary {
  id: string;
  name: string;
  years: [number, number | null];
  bodyTypes: BodyType[];
  fuels: FuelType[];
  seats: number[];
  automatic: boolean;
  typicalPriceEur: [number, number] | null;
  issueCount: number;
  severeIssueCount: number;
}

export interface ModelSummary {
  id: string;
  make: string;
  model: string;
  segment: Segment;
  twinOf: string | null;
  ratings: { reliability: number; runningCosts: number; space: number; comfort: number };
  generations: GenerationSummary[];
}

export function summarize(model: CarModel): ModelSummary {
  return {
    id: model.id,
    make: model.make,
    model: model.model,
    segment: model.segment,
    twinOf: model.twinOf ?? null,
    ratings: {
      reliability: model.ratings.reliability,
      runningCosts: model.ratings.runningCosts,
      space: model.ratings.space,
      comfort: model.ratings.comfort,
    },
    generations: model.generations.map((generation) => ({
      id: generation.id,
      name: generation.name,
      years: [generation.years[0], generation.years[1]],
      bodyTypes: [...generation.bodyTypes],
      fuels: [...generation.fuels],
      seats: [...generation.seats],
      automatic: generation.automatic,
      typicalPriceEur: generation.typicalPriceEur
        ? [generation.typicalPriceEur[0], generation.typicalPriceEur[1]]
        : null,
      issueCount: generation.issues.length,
      severeIssueCount: generation.issues.filter((issue) => issue.severity === 'hoch').length,
    })),
  };
}
