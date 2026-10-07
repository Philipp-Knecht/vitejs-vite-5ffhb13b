/**
 * Writes data/index.json: the summaries of all model files in data/models.
 * Run after adding or changing model knowledge: `npm run catalog:index`.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { summarize } from '../src/knowledge-index';
import { CarModelSchema } from '../src/types';

const dataDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data');
const modelsDir = path.join(dataDir, 'models');
const summaries = readdirSync(modelsDir)
  .filter((file) => file.endsWith('.json'))
  .sort()
  .map((file) =>
    summarize(CarModelSchema.parse(JSON.parse(readFileSync(path.join(modelsDir, file), 'utf8')))),
  );
writeFileSync(path.join(dataDir, 'index.json'), `${JSON.stringify(summaries, null, 2)}\n`);
console.log(`data/index.json: ${summaries.length} models`);
