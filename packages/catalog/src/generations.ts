import type { CarModel, Generation } from './types';

/** The generation that fits the searched years best, else the newest one older than 3 years. */
export function defaultGeneration(
  model: CarModel,
  yearMin: number | null,
  yearMax: number | null,
): Generation | undefined {
  const generations = model.generations;
  if (yearMin !== null || yearMax !== null) {
    const from = yearMin ?? 1990;
    const to = yearMax ?? new Date().getFullYear();
    const overlap = (generation: Generation) => {
      const end = generation.years[1] ?? new Date().getFullYear();
      return Math.min(end, to) - Math.max(generation.years[0], from);
    };
    const best = [...generations].sort((a, b) => overlap(b) - overlap(a))[0];
    if (best && overlap(best) >= 0) return best;
  }
  const usedAge = new Date().getFullYear() - 3;
  return (
    [...generations].reverse().find((generation) => generation.years[0] <= usedAge) ??
    generations[generations.length - 1]
  );
}
