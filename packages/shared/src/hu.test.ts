import { describe, expect, it } from 'vitest';
import { huCalendarFile, huStatus } from './hu';

const NOW = new Date(2026, 9, 14); // 14 Oct 2026

describe('huStatus', () => {
  it.each<[number, number, 'ok' | 'soon' | 'overdue', string]>([
    [2028, 10, 'ok', 'Die nächste HU ist bis 10/2028 fällig.'],
    [2027, 1, 'ok', 'Die nächste HU ist bis 01/2027 fällig.'],
    [2026, 12, 'soon', 'Die HU ist bis 12/2026 fällig – in 2 Monaten.'],
    [2026, 11, 'soon', 'Die HU ist bis 11/2026 fällig – in einem Monat.'],
    [2026, 10, 'soon', 'Die HU ist diesen Monat fällig (10/2026).'],
    [2026, 9, 'overdue', 'Die HU ist seit einem Monat abgelaufen (gültig bis 09/2026).'],
    [2025, 10, 'overdue', 'Die HU ist seit 12 Monaten abgelaufen (gültig bis 10/2025).'],
  ])('%i-%i → %s', (year, month, tone, text) => {
    expect(huStatus({ year, month }, NOW)).toEqual({ tone, text });
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
