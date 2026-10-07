import {
  MILEAGES,
  PEOPLE,
  PRIORITIES,
  USAGES,
  type AdvisorAnswers,
  type Mileage,
  type People,
  type Priority,
  type Usage,
} from './advisor';

/** The advisor's answers in KaufCheck's own URL (`/auto-berater?budget=15000&nutzung=familie…`). */
export const EMPTY_ANSWERS: AdvisorAnswers = {
  budget: null,
  usage: null,
  mileage: null,
  people: null,
  charging: null,
  transmission: null,
  priorities: [],
};

export const BUDGETS = [5000, 8000, 10000, 15000, 20000, 30000, 50000] as const;

const pick = <T extends string | number>(values: readonly T[], raw: string | null): T | null =>
  values.find((value) => String(value) === raw) ?? null;

export function parseAdvisorParams(params: URLSearchParams): AdvisorAnswers {
  const budget = Number(params.get('budget'));
  const priorities = (params.get('prio') ?? '')
    .split(',')
    .map((value) => pick(PRIORITIES, value))
    .filter((value): value is Priority => value !== null);
  const charging = params.get('laden');
  const transmission = params.get('getriebe');
  return {
    budget: Number.isInteger(budget) && budget >= 1000 && budget <= 500_000 ? budget : null,
    usage: pick<Usage>(USAGES, params.get('nutzung')),
    mileage: pick<Mileage>(MILEAGES, params.get('km')),
    people: pick<People>(PEOPLE, params.get('personen')),
    charging: charging === 'ja' ? true : charging === 'nein' ? false : null,
    transmission:
      transmission === 'automatik'
        ? 'automatic'
        : transmission === 'schaltgetriebe'
          ? 'manual'
          : null,
    priorities: [...new Set(priorities)].slice(0, 2),
  };
}

export function toAdvisorParams(answers: AdvisorAnswers): URLSearchParams {
  const params = new URLSearchParams();
  if (answers.budget !== null) params.set('budget', String(answers.budget));
  if (answers.usage) params.set('nutzung', answers.usage);
  if (answers.mileage) params.set('km', answers.mileage);
  if (answers.people !== null) params.set('personen', String(answers.people));
  if (answers.charging !== null) params.set('laden', answers.charging ? 'ja' : 'nein');
  if (answers.transmission)
    params.set('getriebe', answers.transmission === 'automatic' ? 'automatik' : 'schaltgetriebe');
  if (answers.priorities.length > 0) params.set('prio', answers.priorities.join(','));
  return params;
}

/** The advisor shows results once the essential questions are answered. */
export function isComplete(answers: AdvisorAnswers): boolean {
  return answers.budget !== null && answers.usage !== null && answers.people !== null;
}
