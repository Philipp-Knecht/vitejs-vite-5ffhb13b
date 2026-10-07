import { CarModelSchema, type CarModel } from './types';

/**
 * All model knowledge at once – for prerendering the model pages at build
 * time only. The browser loads single models through ./knowledge.
 */
const FILES = import.meta.glob<unknown>('../data/models/*.json', {
  import: 'default',
  eager: true,
});

export const ALL_KNOWLEDGE: readonly CarModel[] = Object.values(FILES)
  .map((data) => CarModelSchema.parse(data))
  .sort((a, b) => a.id.localeCompare(b.id));
