// Prints the top 5 advisor suggestions for typical buyer profiles (plausibility check).
// Usage: npx tsx tools/model-research/advisor-check.mjs
import { recommend } from '../../packages/catalog/src/advisor.ts';
import { EMPTY_ANSWERS } from '../../packages/catalog/src/advisor-query.ts';
import { MODEL_INDEX } from '../../packages/catalog/src/advisor-index.ts';

const profiles = [
  { label: 'Stadt, 8k, 2 Pers.', budget: 8000, usage: 'stadt', people: 2 },
  {
    label: 'Familie, 15k, 4 Pers., Automatik',
    budget: 15000,
    usage: 'familie',
    people: 4,
    transmission: 'automatic',
  },
  {
    label: 'Pendeln viel, 20k, Zuverlässigkeit',
    budget: 20000,
    usage: 'pendeln',
    people: 2,
    mileage: 'viel',
    priorities: ['zuverlaessigkeit'],
  },
  { label: 'Familie 7 Sitze, 25k', budget: 25000, usage: 'familie', people: 7 },
  {
    label: 'Gepäck, 10k, Kosten',
    budget: 10000,
    usage: 'gepaeck',
    people: 4,
    priorities: ['kosten'],
  },
  {
    label: 'Laden, 30k, Umwelt',
    budget: 30000,
    usage: 'pendeln',
    people: 4,
    charging: true,
    priorities: ['umwelt'],
  },
  { label: 'Anhänger, 30k', budget: 30000, usage: 'anhaenger', people: 4 },
  { label: 'Stadt, 5k', budget: 5000, usage: 'stadt', people: 2 },
];

for (const profile of profiles) {
  const { label, ...answers } = profile;
  const result = recommend(
    MODEL_INDEX,
    { ...EMPTY_ANSWERS, priorities: [], ...answers },
    5,
    new Date().getFullYear(),
  );
  console.log(`\n${label}:`);
  for (const item of result)
    console.log(
      `  ${item.score.toFixed(1)}  ${item.model.make} ${item.model.model} – ${item.generation.name} ${item.generation.years.join('–')} | ${item.reasons.join('; ')}`,
    );
}
