import { CarModelSchema, type CarModel } from './types';

/**
 * Researched model knowledge, one JSON file per model in data/models. Each
 * file is its own chunk, so a page only loads the models it shows.
 */
const FILES = import.meta.glob<unknown>('../data/models/*.json', { import: 'default' });

const loaders = new Map(
  Object.entries(FILES).map(([path, load]) => [path.replace(/^.*\/(.+)\.json$/, '$1'), load]),
);

/** Ids of all models with knowledge. */
export const KNOWLEDGE_IDS: readonly string[] = [...loaders.keys()].sort();

export function hasKnowledge(id: string | null | undefined): boolean {
  return !!id && loaders.has(id);
}

export async function loadKnowledge(id: string): Promise<CarModel | null> {
  const load = loaders.get(id);
  if (!load) return null;
  return CarModelSchema.parse(await load());
}
