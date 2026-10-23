import { describe, expect, it } from 'vitest';
import {
  EMPTY_LISTING_TEXT,
  kwToPs,
  linkedPower,
  listedPower,
  psToKw,
  mergeListingIntoContract,
  saleContractFromListing,
  LISTING_TITLE_MAX,
  listingDescription,
  listingTitle,
  validateListingText,
  type ListingTextValues,
} from './listing-text';
import { validateSaleContract } from './sale-contract';

const NOW = new Date(2026, 9, 15);

const golf: ListingTextValues = {
  ...EMPTY_LISTING_TEXT,
  make: 'Volkswagen',
  model: 'Golf',
  variant: '1.5 TSI Life',
  firstRegistration: '3/2019',
  odometerKm: '87.400',
  totalMileage: 'matches',
  fuel: 'petrol',
  powerKw: '96',
  transmission: 'manual',
  color: 'Grau',
  huUntil: '04/2027',
  keepers: '2',
  answers: {
    damageOwn: 'yes',
    damageBefore: 'unknown',
    commercialUse: 'no',
    imported: '',
    engineReplaced: 'no',
  },
  details: {
    damageOwn: 'Parkschaden an der Heckklappe, 2023 in einer Fachwerkstatt lackiert',
    damageBefore: 'wird nicht gedruckt',
    commercialUse: '',
    imported: '',
    engineReplaced: '',
  },
  serviceHistory: 'complete',
  lastService: 'Inspektion 05/2026 bei 84.000 km',
  recentWork: '- Bremsen vorne neu (2025)\n\n• Batterie neu',
  modifications: 'Anhängerkupplung, eingetragen',
  defects: 'listed',
  defectsText: 'Steinschlag in der Frontscheibe, außerhalb des Sichtfelds',
  smoking: 'nonSmoker',
  equipment: 'Navi\nSitzheizung',
  accessories: 'Winterräder auf Stahlfelgen',
  reason: 'Neues Auto mit\nmehr Platz',
  location: 'Köln-Ehrenfeld',
};

describe('listing text', () => {
  it('builds a title with as many key facts as fit', () => {
    expect(listingTitle(golf)).toBe('Volkswagen Golf 1.5 TSI Life, 87.400 km, EZ 03/2019');
    expect(listingTitle({ ...golf, variant: '' })).toBe(
      'Volkswagen Golf, 87.400 km, EZ 03/2019, HU 04/2027',
    );
    expect(listingTitle({ ...golf, variant: 'Variant 2.0 TDI DSG Highline' })).toBe(
      'Volkswagen Golf Variant 2.0 TDI DSG Highline, 87.400 km',
    );
    expect(
      listingTitle({
        ...golf,
        variant: 'Variant 2.0 TDI SCR DSG Highline 4MOTION Panoramadach AHK',
      }),
    ).toBe('Volkswagen Golf Variant 2.0 TDI SCR DSG Highline 4MOTION');
    expect(listingTitle({ ...golf, variant: 'x'.repeat(100) })).toBe(
      'Volkswagen Golf, 87.400 km, EZ 03/2019, HU 04/2027',
    );
    expect(listingTitle({ ...golf, make: 'y'.repeat(100) })).toHaveLength(LISTING_TITLE_MAX);
  });

  it('says only what the seller knows and keeps unanswered questions out', () => {
    const text = listingDescription(golf);
    expect(text).toContain('Ich verkaufe privat mein Auto: Volkswagen Golf 1.5 TSI Life.');
    expect(text).toContain('- Kilometerstand laut Tacho: 87.400 km');
    expect(text).toContain('- Gesamtlaufleistung: entspricht nach meiner Kenntnis dem Tachostand');
    expect(text).toContain('- Leistung: 96 kW (131 PS)');
    expect(text).toContain(
      '- Schäden in meiner Besitzzeit: Parkschaden an der Heckklappe, 2023 in einer Fachwerkstatt lackiert',
    );
    expect(text).toContain('- Ob es vor meiner Besitzzeit Schäden gab, weiß ich nicht');
    expect(text).not.toContain('wird nicht gedruckt');
    expect(text).not.toContain('Import');
    expect(text).toContain('Zuletzt gemacht\n- Bremsen vorne neu (2025)\n- Batterie neu');
    expect(text).toContain('Umbauten\n- Anhängerkupplung, eingetragen');
    expect(text).toContain('Bekannte Mängel\n- Steinschlag in der Frontscheibe');
    expect(text).toContain('Grund für den Verkauf: Neues Auto mit mehr Platz');
    expect(text).toContain('Besichtigung und Probefahrt nach Absprache in Köln-Ehrenfeld.');
    expect(text).toContain('soweit das gesetzlich zulässig ist');
    expect(text).not.toMatch(/unfallfrei|garantiert|zugesichert/i);
  });

  it('writes no battery line for a combustion engine', () => {
    expect(listingDescription({ ...golf, battery: 'SoH 91 %' })).not.toContain('Antriebsbatterie');
    expect(
      listingDescription({ ...golf, fuel: 'electric', battery: 'SoH 91 % (Zertifikat 2026)' }),
    ).toContain('- Antriebsbatterie: SoH 91 % (Zertifikat 2026)');
  });

  it('works with make and model only', () => {
    const text = listingDescription({ ...EMPTY_LISTING_TEXT, make: 'Opel', model: 'Corsa' });
    expect(text).toBe(
      [
        'Ich verkaufe privat mein Auto: Opel Corsa.',
        'Besichtigung und Probefahrt nach Absprache.\nZur Probefahrt bitte Personalausweis und Führerschein mitbringen.\nPrivatverkauf: Ich beschreibe das Auto nach bestem Wissen. Die Haftung für Sachmängel schließen wir im schriftlichen Kaufvertrag aus, soweit das gesetzlich zulässig ist.',
      ].join('\n\n'),
    );
  });

  it('converts kW to PS as on the registration certificate', () => {
    expect(kwToPs(96)).toBe(131);
    expect(kwToPs(110)).toBe(150);
    expect(kwToPs(55)).toBe(75);
  });
});

describe('listing text validation', () => {
  it('accepts a complete listing', () => {
    expect(validateListingText(golf, NOW)).toEqual({});
  });

  it('asks for make, model and the details of a „yes“', () => {
    const errors = validateListingText(
      {
        ...EMPTY_LISTING_TEXT,
        answers: { ...EMPTY_LISTING_TEXT.answers, imported: 'yes' },
        defects: 'listed',
      },
      NOW,
    );
    expect(Object.keys(errors).sort()).toEqual([
      'defectsText',
      'details.imported',
      'make',
      'model',
    ]);
  });

  it('rejects dates and numbers it cannot print', () => {
    const errors = validateListingText(
      {
        ...golf,
        firstRegistration: '11/2026',
        huUntil: '2027',
        odometerKm: '87,4',
        powerKw: '0',
        keepers: 'zwei',
        totalMileage: 'differs',
        totalMileageKm: '',
      },
      NOW,
    );
    expect(Object.keys(errors).sort()).toEqual([
      'firstRegistration',
      'huUntil',
      'keepers',
      'odometerKm',
      'powerKw',
      'totalMileageKm',
    ]);
    expect(validateListingText({ ...golf, firstRegistration: '10/2026' }, NOW)).toEqual({});
  });

  it('limits the length of free texts', () => {
    const errors = validateListingText(
      { ...golf, equipment: 'x'.repeat(1501), reason: 'a\n'.repeat(21) },
      NOW,
    );
    expect(errors.equipment).toBe('Bitte höchstens 1500 Zeichen.');
    expect(errors.reason).toBe('Bitte höchstens 20 Zeilen.');
  });
});

describe('review fixes', () => {
  it('accepts the usual German ways to write month and year, and the year alone', () => {
    for (const value of ['09.2016', '9/2016', '09-2016', '09 2016', '2016'])
      expect(validateListingText({ ...golf, firstRegistration: value }, NOW)).toEqual({});
    expect(listingTitle({ ...golf, variant: '', firstRegistration: '2016' })).toContain('EZ 2016');
    expect(validateListingText({ ...golf, huUntil: '2027' }, NOW)).toHaveProperty('huUntil');
    expect(listingDescription({ ...golf, huUntil: '4.2027' })).toContain('- HU bis: 04/2027');
  });

  it('asks for at least one keeper and key, and prints the keys', () => {
    expect(Object.keys(validateListingText({ ...golf, keepers: '0', keys: '00' }, NOW))).toEqual([
      'keepers',
      'keys',
    ]);
    expect(listingDescription({ ...golf, keys: '2' })).toContain('- Schlüssel: 2');
  });

  it('offers no test drive for a deregistered car', () => {
    const text = listingDescription({ ...golf, registration: 'deregistered' });
    expect(text).toContain(
      'Das Auto ist abgemeldet.\nBesichtigung nach Absprache in Köln-Ehrenfeld.',
    );
    expect(text).not.toContain('Probefahrt');
    expect(listingDescription({ ...golf, registration: 'registered' })).toContain(
      'Das Auto ist zugelassen.\nBesichtigung und Probefahrt',
    );
  });

  it('says what the seller knows about smoking, and joins paragraphs with one space', () => {
    const text = listingDescription({ ...golf, reason: 'Erster Satz.\n\nZweiter Satz.' });
    expect(text).toContain('- In meiner Besitzzeit wurde im Auto nicht geraucht');
    expect(text).toContain('Grund für den Verkauf: Erster Satz. Zweiter Satz.');
  });

  it('hands over what the contract accepts', () => {
    const contract = saleContractFromListing({
      ...golf,
      keys: '2',
      firstRegistration: '2019',
      variant: 'x '.repeat(60),
    });
    expect(contract).toMatchObject({ keys: '2', keepers: '2', firstRegistration: '2019' });
    expect(contract.model.length).toBeLessThanOrEqual(100);
    expect(contract.model.endsWith(' ')).toBe(false);
    expect(validateSaleContract(contract, NOW)).toEqual({});
    expect(saleContractFromListing({ ...golf, keepers: '0' }).keepers).toBe('');
  });

  it('ends a cut title without a dangling comma', () => {
    const title = listingTitle({
      ...golf,
      make: 'Volkswagen',
      model: 'Golf',
      variant: 'Variant 2.0 TDI DSG Highline, AHK, Panoramadach, Standheizung',
      odometerKm: '',
      firstRegistration: '',
      huUntil: '',
    });
    expect(title).not.toMatch(/[,\s]$/);
    expect(title.length).toBeLessThanOrEqual(LISTING_TITLE_MAX);
  });
});

describe('a changed listing in a filled-in contract', () => {
  it('keeps what was changed in the contract and takes over the rest', () => {
    const first = saleContractFromListing(golf);
    const typed = {
      ...first,
      vin: 'WVWZZZAUZKW000001',
      knownDefects: 'Steinschlag in der Frontscheibe; Delle hinten rechts',
      answers: { ...first.answers, imported: 'no' as const },
    };
    const next = {
      ...golf,
      color: 'Silber',
      defectsText: 'Steinschlag; Bremsen vorne bald fällig',
    };
    const merged = mergeListingIntoContract(typed, golf, next);
    expect(merged.color).toBe('Silber');
    expect(merged.vin).toBe('WVWZZZAUZKW000001');
    // Typed into the contract: stays, although the listing changed.
    expect(merged.knownDefects).toBe('Steinschlag in der Frontscheibe; Delle hinten rechts');
    expect(merged.answers.imported).toBe('no');
    // Without a previous listing, the listing replaces its fields.
    expect(mergeListingIntoContract(typed, null, next).knownDefects).toBe(
      'Steinschlag; Bremsen vorne bald fällig',
    );
  });
});

describe('round 2', () => {
  it('reads the full date from field B and ends a cut title without a dangling word', () => {
    expect(validateListingText({ ...golf, firstRegistration: '15.09.2016' }, NOW)).toEqual({});
    expect(listingDescription({ ...golf, firstRegistration: '15.09.2016' })).toContain(
      '- Erstzulassung: 09/2016',
    );
    const title = listingTitle({
      ...EMPTY_LISTING_TEXT,
      make: 'VW',
      model: 'Golf',
      variant: 'GTI Clubsport, Performance-Paket, Dach, AHK und Winterräder auf Alufelgen',
    });
    expect(title).toBe('VW Golf GTI Clubsport, Performance-Paket, Dach, AHK');
  });
});

describe('round 3', () => {
  it('keeps keys typed into the contract when the listing gets some later', () => {
    const contract = { ...saleContractFromListing(golf), keys: '3' };
    expect(mergeListingIntoContract(contract, golf, { ...golf, keys: '2' }).keys).toBe('3');
  });
});

describe('power in PS', () => {
  it('links kW and PS both ways', () => {
    expect(linkedPower('kw', '110')).toEqual({ powerKw: '110', powerPs: '150' });
    expect(linkedPower('ps', '78')).toEqual({ powerKw: '57', powerPs: '78' });
    expect(linkedPower('ps', '1.000')).toEqual({ powerKw: '735', powerPs: '1.000' });
    expect(linkedPower('ps', '15o')).toEqual({ powerKw: '', powerPs: '15o' });
    expect(linkedPower('kw', '0')).toEqual({ powerKw: '0', powerPs: '' });
    expect(linkedPower('kw', '')).toEqual({ powerKw: '', powerPs: '' });
    expect(psToKw(150)).toBe(110);
  });

  it('agrees with itself for every whole PS figure', () => {
    for (let ps = 1; ps <= 2719; ps++) {
      const power = linkedPower('ps', String(ps));
      expect(validateListingText({ ...golf, ...power }, NOW)).toEqual({});
      expect(validateSaleContract({ ...saleContractFromListing(golf), ...power }, NOW)).toEqual({});
    }
  });

  it('keeps the PS as typed in', () => {
    const typed = { ...golf, ...linkedPower('ps', '78') };
    expect(listingDescription(typed)).toContain('- Leistung: 57 kW (78 PS)');
    expect(saleContractFromListing(typed)).toMatchObject({ powerKw: '57', powerPs: '78' });
    // Without a PS figure, it is worked out from the kW.
    expect(listingDescription(golf)).toContain('- Leistung: 96 kW (131 PS)');
    expect(saleContractFromListing(golf)).toMatchObject({ powerKw: '96', powerPs: '131' });
  });

  it('rejects PS that do not fit the kW', () => {
    expect(validateListingText({ ...golf, powerKw: '96', powerPs: '150' }, NOW)).toEqual({
      powerPs: expect.stringContaining('passen nicht zusammen') as string,
    });
    expect(Object.keys(validateListingText({ ...golf, powerPs: '0' }, NOW))).toEqual(['powerPs']);
    expect(Object.keys(validateListingText({ ...golf, powerPs: '2720' }, NOW))).toEqual([
      'powerPs',
    ]);
  });

  it('keeps the figures a listing states when they agree', () => {
    expect(listedPower(57, 78)).toEqual({ powerKw: '57', powerPs: '78' });
    expect(listedPower(67, 90)).toEqual({ powerKw: '67', powerPs: '90' });
    expect(listedPower(96, 150)).toEqual({ powerKw: '96', powerPs: '131' });
    expect(listedPower(96, null)).toEqual({ powerKw: '96', powerPs: '131' });
    expect(listedPower(null, 150)).toEqual({ powerKw: '', powerPs: '' });
  });

  it('hands too much power to the contract without a PS figure', () => {
    expect(saleContractFromListing({ ...golf, powerKw: '2500' })).toMatchObject({
      powerKw: '2500',
      powerPs: '',
    });
  });

  it('takes a PS figure from the listing that differs from the worked-out one', () => {
    const typed = { ...golf, ...linkedPower('ps', '78') };
    const contract = saleContractFromListing(typed);
    const next = { ...typed, color: 'Blau' };
    expect(mergeListingIntoContract(contract, typed, next)).toMatchObject({
      powerKw: '57',
      powerPs: '78',
      color: 'Blau',
    });
    expect(
      mergeListingIntoContract(contract, typed, { ...typed, ...linkedPower('ps', '80') }),
    ).toMatchObject({ powerKw: '59', powerPs: '80' });
  });

  it('takes a changed power over as a pair', () => {
    const first = saleContractFromListing(golf);
    const next = { ...golf, ...linkedPower('kw', '110') };
    expect(mergeListingIntoContract(first, golf, next)).toMatchObject({
      powerKw: '110',
      powerPs: '150',
    });
    // Changed in the contract: both stay, even if one of them still matches the listing.
    const typed = { ...first, ...linkedPower('ps', '130') };
    expect(typed.powerKw).toBe(first.powerKw);
    expect(mergeListingIntoContract(typed, golf, next)).toMatchObject({
      powerKw: '96',
      powerPs: '130',
    });
  });
});
