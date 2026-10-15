import { describe, expect, it } from 'vitest';
import { fragmentId } from './fragment';

describe('fragmentId', () => {
  it.each([
    ['#typklasse', 'typklasse'],
    ['#%C3%BCber', 'über'],
    ['#100%', '100%'],
    ['#%E0%A4%A', '%E0%A4%A'],
    ['#', ''],
    ['', ''],
  ])('%s → %s', (hash, id) => {
    expect(fragmentId(hash)).toBe(id);
  });
});
