import { describe, expect, it } from 'vitest';
import { huCalendarFile, huStatus } from './hu';

const NOW = new Date(2026, 9, 14); // 14 Oct 2026

describe('huStatus', () => {
  it.each<[number, number, 'ok' | 'soon' | 'overdue', number, string]>([
    [2028, 10, 'ok', 24, 'Die nächste HU ist bis Ende 10/2028 fällig.'],
    [2027, 1, 'ok', 3, 'Die nächste HU ist bis Ende 01/2027 fällig.'],
    [2026, 12, 'soon', 2, 'Die HU ist bis Ende 12/2026 fällig.'],
    [2026, 11, 'soon', 1, 'Die HU ist bis Ende 11/2026 fällig.'],
    [2026, 10, 'soon', 0, 'Die HU ist bis Ende 10/2026 fällig – also diesen Monat.'],
    [2026, 9, 'overdue', -1, 'Die HU ist seit Ende 09/2026 abgelaufen.'],
    [2025, 10, 'overdue', -12, 'Die HU ist seit Ende 10/2025 abgelaufen.'],
  ])('%i-%i → %s', (year, month, tone, monthsLeft, text) => {
    expect(huStatus({ year, month }, NOW)).toEqual({ tone, monthsLeft, text });
  });
});

describe('huCalendarFile', () => {
  const file = huCalendarFile({
    uid: 'hu-1@kaufcheck',
    title: 'Familienauto; Škoda Octavia, Combi',
    hu: { year: 2027, month: 12 },
    now: new Date(Date.UTC(2026, 9, 14, 8, 30, 5, 123)),
  });

  it('is an all-day event in the HU month with a reminder four weeks before', () => {
    expect(file).toContain('DTSTART;VALUE=DATE:20271201\r\n');
    expect(file).toContain('DTEND;VALUE=DATE:20271202\r\n');
    expect(file).toContain('DTSTAMP:20261014T083005Z\r\n');
    expect(file).toContain('TRIGGER:-P28D\r\n');
    expect(file.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(file.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('escapes backslashes and line breaks', () => {
    const escaped = huCalendarFile({
      uid: 'hu-2@kaufcheck',
      title: 'A\\B\nC',
      hu: { year: 2027, month: 1 },
      now: new Date(0),
    });
    expect(escaped).toContain('SUMMARY:HU fällig: A\\\\B\\nC\r\n');
  });

  it('drops other control characters', () => {
    const file = huCalendarFile({
      uid: 'hu-3@kaufcheck',
      title: 'Papas\rAuto\u0007',
      hu: { year: 2027, month: 1 },
      now: new Date(0),
    });
    expect(file).toContain('SUMMARY:HU fällig: Papas\\nAuto\r\n');
  });

  it('escapes text and folds long lines at 75 octets', () => {
    const unfolded = file.replace(/\r\n /g, '');
    expect(unfolded).toContain('SUMMARY:HU fällig: Familienauto\\; Škoda Octavia\\, Combi\r\n');
    for (const line of file.split('\r\n')) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
    // No line break inside a multi-byte character.
    expect(file).not.toContain('�');
  });
});
