import { describe, expect, it } from 'vitest';
import {
  getExampleListing,
  INSUFFICIENT_MARKET_DATA_MESSAGE,
  MIN_COMPARABLES,
  NBSP,
  parseListingText,
  prepareListing,
  REDACTED_PHONE,
} from '../src/index';
import { analyze, fixture, listingFromHtml, listingFromText, NOW, pasted, source } from './helpers';

const ids = (items: { id: string }[]) => items.map((item) => item.id);

describe('example listing (Audi A7)', async () => {
  const listing = listingFromText(getExampleListing()!.text, 'example');
  const result = await analyze(listing);

  it('normalizes the vehicle with provenance', () => {
    expect(listing.source.isExample).toBe(true);
    expect(listing.vehicle).toMatchObject({
      make: 'Audi',
      model: 'A7',
      variant: 'Sportback 3.0 TFSI quattro S tronic',
      mileageKm: 185000,
      firstRegistration: { year: 2012, month: 5 },
      fuel: 'petrol',
      powerPs: 310,
      powerKw: 228,
      transmission: 'automatic',
      drivetrain: 'awd',
      huUntil: { year: 2027, month: 6 },
      serviceHistory: 'claimed',
      accidentHistory: null,
      previousOwners: null,
      condition: 'undamaged',
    });
    expect(listing.vehicle?.fieldSources.drivetrain).toEqual({
      source: 'title',
      raw: 'Audi A7 Sportback 3.0 TFSI quattro S tronic',
    });
    expect(listing.seller.type).toBe('private');
  });

  it('builds the header as in the listing', () => {
    expect(result.vehicleSummary?.title).toBe('Audi A7 Sportback 3.0 TFSI quattro S tronic');
    expect(result.vehicleSummary?.chips.map((chip) => chip.text)).toEqual([
      '2012',
      `185.000${NBSP}km`,
      `310${NBSP}PS`,
      'Automatik',
      'Benzin',
      `12.900${NBSP}€ VB`,
    ]);
  });

  it('computes a transparent completeness score', () => {
    const { completeness } = result;
    expect(completeness.checkableCount).toBe(14);
    expect(completeness.presentCount).toBe(12);
    expect(completeness.score).toBe(86);
    const missing = completeness.fields.filter((f) => f.status === 'missing').map((f) => f.key);
    expect(missing).toEqual(['accidentHistory', 'previousOwners']);
    expect(completeness.fields.find((f) => f.key === 'photos')?.status).toBe('not_checkable');
    expect(completeness.fields.find((f) => f.key === 'accidentHistory')?.note).toMatch(
      /unbeschädigt/i,
    );
  });

  it('reports the mileage contradiction with the quote', () => {
    const conflict = result.observations.find((o) => o.id === 'mileage_conflict');
    expect(conflict).toMatchObject({
      severity: 'warning',
      evidence: 'listing_fact',
      origin: 'rules',
    });
    expect(conflict?.quotes).toEqual([
      'Laufleistung aktuell 158.000 km, der Wagen wird noch gefahren.',
    ]);
    expect(ids(result.observations)).toContain('damage_mentioned');
  });

  it('never invents market data', () => {
    expect(result.priceContext.market).toEqual({
      status: 'insufficient_data',
      message: INSUFFICIENT_MARKET_DATA_MESSAGE,
      sampleSize: 0,
    });
    expect(result.priceContext.metrics.map((m) => [m.key, m.evidence])).toEqual([
      ['price_per_year', 'calculation'],
      ['price_per_10000_km', 'calculation'],
      ['km_per_year', 'calculation'],
    ]);
  });

  it('asks specific questions for missing information, formal and informal', () => {
    const questions = result.sellerQuestions;
    expect(ids(questions)).toEqual(
      expect.arrayContaining([
        'mileage_conflict',
        'accident',
        'service_proof',
        'owners',
        'gearbox_oil',
        'damage_details',
      ]),
    );
    expect(ids(questions)).not.toContain('test_drive'); // offered in the description
    const damage = questions.find((q) => q.id === 'damage_details');
    expect(damage?.text).toMatch(/^Sie erwähnen „Kratzer“/);
    expect(damage?.textInformal).toMatch(/^Du erwähnst „Kratzer“/);
    expect(questions.every((q) => q.priority >= 1 && q.priority <= 3)).toBe(true);
    // Priority order
    const priorities = questions.map((q) => q.priority);
    expect([...priorities].sort()).toEqual(priorities);
  });

  it('adds vehicle-specific checks and checklist items', () => {
    expect(ids(result.checks)).toEqual(
      expect.arrayContaining([
        'automatic_transmission',
        'rust',
        'all_wheel_drive',
        'high_performance',
        'private_sale',
      ]),
    );
    const drive = result.inspectionChecklist.find((section) => section.id === 'test_drive');
    expect(drive?.items.map((item) => item.id)).toEqual(
      expect.arrayContaining(['drive.cold_start', 'drive.awd']),
    );
    expect(result.inspectionChecklist.map((section) => section.title)).toEqual([
      'Dokumente',
      'Außen',
      'Motorraum',
      'Innenraum',
      'Probefahrt',
      'Kauf & Übergabe',
    ]);
  });

  it('writes a neutral summary without verdicts', () => {
    expect(result.summary.text).toMatch(/12 von 14 wichtigen Angaben/);
    expect(result.summary.text).not.toMatch(/guter Kauf|Empfehlung|Betrug/i);
    expect(result.summary.positives.map((p) => p.text)).toContain(
      'Nichtraucherfahrzeug laut Beschreibung',
    );
    expect(result.summary.openPoints[0]?.text).toBe('Unterschiedliche Kilometerstände im Inserat');
  });
});

describe('listing page (BMW 530d)', async () => {
  const listing = listingFromHtml(fixture('kleinanzeigen-listing.html'));
  const result = await analyze(listing);

  it('redacts contact data from the stored description', () => {
    expect(listing.description).toContain(REDACTED_PHONE);
    expect(listing.description).not.toMatch(/0171|example\.com/);
  });

  it('reads service, accident and owner claims', () => {
    expect(listing.vehicle).toMatchObject({
      make: 'BMW',
      model: '5er Reihe',
      fuel: 'diesel',
      serviceHistory: 'documented',
      accidentHistory: 'accident_free',
      previousOwners: 2,
    });
    expect(listing.vehicle?.fieldSources.serviceHistory?.source).toBe('equipment');
  });

  it('counts allowlisted photos for URL listings', () => {
    expect(result.completeness.fields.find((f) => f.key === 'photos')).toMatchObject({
      status: 'present',
      value: `3${NBSP}Fotos`,
    });
    expect(ids(result.observations)).not.toContain('photos_few');
  });

  it('suggests confirming claims instead of repeating them', () => {
    expect(ids(result.checks)).toEqual(
      expect.arrayContaining(['verify_service_claim', 'confirm_accident_free']),
    );
    expect(ids(result.sellerQuestions)).not.toContain('accident');
    expect(ids(result.sellerQuestions)).not.toContain('owners');
  });
});

describe('pasted text (VW Golf)', async () => {
  const listing = listingFromText(fixture('pasted-inline.txt'));
  const result = await analyze(listing);

  it('detects the expired HU and the transmission contradiction', () => {
    expect(ids(result.observations)).toEqual(
      expect.arrayContaining(['hu_expired', 'transmission_conflict']),
    );
    expect(result.observations.find((o) => o.id === 'hu_expired')?.detail).toMatch(
      /seit 4.Monaten abgelaufen/,
    );
  });

  it('records the repaired damage and the reserved status', () => {
    expect(listing.vehicle?.accidentHistory).toBe('previous_damage');
    expect(ids(result.observations)).toContain('listing_reserved');
    expect(ids(result.sellerQuestions)).toContain('accident_details');
  });

  it('does not flag negated defects', () => {
    const damage = result.observations.find((o) => o.id === 'damage_mentioned');
    expect(damage?.detail).not.toMatch(/rost|dellen|mängel/i);
  });
});

describe('description-only text (Opel Astra)', async () => {
  const listing = listingFromText(fixture('description-only.txt'));
  const result = await analyze(listing);

  it('extracts facts from the description and labels their source', () => {
    expect(listing.vehicle).toMatchObject({
      make: 'Opel',
      mileageKm: 142000,
      firstRegistration: { year: 2018, month: 4 },
      powerPs: 110,
      fuel: 'diesel',
      serviceHistory: 'claimed',
    });
    expect(listing.price).toMatchObject({ amountEur: 7900, kind: 'negotiable' });
    expect(listing.vehicle?.fieldSources.mileageKm?.source).toBe('description');
    expect(result.overview.find((item) => item.key === 'mileage')?.note).toBe('laut Beschreibung');
  });

  it('mentions the air-conditioning problem', () => {
    expect(result.observations.find((o) => o.id === 'damage_mentioned')?.quotes[0]).toMatch(
      /Klima kühlt nicht/,
    );
  });
});

describe('individual rules', () => {
  const run = (details: Record<string, string>, description = '', title?: string) =>
    analyze(listingFromText(pasted(details, description, title)));

  it('flags registrations in the future', async () => {
    const result = await run({ Marke: 'VW', Erstzulassung: '01/2027', Kilometerstand: '10 km' });
    expect(ids(result.observations)).toContain('registration_in_future');
  });

  it('flags HU dates beyond the legal interval', async () => {
    const result = await run({
      Marke: 'VW',
      Erstzulassung: '2015',
      Kilometerstand: '100.000 km',
      'HU bis': '12/2029',
    });
    expect(ids(result.observations)).toContain('hu_date_implausible');
  });

  it('allows the first HU 36 months after registration', async () => {
    const result = await run({
      Marke: 'VW',
      Erstzulassung: '06/2026',
      Kilometerstand: '1.000 km',
      'HU bis': '06/2029',
    });
    expect(ids(result.observations)).not.toContain('hu_date_implausible');
  });

  it('flags placeholder mileage and placeholder prices', async () => {
    const listing = listingFromText(
      [
        'Testauto',
        '1 €',
        'Details',
        'Marke',
        'Ford',
        'Erstzulassung',
        '2010',
        'Kilometerstand',
        '1 km',
      ].join('\n'),
    );
    const result = await analyze(listing);
    expect(ids(result.observations)).toEqual(
      expect.arrayContaining(['mileage_placeholder', 'price_placeholder']),
    );
    expect(ids(result.sellerQuestions)).toContain('price');
  });

  it('flags fuel contradictions between title and details', async () => {
    const result = await run(
      { Marke: 'BMW', Kraftstoffart: 'Benzin', Kilometerstand: '150.000 km' },
      '',
      'BMW 320d Touring',
    );
    expect(result.observations.find((o) => o.id === 'fuel_conflict')?.detail).toMatch(/„320d“/);
  });

  it('flags emission tampering and commercial wording in private listings', async () => {
    const listing = listingFromText(
      `${pasted({ Marke: 'Audi', Kilometerstand: '200.000 km' }, 'DPF entfernt. Finanzierung möglich.')}\nPrivater Nutzer`,
    );
    const result = await analyze(listing);
    expect(ids(result.observations)).toEqual(
      expect.arrayContaining(['emission_tampering', 'seller_type_mismatch']),
    );
  });

  it('warns when basic facts are missing', async () => {
    const listing = listingFromText('Verkaufe meinen BMW 318i. TÜV neu. Bei Interesse melden.');
    const result = await analyze(listing);
    expect(ids(result.observations)).toContain('basics_missing');
    expect(result.completeness.score).toBeLessThan(40);
  });

  it('flags unusual annual mileage in both directions', async () => {
    const high = await run({ Marke: 'VW', Erstzulassung: '09/2022', Kilometerstand: '200.000 km' });
    expect(ids(high.observations)).toContain('annual_mileage_high');
    const low = await run({ Marke: 'VW', Erstzulassung: '09/2014', Kilometerstand: '20.000 km' });
    expect(ids(low.observations)).toContain('annual_mileage_low');
  });
});

describe('market context', () => {
  const listing = listingFromText(getExampleListing()!.text, 'example');

  it('shows a range only with enough verified comparables', async () => {
    const few = await analyze(listing, {
      comparables: Array.from({ length: MIN_COMPARABLES - 1 }, () => ({ priceEur: 14000 })),
      criteria: 'Audi A7',
      source: 'Test',
    });
    expect(few.priceContext.market.status).toBe('insufficient_data');

    const prices = [11000, 12000, 13000, 14000, 15000, 16000, 17000, 18000];
    const enough = await analyze(listing, {
      comparables: prices.map((priceEur) => ({ priceEur })),
      criteria: 'Audi A7, EZ 2010–2014',
      source: 'Test',
    });
    expect(enough.priceContext.market).toMatchObject({
      status: 'available',
      sampleSize: 8,
      medianEur: 14500,
      lowerQuartileEur: 12750,
      upperQuartileEur: 16250,
      deviationPercent: -11,
    });
    expect(enough.priceContext.metrics.map((m) => m.key)).toContain('comparable_deviation');
  });
});

describe('prepareListing', () => {
  it('rejects non-car listings with a reason', () => {
    const parsed = parseListingText(
      'Verkaufe mein Mountainbike, Rahmenhöhe 52 cm, 27 Gänge, kaum gefahren.',
    );
    const prepared = prepareListing({ parsed, source: source(), urlCategoryId: null });
    expect(prepared).toMatchObject({ ok: false, reason: 'unsupported_category' });
  });

  it('rejects empty input', () => {
    const prepared = prepareListing({
      parsed: parseListingText('   '),
      source: source(),
      urlCategoryId: null,
    });
    expect(prepared).toMatchObject({ ok: false, reason: 'no_content' });
  });

  it('keeps the reference date for ages', async () => {
    const listing = listingFromText(getExampleListing()!.text);
    const result = await analyze(listing);
    expect(result.overview.find((item) => item.key === 'age')?.value).toBe(
      `14${NBSP}Jahre, 4${NBSP}Monate`,
    );
    expect(NOW.getFullYear()).toBe(2026);
  });
});

describe('vehicle title', () => {
  it.each([
    ['BMW 530d Touring M Sport *TOP* TÜV neu', 'BMW 530d Touring M Sport'],
    ['Reserviert • VW Golf 7 1.4 TSI Highline DSG', 'VW Golf 7 1.4 TSI Highline DSG'],
    ['Mercedes-Benz E 350 d T-Modell Avantgarde!!!', 'Mercedes-Benz E 350 d T-Modell Avantgarde'],
    ['Schöner Kombi zu verkaufen', null],
  ])('%s → %s', async (title, expected) => {
    const { deriveVehicleTitle, stripTitleMarkers } = await import('../src/index');
    expect(deriveVehicleTitle(stripTitleMarkers(title).title)).toBe(expected);
  });
});
