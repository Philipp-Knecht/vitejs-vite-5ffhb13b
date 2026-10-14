import { describe, expect, it } from 'vitest';
import { findVin } from './vin';

describe('findVin', () => {
  it.each([
    ['FIN: WVWZZZ1KZAW123456', 'WVWZZZ1KZAW123456'],
    ['Fahrgestellnummer wvwzzz1kzaw123456 auf Anfrage', 'WVWZZZ1KZAW123456'],
    ['(WBA8E9C50GK123456)', 'WBA8E9C50GK123456'],
    ['Teilenummer 12345678901234567', null], // digits only
    ['Ausstattungspaket ABCDEFGHJKLMNPRST', null], // letters only
    ['Code WVWZZZ1KZAW12345O', null], // O is not allowed
    ['Code WVWZZZ1KZAW1234567', null], // 18 characters
    ['ÄWVWZZZ1KZAW123456', null], // part of a longer word
    ['Fotos: https://photos.app.goo.gl/kCm7dWuHmKXpYhBv8', null], // URL id, mixed case
    ['Erstzulassung2018 Scheckheft', null], // words run together
    ['ERSTZULASSUNG2018', null],
    ['erstzulassung2018 scheckheft', null],
    ['FIN: WVWZZZAUZFW123456', 'WVWZZZAUZFW123456'], // no digit before the serial: needs a keyword
    ['WVWZZZAUZFW123456', null],
    ['FIN-Nr.: WVWZZZAUZFW123456', 'WVWZZZAUZFW123456'],
    ['VIN-Nummer WVWZZZAUZFW123456', 'WVWZZZAUZFW123456'],
    ['Fahrzeugidentifikationsnummer: WVWZZZAUZFW123456', 'WVWZZZAUZFW123456'],
    ['Kevin: ERSTZULASSUNG2018', null], // keyword only as a whole word
    ['Delfin ERSTZULASSUNG2018', null],
    ['FIN: WVWZZZ1KZAWXXXXXX (Rest auf Anfrage)', null], // masked
    ['FIN: VF33C9HZC84123456', 'VF33C9HZC84123456'],
    [null, null],
  ])('%s → %s', (text, expected) => {
    expect(findVin(text)?.vin ?? null).toBe(expected);
  });
});
