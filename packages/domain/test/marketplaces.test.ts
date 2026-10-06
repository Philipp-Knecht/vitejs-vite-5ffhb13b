import { describe, expect, it } from 'vitest';
import { parseListingText } from '../src/index';
import { listingFromText } from './helpers';

/*
 * Fictional listings in the layout visitors get when they copy a whole listing
 * page of the respective marketplace (labels and values on separate lines,
 * page chrome around them). No real listing data.
 */

const MOBILE_DE = `
mobile.de
Fahrzeug suchen
Volkswagen Golf 1.4 TSI Highline
Navi, PDC, Sitzheizung
12.990 €
Brutto
Guter Preis
Technische Daten
Fahrzeugzustand
Unfallfrei
Kategorie
Limousine, Gebrauchtfahrzeug
Herkunft
Deutsche Ausführung
Kilometerstand
98.500 km
Hubraum
1.395 cm³
Leistung
110 kW (150 PS)
Antriebsart
Verbrennungsmotor
Kraftstoffart
Benzin
Anzahl Sitzplätze
5
Anzahl der Türen
4/5
Getriebe
Schaltgetriebe
Emissionsklasse
Euro6
Erstzulassung
03/2017
Anzahl der Fahrzeughalter
2
HU
05/2027
Farbe (Hersteller)
Pure White
Ausstattung
ABS
Bluetooth
Navigationssystem
Sitzheizung
Fahrzeugbeschreibung laut Anbieter
Zahnriemen und Wasserpumpe bei 90.000 km neu. Scheckheft vollständig bei VW.
Privatanbieter
22767 Hamburg
Ähnliche Fahrzeuge
BMW 118i
9.990 €
`;

const AUTOSCOUT24 = `
BMW 320 d Touring Advantage
Navi | LED | AHK
€ 18.900,-
Kilometerstand
112.000 km
Getriebe
Automatik
Erstzulassung
06/2018
Kraftstoff
Diesel
Leistung
140 kW (190 PS)
Verkäufer
Händler
Basisdaten
Fahrzeugart
Gebraucht
Karosserieform
Kombi
Sitzplätze
5
Türen
5
Fahrzeughistorie
Kilometerstand
112.000 km
Erstzulassung
06/2018
HU
04/2027
Fahrzeughalter
1
Scheckheftgepflegt
Ja
Technische Daten
Hubraum
1.995 cm³
Energieverbrauch
Schadstoffklasse
Euro 6d-TEMP
Ausstattung
Komfort
Klimaautomatik
Sitzheizung
Sicherheit
Spurhalteassistent
Farbe und Innenausstattung
Außenfarbe
Schwarz
Fahrzeugbeschreibung
Gepflegter Kombi aus erster Hand, alle Inspektionen beim BMW-Händler.
Händler kontaktieren
Ähnliche Angebote
`;

const EBAY = `
Volkswagen Golf VII 1.4 TSI Highline
Zustand: Gebraucht
Preis: EUR 11.490,00
Sofort-Kaufen
Artikelmerkmale
Marke
Volkswagen
Modell
Golf
Kilometerstand
104.000 km
Erstzulassungsdatum
04/2016
Kraftstoff
Benzin
Getriebe
Schaltgetriebe
Leistung
150 PS
Fahrzeugtyp
Limousine
Anzahl der Vorbesitzer
3
HU gültig bis
08/2026
Artikelbeschreibung des Verkäufers
Verkaufe meinen Golf, Nichtraucher, Winterreifen auf Felgen dabei.
Ähnliche Artikel
`;

const AUTOHERO = `
Auto kaufen
Auto verkaufen
Finanzieren
Garantie
Vorteile im Überblick
Autohero-Garantie: 12 Monate
HU/AU gültig bis: 14.05.28
Letzter Service am: 02.06.26
Skoda Octavia
Combi 2.0 TDI Style
189 € mtl.
14.490 €
Benachrichtigung bei Preisreduzierung
Wähle eine Option:
Finanzierung ab
189 €
mtl.
0 € Anzahlung
Einmalzahlung
14.490 €
Zahlung bei Lieferung
Fahrzeugdetails
Ausstattung
Fahrzeugdetails
Erstzulassung
12.03.2018
Kilometerstand
121.300 km
Kraftstoff
Diesel
Getriebe
Automatik
Leistung
150 PS / 110 kW
Anzahl Vorbesitzer
2
Letzter Service
02.06.2026
Fahrzeugzustand
Unfallfrei
Außen und Innen
Fahrzeugklasse
Kombi
Türen
5
Anzahl Sitzplätze
5
Farbe
Blau
Motor, Antrieb und Verbrauch
Antriebsart
Frontantrieb
Hubraum
1968 ccm
Schadstoffklasse
EURO 6
Fahrzeughistorie
Herkunftsland
Deutschland
Anzahl Schlüssel
2
Gewerbliche Nutzung
Nein
HU/AU gültig bis
14.05.2028
Ausstattung
Highlights
Navigationssystem
Rückfahrkamera
Komfort
Klimaautomatik
Sitzheizung vorn
Sicherheit
Spurhalteassistent
Finanzierung individuell gestalten
Dein Kredit, deine Konditionen.
Qualitätsstandard
Bei Autohero verkaufen wir nur Fahrzeuge aus unserem eigenen Bestand.
`;

const PKW_DE = `
Opel Astra 1.2 Turbo Elegance
Autohaus Beispiel GmbH
12345 Musterstadt
Händler kontaktieren
Superpreis
€ 17.780 ,-
€ 18.480 ,-
-4%
MwSt. ausweisbar
Kilometerstand
37.150 km
Erstzulassung
01/2022
Leistung
96 kW (131 PS)
Kraftstoff
Benzin
Getriebe
Automatik
`;

describe('parseListingText – mobile.de page', () => {
  const parsed = parseListingText(MOBILE_DE);

  it('takes the title naming the make, not the subtitle before the price', () => {
    expect(parsed.title).toBe('Volkswagen Golf 1.4 TSI Highline');
    expect(parsed.priceText).toBe('12.990 €');
    expect(parsed.sellerTypeText).toBe('Privatanbieter');
    expect(parsed.locationText).toBe('22767 Hamburg');
  });

  it('reads the description section and stops before similar vehicles', () => {
    expect(parsed.description).toBe(
      'Zahnriemen und Wasserpumpe bei 90.000 km neu. Scheckheft vollständig bei VW.',
    );
  });

  it('normalizes the vehicle facts', () => {
    const listing = listingFromText(MOBILE_DE);
    expect(listing.price).toMatchObject({ amountEur: 12990 });
    expect(listing.seller.type).toBe('private');
    expect(listing.vehicle).toMatchObject({
      make: 'Volkswagen',
      mileageKm: 98500,
      firstRegistration: { year: 2017, month: 3 },
      fuel: 'petrol',
      powerKw: 110,
      powerPs: 150,
      transmission: 'manual',
      huUntil: { year: 2027, month: 5 },
      previousOwners: 2,
    });
    expect(listing.vehicle?.equipment).toEqual(
      expect.arrayContaining(['Navigationssystem', 'Sitzheizung']),
    );
  });
});

describe('parseListingText – AutoScout24 page', () => {
  const parsed = parseListingText(AUTOSCOUT24);

  it('reads the euro-first price, the dealer and the title', () => {
    expect(parsed.title).toBe('BMW 320 d Touring Advantage');
    expect(parsed.priceText).toBe('€ 18.900,-');
    expect(parsed.sellerTypeText).toBe('Händler');
  });

  it('does not take "Gebraucht" for the body style', () => {
    const listing = listingFromText(AUTOSCOUT24);
    expect(listing.vehicle?.bodyType).toBe('Kombi');
  });

  it('normalizes the vehicle facts', () => {
    const listing = listingFromText(AUTOSCOUT24);
    expect(listing.price).toMatchObject({ amountEur: 18900 });
    expect(listing.seller.type).toBe('commercial');
    expect(listing.vehicle).toMatchObject({
      make: 'BMW',
      mileageKm: 112000,
      firstRegistration: { year: 2018, month: 6 },
      fuel: 'diesel',
      powerPs: 190,
      transmission: 'automatic',
      huUntil: { year: 2027, month: 4 },
      previousOwners: 1,
    });
    expect(listing.description).toBe(
      'Gepflegter Kombi aus erster Hand, alle Inspektionen beim BMW-Händler.',
    );
  });
});

describe('parseListingText – eBay item page', () => {
  it('reads item specifics, price and description', () => {
    const listing = listingFromText(EBAY);
    expect(listing.title).toBe('Volkswagen Golf VII 1.4 TSI Highline');
    expect(listing.price).toMatchObject({ amountEur: 11490 });
    expect(listing.vehicle).toMatchObject({
      make: 'Volkswagen',
      mileageKm: 104000,
      firstRegistration: { year: 2016, month: 4 },
      fuel: 'petrol',
      powerPs: 150,
      transmission: 'manual',
      huUntil: { year: 2026, month: 8 },
      previousOwners: 3,
    });
    expect(listing.description).toBe(
      'Verkaufe meinen Golf, Nichtraucher, Winterreifen auf Felgen dabei.',
    );
  });
});

describe('parseListingText – Autohero page', () => {
  const parsed = parseListingText(AUTOHERO);

  it('takes the price, not the monthly rate, and the model line as title', () => {
    expect(parsed.priceText).toBe('14.490 €');
    expect(parsed.title).toBe('Skoda Octavia Combi 2.0 TDI Style');
  });

  it('keeps service date and origin as facts, not as listing date or description', () => {
    expect(parsed.postedAtText).toBeNull();
    expect(parsed.description).toBeNull();
    expect(parsed.attributes).toEqual(
      expect.arrayContaining([
        { label: 'Letzter Service am', value: '02.06.26' },
        { label: 'Herkunftsland', value: 'Deutschland' },
        { label: 'Gewerbliche Nutzung', value: 'Nein' },
      ]),
    );
  });

  it('normalizes the vehicle facts', () => {
    const listing = listingFromText(AUTOHERO);
    expect(listing.price).toMatchObject({ amountEur: 14490 });
    // Autohero sells only its own stock.
    expect(listing.seller.type).toBe('commercial');
    expect(listing.vehicle).toMatchObject({
      make: 'Škoda',
      mileageKm: 121300,
      firstRegistration: { year: 2018, month: 3 },
      fuel: 'diesel',
      powerKw: 110,
      powerPs: 150,
      transmission: 'automatic',
      huUntil: { year: 2028, month: 5 },
      previousOwners: 2,
      bodyType: 'Kombi',
    });
    expect(listing.vehicle?.equipment).toEqual(
      expect.arrayContaining(['Navigationssystem', 'Klimaautomatik']),
    );
  });
});

describe('parseListingText – pkw.de page', () => {
  it('reads the current price written as "€ 17.780 ,-", not the crossed-out one', () => {
    const parsed = parseListingText(PKW_DE);
    expect(parsed.priceText).toBe('€ 17.780 ,-');
    expect(parsed.title).toBe('Opel Astra 1.2 Turbo Elegance');
    // Dealer name, contact button and crossed-out price are no description.
    expect(parsed.description).toBeNull();
    const listing = listingFromText(PKW_DE);
    expect(listing.price).toMatchObject({ amountEur: 17780 });
    expect(listing.seller.type).toBe('commercial');
    expect(listing.vehicle).toMatchObject({
      make: 'Opel',
      mileageKm: 37150,
      firstRegistration: { year: 2022, month: 1 },
      powerKw: 96,
      transmission: 'automatic',
    });
  });
});
