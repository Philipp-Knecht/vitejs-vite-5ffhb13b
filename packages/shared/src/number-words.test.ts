import { describe, expect, it } from 'vitest';
import { numberInWords } from './number-words';

describe('numberInWords', () => {
  it.each([
    [0, 'null'],
    [1, 'eins'],
    [7, 'sieben'],
    [11, 'elf'],
    [16, 'sechzehn'],
    [17, 'siebzehn'],
    [20, 'zwanzig'],
    [21, 'einundzwanzig'],
    [30, 'dreißig'],
    [99, 'neunundneunzig'],
    [100, 'einhundert'],
    [101, 'einhunderteins'],
    [111, 'einhundertelf'],
    [999, 'neunhundertneunundneunzig'],
    [1000, 'eintausend'],
    [1001, 'eintausendeins'],
    [2500, 'zweitausendfünfhundert'],
    [12_500, 'zwölftausendfünfhundert'],
    [21_000, 'einundzwanzigtausend'],
    [101_101, 'einhunderteintausendeinhunderteins'],
    [999_999, 'neunhundertneunundneunzigtausendneunhundertneunundneunzig'],
    [1_000_000, 'eine Million'],
    [1_000_001, 'eine Million eins'],
    [1_250_000, 'eine Million zweihundertfünfzigtausend'],
    [2_000_000, 'zwei Millionen'],
    [21_000_017, 'einundzwanzig Millionen siebzehn'],
  ])('%i → %s', (n, words) => {
    expect(numberInWords(n)).toBe(words);
  });

  it('rejects what it cannot write', () => {
    expect(() => numberInWords(-1)).toThrow(RangeError);
    expect(() => numberInWords(1.5)).toThrow(RangeError);
    expect(() => numberInWords(1_000_000_000)).toThrow(RangeError);
  });
});
