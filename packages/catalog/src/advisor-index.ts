import data from '../data/index.json';
import type { ModelSummary } from './knowledge-index';

/** Summaries of all researched models (generated, see scripts/build-index.ts). */
export const MODEL_INDEX = data as ModelSummary[];
