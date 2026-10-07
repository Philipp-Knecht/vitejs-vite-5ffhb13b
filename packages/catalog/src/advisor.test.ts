import { describe, expect, it } from 'vitest';
import { recommend, type AdvisorAnswers } from './advisor';
import { EMPTY_ANSWERS, isComplete, parseAdvisorParams, toAdvisorParams } from './advisor-query';
import type { GenerationSummary, ModelSummary } from './knowledge-index';

const generation = (overrides: Partial<GenerationSummary> & { id: string }): GenerationSummary => ({
  name: overrides.id,
  years: [2015, 2020],
  bodyTypes: ['schraegheck'],
  fuels: ['petrol', 'diesel'],
  seats: [5],
  automatic: true,
  typicalPriceEur: [8000, 18000],
  issueCount: 2,
  severeIssueCount: 0,
  ...overrides,
});

const model = (overrides: Partial<ModelSummary> & { id: string }): ModelSummary => ({
  make: 'Test',
  model: overrides.id,
  segment: 'kompakt',
  twinOf: null,
  ratings: { reliability: 3, runningCosts: 3, space: 3, comfort: 3 },
  generations: [generation({ id: `${overrides.id}-1` })],
  ...overrides,
});

const answers = (overrides: Partial<AdvisorAnswers> = {}): AdvisorAnswers => ({
  budget: null,
  usage: null,
  mileage: null,
  people: null,
  charging: null,
  transmission: null,
  priorities: [],
  ...overrides,
});

const MODELS: ModelSummary[] = [
  model({
    id: 'city',
    segment: 'kleinwagen',
    ratings: { reliability: 4, runningCosts: 5, space: 2, comfort: 2 },
  }),
  model({ id: 'compact', segment: 'kompakt' }),
  model({
    id: 'van',
    segment: 'van',
    ratings: { reliability: 3, runningCosts: 3, space: 5, comfort: 3 },
    generations: [generation({ id: 'van-1', seats: [5, 7], bodyTypes: ['van'] })],
  }),
  model({
    id: 'ev',
    segment: 'kompakt',
    generations: [
      generation({
        id: 'ev-1',
        fuels: ['electric'],
        years: [2020, null],
        typicalPriceEur: [20000, 30000],
      }),
    ],
  }),
  model({ id: 'twin', segment: 'kleinwagen', twinOf: 'city' }),
  model({
    id: 'old-new',
    segment: 'kompakt',
    generations: [
      generation({ id: 'old-new-1', years: [2008, 2012], typicalPriceEur: [3000, 7000] }),
      generation({ id: 'old-new-2', years: [2013, 2019], typicalPriceEur: [9000, 20000] }),
    ],
  }),
];

describe('recommend', () => {
  it('suits the usage and never repeats a twin', () => {
    const result = recommend(MODELS, answers({ usage: 'stadt' }));
    expect(result[0]?.model.id).toBe('city');
    expect(result.map((item) => item.model.id)).not.toContain('twin');
    expect(result.map((item) => item.model.id)).not.toContain('van');
    expect(result[0]?.reasons).toContain('Handlich für Stadt und Kurzstrecke');
  });

  it('needs seven seats when seven people travel', () => {
    const result = recommend(MODELS, answers({ people: 7 }));
    expect(result.map((item) => item.model.id)).toEqual(['van']);
    expect(result[0]?.reasons).toContain('Mit sieben Sitzen erhältlich');
  });

  it('offers electric cars only to people who can charge', () => {
    expect(recommend(MODELS, answers()).map((item) => item.model.id)).not.toContain('ev');
    const withCharging = recommend(MODELS, answers({ charging: true, budget: 25000 }));
    expect(withCharging[0]?.model.id).toBe('ev');
    expect(withCharging[0]?.fuels).toEqual(['electric']);
  });

  it('picks the newest generation the budget reaches', () => {
    const tight = recommend(MODELS, answers({ budget: 5000 }));
    expect(tight.find((item) => item.model.id === 'old-new')?.generation.id).toBe('old-new-1');
    const roomy = recommend(MODELS, answers({ budget: 15000 }));
    expect(roomy.find((item) => item.model.id === 'old-new')?.generation.id).toBe('old-new-2');
    expect(tight.map((item) => item.model.id)).not.toContain('ev');
  });

  it('suggests diesel for many kilometres', () => {
    const result = recommend(MODELS, answers({ mileage: 'viel' }));
    expect(result[0]?.fuels[0]).toBe('diesel');
  });
});

describe('advisor parameters', () => {
  it('round-trips the answers and drops invalid values', () => {
    const full: AdvisorAnswers = {
      budget: 15000,
      usage: 'familie',
      mileage: 'mittel',
      people: 5,
      charging: false,
      transmission: 'automatic',
      priorities: ['zuverlaessigkeit', 'kosten'],
    };
    const params = toAdvisorParams(full);
    expect(params.toString()).toBe(
      'budget=15000&nutzung=familie&km=mittel&personen=5&laden=nein&getriebe=automatik&prio=zuverlaessigkeit%2Ckosten',
    );
    expect(parseAdvisorParams(params)).toEqual(full);
    expect(isComplete(full)).toBe(true);
    const junk = parseAdvisorParams(
      new URLSearchParams('budget=-1&nutzung=rennen&personen=3&prio=komfort,komfort,platz,kosten'),
    );
    expect(junk).toEqual({ ...EMPTY_ANSWERS, priorities: ['komfort', 'platz'] });
    expect(isComplete(junk)).toBe(false);
  });
});
