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
    ['https://www.example-autos.de/inserat/2900000005', 'unsupported_host'],
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
    expect(recognizeListingUrl('https://www.example-autos.de/inserat/2900000005')).toEqual({
      ok: false,
      reason: 'unsupported_host',
      host: 'www.example-autos.de',
    });
  });

  it('names the platform of links that are not a single listing', () => {
    expect(recognizeListingUrl('https://www.autoscout24.de/angebote/xyz')).toEqual({
      ok: false,
      reason: 'not_a_listing',
      host: 'www.autoscout24.de',
      source: 'autoscout24',
    });
    expect(recognizeListingUrl('https://suchen.mobile.de/fahrzeuge/details.html?id=123')).toEqual({
      ok: false,
      reason: 'not_a_listing',
      host: 'suchen.mobile.de',
      source: 'mobile_de',
    });
  });
});

describe('recognizeListingUrl – other marketplaces', () => {
  it.each([
    [
      'https://suchen.mobile.de/fahrzeuge/details.html?id=412345678&lang=de&utm_source=app',
      'mobile_de',
      '412345678',
      'https://suchen.mobile.de/fahrzeuge/details.html?id=412345678',
    ],
    [
      'https://suchen.mobile.de/auto-inserat/volkswagen-golf-1-4-tsi-hamburg/412345679.html',
      'mobile_de',
      '412345679',
      'https://suchen.mobile.de/fahrzeuge/details.html?id=412345679',
    ],
    [
      'https://m.mobile.de/auto-inserat/bmw-320d-touring/412345680.html?ref=share',
      'mobile_de',
      '412345680',
      'https://suchen.mobile.de/fahrzeuge/details.html?id=412345680',
    ],
    [
      'https://www.autoscout24.de/angebote/bmw-320-d-touring-diesel-schwarz-4f1d8f6e-5a7c-4b0e-9a3d-2c1b0e9f8a7d?source=list',
      'autoscout24',
      '4f1d8f6e-5a7c-4b0e-9a3d-2c1b0e9f8a7d',
      'https://www.autoscout24.de/angebote/bmw-320-d-touring-diesel-schwarz-4f1d8f6e-5a7c-4b0e-9a3d-2c1b0e9f8a7d',
    ],
    [
      'https://www.ebay.de/itm/Volkswagen-Golf-VII/256123456789?hash=item3ba',
      'ebay',
      '256123456789',
      'https://www.ebay.de/itm/256123456789',
    ],
    [
      'https://m.ebay.de/itm/256123456790',
      'ebay',
      '256123456790',
      'https://www.ebay.de/itm/256123456790',
    ],
    [
      'https://www.autohero.com/de/volkswagen-golf/id/0b8f6a52-1c3d-4e5f-8a9b-0c1d2e3f4a5b/',
      'autohero',
      '0b8f6a52-1c3d-4e5f-8a9b-0c1d2e3f4a5b',
      'https://www.autohero.com/de/volkswagen-golf/id/0b8f6a52-1c3d-4e5f-8a9b-0c1d2e3f4a5b/',
    ],
    [
      'https://www.facebook.com/marketplace/item/1234567890123456/?ref=share',
      'facebook',
      '1234567890123456',
      'https://www.facebook.com/marketplace/item/1234567890123456/',
    ],
  ])('recognizes %s', (input, source, externalId, canonicalUrl) => {
    expect(recognizeListingUrl(input)).toEqual({
      ok: true,
      source,
      canonicalUrl,
      externalId,
      categoryId: null,
    });
  });

  it('extracts the link from an app share text and accepts links without scheme', () => {
    expect(
      recognizeListingUrl(
        'Schau dir dieses Fahrzeug auf mobile.de an: https://suchen.mobile.de/fahrzeuge/details.html?id=412345681',
      ),
    ).toMatchObject({ ok: true, source: 'mobile_de', externalId: '412345681' });
    expect(recognizeListingUrl('www.ebay.de/itm/256123456791')).toMatchObject({
      ok: true,
      source: 'ebay',
    });
  });

  it('does not trust look-alike hosts', () => {
    for (const input of [
      'https://suchen.mobile.de.evil.example/fahrzeuge/details.html?id=412345678',
      'https://www.autoscout24.de.evil.example/angebote/x-4f1d8f6e-5a7c-4b0e-9a3d-2c1b0e9f8a7d',
      'https://ebay.evil.example/itm/256123456789',
      'https://notebay.de/itm/256123456789',
    ]) {
      expect(recognizeListingUrl(input)).toMatchObject({ ok: false, reason: 'unsupported_host' });
    }
  });
});
