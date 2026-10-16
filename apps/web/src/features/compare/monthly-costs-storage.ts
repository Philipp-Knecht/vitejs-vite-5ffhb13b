/** Where the own assumptions for the monthly costs stay in this browser, per account. */
export const MONTHLY_COSTS_STORAGE_PREFIX = 'kaufcheck:monatskosten:';

export const monthlyCostsStorageKey = (userId: string) =>
  `${MONTHLY_COSTS_STORAGE_PREFIX}${userId}`;
