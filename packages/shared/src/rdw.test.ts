import { describe, expect, it } from 'vitest';
import { formatDutchPlate, normalizeDutchPlate, ODOMETER_EXPLANATIONS } from './rdw';

describe('Dutch registration numbers', () => {
  it('takes them with or without hyphens and spaces', () => {
    expect(normalizeDutchPlate('ab-123-c')).toBe('AB123C');
    expect(normalizeDutchPlate(' 12 ABC 3 ')).toBe('12ABC3');
    expect(normalizeDutchPlate('XX.99.XX')).toBe('XX99XX');
  });

  it('rejects what cannot be one', () => {
    for (const value of ['', 'AB123', 'AB-123-CD', 'ABCDEF', '123456', "AB'12;", 'ÄB123C'])
      expect(normalizeDutchPlate(value)).toBeNull();
  });

  it('writes them as on the plate', () => {
    expect(formatDutchPlate('AB123C')).toBe('AB-123-C');
    expect(formatDutchPlate('12ABC3')).toBe('12-ABC-3');
    expect(formatDutchPlate('XX99XX')).toBe('XX-99-XX');
  });

  it('explains every code of the RDW', () => {
    for (const code of ['00', '01', '02', '03', '04', '05', '06', '07', 'NG'])
      expect(ODOMETER_EXPLANATIONS[code]).toBeTruthy();
  });
});
