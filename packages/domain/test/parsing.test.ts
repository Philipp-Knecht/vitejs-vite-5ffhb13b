import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  classifyListingPage,
  getExampleListing,
  parseKleinanzeigenHtml,
  parseListingText,
} from '../src/index';

const fixture = (name: string) =>
  readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8');

describe('parseListingText – page copied with labels on separate lines', () => {
  const parsed = parseListingText(getExampleListing()!.text);

  it('finds title, price, location, date and seller', () => {
    expect(parsed.title).toBe('Audi A7 Sportback 3.0 TFSI quattro S tronic');
    expect(parsed.priceText).toBe('12.900 € VB');
    expect(parsed.locationText).toBe('10115 Berlin - Mitte');
    expect(parsed.postedAtText).toBe('28.09.2026');
    expect(parsed.sellerTypeText).toBe('Privater Nutzer');
    expect(parsed.memberSinceText).toBe('14.03.2016');
    expect(parsed.externalId).toBe('2912345678');
  });

  it('pairs detail labels with their values', () => {
    const details = Object.fromEntries(parsed.attributes.map((a) => [a.label, a.value]));
    expect(details).toMatchObject({
      Marke: 'Audi',
      Modell: 'A7',
      Kilometerstand: '185.000 km',
      Erstzulassung: 'Mai 2012',
      Kraftstoffart: 'Benzin',
      Leistung: '310 PS',
      Getriebe: 'Automatik',
      'HU bis': 'Juni 2027',
    });
  });

  it('collects equipment without leaking following sections', () => {
    expect(parsed.equipment).toEqual([
      'Klimaautomatik',
      'Navigationssystem',
      'Sitzheizung',
      'Einparkhilfe',
      'Tempomat',
      'Xenon-/LED-Scheinwerfer',
      'Alufelgen',
      'Bluetooth',
      'Freisprecheinrichtung',
    ]);
  });

  it('keeps the description and stops at the seller box', () => {
    expect(parsed.description).toMatch(/^Verkaufe meinen Audi A7/);
    expect(parsed.description).toMatch(/keine Rücknahme\.$/);
    expect(parsed.description).not.toMatch(/Privater Nutzer|Anzeigen-ID/);
  });
});

describe('parseListingText – "Label: Wert" lines and page chrome', () => {
  const parsed = parseListingText(fixture('pasted-inline.txt'));

  it('strips the reserved marker from the title and records the status', () => {
    expect(parsed.title).toBe('VW Golf 7 1.4 TSI Highline DSG');
    expect(parsed.status).toBe('reserved');
  });

  it('parses inline attributes, breadcrumb and relative date', () => {
    const details = Object.fromEntries(parsed.attributes.map((a) => [a.label, a.value]));
    expect(details).toMatchObject({
      Marke: 'Volkswagen',
      Kilometerstand: '96.500 km',
      Getriebe: 'Manuell',
    });
    expect(parsed.categoryHints).toContain('Autos');
    expect(parsed.postedAtText).toBe('Heute, 14:32');
    expect(parsed.priceText).toBe('8.450 €');
  });

  it('ends the description before similar listings', () => {
    expect(parsed.description).toMatch(/^Golf 7 Highline/);
    expect(parsed.description).not.toMatch(/Variant 9\.900/);
  });
});

describe('parseListingText – description only', () => {
  it('treats unstructured text as description', () => {
    const parsed = parseListingText(fixture('description-only.txt'));
    expect(parsed.title).toBeNull();
    expect(parsed.attributes).toEqual([]);
    expect(parsed.description).toMatch(/^Verkaufe meinen Opel Astra/);
  });
});

describe('parseKleinanzeigenHtml', () => {
  const html = fixture('kleinanzeigen-listing.html');
  const parsed = parseKleinanzeigenHtml(html);

  it('reads the known page elements', () => {
    expect(parsed.title).toBe('BMW 530d Touring M Sport');
    expect(parsed.priceText).toBe('13.500 € VB');
    expect(parsed.locationText).toBe('80331 München - Altstadt-Lehel');
    expect(parsed.postedAtText).toBe('29.09.2026');
    expect(parsed.externalId).toBe('2911111111');
    expect(parsed.sellerTypeText).toBe('Privater Nutzer');
    expect(parsed.memberSinceText).toBe('02.05.2013');
    expect(parsed.status).toBe('active');
    expect(parsed.categoryHints).toContain('Autos');
  });

  it('reads detail pairs and equipment tags', () => {
    const details = Object.fromEntries(parsed.attributes.map((a) => [a.label, a.value]));
    expect(details).toMatchObject({
      Marke: 'BMW',
      Modell: '5er Reihe',
      Kilometerstand: '162.000 km',
      Erstzulassung: 'März 2014',
      Kraftstoffart: 'Diesel',
      Leistung: '258 PS',
    });
    expect(parsed.equipment).toContain('Scheckheftgepflegt');
  });

  it('keeps line breaks in the description', () => {
    expect(parsed.description?.split('\n')[0]).toBe(
      'Verkaufe unseren BMW 530d Touring aus 2. Hand.',
    );
  });

  it('only accepts images from allowlisted hosts, deduplicated', () => {
    expect(parsed.images.map((image) => image.url)).toEqual([
      'https://img.kleinanzeigen.de/api/v1/prod-ads/images/aa/aa11bb22-0001?rule=$_59.AUTO',
      'https://img.kleinanzeigen.de/api/v1/prod-ads/images/aa/aa11bb22-0002?rule=$_59.AUTO',
      'https://img.kleinanzeigen.de/api/v1/prod-ads/images/aa/aa11bb22-0003?rule=$_59.AUTO',
    ]);
  });

  it('falls back to metadata and page text when the known elements are missing', () => {
    const minimal = `<html><head><meta property="og:title" content="Škoda Octavia Combi 2.0 TDI"></head>
      <body><p>7.900 € VB</p><p>Kilometerstand</p><p>210.000 km</p><p>Erstzulassung</p><p>06/2015</p>
      <p>Kraftstoffart</p><p>Diesel</p></body></html>`;
    const result = parseKleinanzeigenHtml(minimal);
    expect(result.title).toBe('Škoda Octavia Combi 2.0 TDI');
    expect(result.priceText).toBe('7.900 € VB');
    expect(result.attributes).toEqual(
      expect.arrayContaining([
        { label: 'Kilometerstand', value: '210.000 km' },
        { label: 'Kraftstoffart', value: 'Diesel' },
      ]),
    );
  });
});

describe('classifyListingPage', () => {
  it('recognizes listings', () => {
    expect(classifyListingPage(fixture('kleinanzeigen-listing.html'))).toBe('listing');
  });

  it('recognizes block pages and never treats them as listings', () => {
    const blocked =
      '<html><body><h1>IP-Bereich vor&uuml;bergehend gesperrt.</h1><p>Bitte versuche es später erneut.</p></body></html>';
    expect(classifyListingPage(blocked)).toBe('blocked');
    expect(classifyListingPage('<html><body><div class="g-recaptcha"></div></body></html>')).toBe(
      'blocked',
    );
  });

  it('recognizes removed listings', () => {
    expect(
      classifyListingPage(
        '<html><body><p>Die gewünschte Anzeige ist nicht mehr verfügbar.</p></body></html>',
      ),
    ).toBe('not_found');
  });

  it('reports unknown pages', () => {
    expect(classifyListingPage('<html><body><h1>Willkommen</h1></body></html>')).toBe('unknown');
  });
});
