import { describe, expect, it } from 'vitest';
import {
  containsVerbatim,
  kwToPs,
  monthsSince,
  monthsUntil,
  parseGermanDate,
  parseGermanInteger,
  parseMileageKm,
  parsePower,
  parsePrice,
  parseYearMonth,
  redactContactData,
  REDACTED_EMAIL,
  REDACTED_PHONE,
  snippetAround,
} from '../src/index';

const REF = new Date('2026-09-30T10:00:00Z');

describe('parseGermanInteger', () => {
  it.each([
    ['185.000 km', 185000],
    ['12.900,- €', 12900],
    ['12.900,50 €', 12901],
    ['12900€', 12900],
    ['1 234 567', 1234567],
    ['ca. 7.500', 7500],
    ['kein Wert', null],
  ])('%s → %s', (input, expected) => {
    expect(parseGermanInteger(input)).toBe(expected);
  });
});

describe('parseMileageKm', () => {
  it.each([
    ['185.000 km', 185000],
    ['185000', 185000],
    ['185 Tkm', 185000],
    ['142tkm', 142000],
    ['185 Tsd. km', 185000],
    ['96,5 tkm', 96500],
    ['185k', 185000],
    ['3.000.000 km', null],
  ])('%s → %s', (input, expected) => {
    expect(parseMileageKm(input)).toBe(expected);
  });
});

describe('parsePower', () => {
  it('parses PS and derives kW', () => {
    expect(parsePower('310 PS')).toEqual({ ps: 310, kw: 228 });
  });
  it('parses kW and derives PS', () => {
    expect(parsePower('228 kW')).toEqual({ ps: 310, kw: 228 });
  });
  it('keeps both when both are given', () => {
    expect(parsePower('190 kW (258 PS)')).toEqual({ ps: 258, kw: 190 });
  });
  it('rejects implausible values', () => {
    expect(parsePower('5 PS')).toBeNull();
    expect(parsePower('ohne Angabe')).toBeNull();
  });
  it('converts consistently', () => {
    expect(kwToPs(110)).toBe(150);
  });
});

describe('parsePrice', () => {
  it.each([
    ['12.900 € VB', { amountEur: 12900, kind: 'negotiable' }],
    ['8.450 €', { amountEur: 8450, kind: 'asking' }],
    ['Festpreis 5.000 €', { amountEur: 5000, kind: 'fixed' }],
    ['Zu verschenken', { amountEur: 0, kind: 'give_away' }],
    ['€ 17.780 ,-', { amountEur: 17780, kind: 'asking' }],
    ['VB', null],
  ])('%s', (input, expected) => {
    expect(parsePrice(input)).toEqual(expected);
  });
});

describe('dates', () => {
  it.each([
    ['Mai 2012', { year: 2012, month: 5 }],
    ['05/2012', { year: 2012, month: 5 }],
    ['5/12', { year: 2012, month: 5 }],
    ['05.2012', { year: 2012, month: 5 }],
    ['2012-05', { year: 2012, month: 5 }],
    ['März 2014', { year: 2014, month: 3 }],
    ['2012', { year: 2012, month: null }],
    ['12.03.2018', { year: 2018, month: 3 }],
    ['14.05.28', { year: 2028, month: 5 }],
    ['irgendwann', null],
  ])('parseYearMonth(%s)', (input, expected) => {
    expect(parseYearMonth(input, REF)).toEqual(expected);
  });

  it('rejects implausible future years for registrations', () => {
    expect(parseYearMonth('2031', REF, 1)).toBeNull();
    expect(parseYearMonth('06/2028', REF, 4)).toEqual({ year: 2028, month: 6 });
  });

  it('parses listing dates including relative ones', () => {
    expect(parseGermanDate('28.09.2026', REF)).toBe('2026-09-28');
    expect(parseGermanDate('Heute, 14:30', REF)).toBe('2026-09-30');
    expect(parseGermanDate('Gestern', REF)).toBe('2026-09-29');
    expect(parseGermanDate('31.02.2026', REF)).toBeNull();
  });

  it('counts months', () => {
    expect(monthsSince({ year: 2012, month: 5 }, REF)).toBe(172);
    expect(monthsUntil({ year: 2027, month: 6 }, REF)).toBe(9);
    expect(monthsUntil({ year: 2026, month: 5 }, REF)).toBe(-4);
  });
});

describe('redactContactData', () => {
  it('removes phone numbers and e-mail addresses', () => {
    const text = 'Erreichbar unter 0171 2345678, +49 160 98765432 oder max.muster@example.com.';
    const redacted = redactContactData(text);
    expect(redacted).not.toMatch(/2345678|98765432|example\.com/);
    expect(redacted.match(new RegExp(REDACTED_PHONE.replace(/[[\]]/g, '\\$&'), 'g'))).toHaveLength(
      2,
    );
    expect(redacted).toContain(REDACTED_EMAIL);
  });

  it('keeps mileages, prices, postal codes and dates', () => {
    const text = '185.000 km, 12.900 €, 01067 Dresden, EZ 01.05.2012, 2012';
    expect(redactContactData(text)).toBe(text);
  });
});

describe('quotes', () => {
  it('extracts the sentence around a match', () => {
    const text = 'Erster Satz. Kleine Kratzer an der Stoßstange, sonst gut. Letzter Satz.';
    const index = text.indexOf('Kratzer');
    expect(snippetAround(text, index, 7)).toBe('Kleine Kratzer an der Stoßstange, sonst gut.');
  });

  it('verifies quotes case- and whitespace-insensitively', () => {
    const source = 'Das Fahrzeug  läuft einwandfrei\nund wurde „regelmäßig“ gewartet.';
    expect(
      containsVerbatim(source, 'fahrzeug läuft einwandfrei und wurde "regelmäßig" gewartet'),
    ).toBe(true);
    expect(containsVerbatim(source, 'Das Fahrzeug ist unfallfrei')).toBe(false);
    expect(containsVerbatim(source, '')).toBe(false);
  });
});
