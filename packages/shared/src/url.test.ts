import { describe, expect, it } from 'vitest';
import { recognizeListingUrl } from './url';

describe('recognizeListingUrl', () => {
  it('accepts a canonical Kleinanzeigen listing URL', () => {
    const result = recognizeListingUrl(
      'https://www.kleinanzeigen.de/s-anzeige/audi-a7-3-0-tfsi-quattro/2912345678-216-3331',
    );
    expect(result).toEqual({
      ok: true,
      source: 'kleinanzeigen',
      canonicalUrl:
        'https://www.kleinanzeigen.de/s-anzeige/audi-a7-3-0-tfsi-quattro/2912345678-216-3331',
      externalId: '2912345678',
      categoryId: '216',
    });
  });

  it('strips query strings, fragments and trailing slashes', () => {
    const result = recognizeListingUrl(
      'https://www.kleinanzeigen.de/s-anzeige/bmw-530d/2911111111-216-1234/?utm_source=sharesheet&utm_medium=social#foto',
    );
    expect(result.ok && result.canonicalUrl).toBe(
      'https://www.kleinanzeigen.de/s-anzeige/bmw-530d/2911111111-216-1234',
    );
  });

  it('normalizes legacy and mobile hosts and upgrades http', () => {
    for (const host of [
      'ebay-kleinanzeigen.de',
      'm.kleinanzeigen.de',
      'www.ebay-kleinanzeigen.de',
    ]) {
      const result = recognizeListingUrl(`http://${host}/s-anzeige/golf-7/2900000001-216-100`);
      expect(result.ok && result.canonicalUrl).toBe(
        'https://www.kleinanzeigen.de/s-anzeige/golf-7/2900000001-216-100',
      );
    }
  });

  it('extracts a link from share text and drops trailing punctuation', () => {
    const result = recognizeListingUrl(
      'Guck mal, was ich bei Kleinanzeigen gefunden habe: https://www.kleinanzeigen.de/s-anzeige/opel-corsa/2900000002-216-2000.',
    );
    expect(result.ok && result.externalId).toBe('2900000002');
  });

  it('accepts a link without scheme', () => {
    const result = recognizeListingUrl(
      'www.kleinanzeigen.de/s-anzeige/vw-polo/2900000003-216-3000',
    );
    expect(result.ok).toBe(true);
  });

  it('accepts listing paths without slug or suffix', () => {
    const result = recognizeListingUrl('https://www.kleinanzeigen.de/s-anzeige/2900000004');
    expect(result).toMatchObject({ ok: true, externalId: '2900000004', categoryId: null });
  });

  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['kein link', 'not_a_url'],
    ['javascript:alert(1)', 'invalid_protocol'],
    ['file:///etc/passwd', 'invalid_protocol'],
    ['ftp://www.kleinanzeigen.de/s-anzeige/x/2900000005-216-1', 'invalid_protocol'],
    [
      'https://user:pw@www.kleinanzeigen.de/s-anzeige/x/2900000005-216-1',
      'credentials_not_allowed',
    ],
    ['https://www.kleinanzeigen.de:8443/s-anzeige/x/2900000005-216-1', 'port_not_allowed'],
    ['https://suchen.mobile.de/fahrzeuge/details.html?id=123', 'unsupported_host'],
    ['https://www.kleinanzeigen.de.evil.example/s-anzeige/x/2900000005-216-1', 'unsupported_host'],
    ['https://127.0.0.1/s-anzeige/x/2900000005-216-1', 'unsupported_host'],
    ['https://[::1]/s-anzeige/x/2900000005-216-1', 'unsupported_host'],
    ['https://www.kleinanzeigen.de/s-autos/c216', 'not_a_listing'],
    ['https://www.kleinanzeigen.de/s-anzeige/x/abc', 'not_a_listing'],
  ])('rejects %j (%s)', (input, reason) => {
    expect(recognizeListingUrl(input)).toMatchObject({ ok: false, reason });
  });

  it('rejects overly long input', () => {
    expect(recognizeListingUrl(`https://www.kleinanzeigen.de/${'a'.repeat(3000)}`)).toMatchObject({
      ok: false,
      reason: 'too_long',
    });
  });

  it('reports the host of unsupported links', () => {
    expect(recognizeListingUrl('https://www.autoscout24.de/angebote/xyz')).toEqual({
      ok: false,
      reason: 'unsupported_host',
      host: 'www.autoscout24.de',
    });
  });
});
