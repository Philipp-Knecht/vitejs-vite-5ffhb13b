import { describe, expect, it } from 'vitest';
import {
  EMPTY_LISTING_TEXT,
  kwToPs,
  LISTING_TITLE_MAX,
  listingDescription,
  listingTitle,
  validateListingText,
  type ListingTextValues,
} from './listing-text';

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
      '- In meiner Besitzzeit gab es einen Schaden: Parkschaden an der Heckklappe, 2023 in einer Fachwerkstatt lackiert',
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
      { ...golf, equipment: 'x'.repeat(1501), reason: 'a\n'.repeat(31) },
      NOW,
    );
    expect(errors.equipment).toBe('Bitte höchstens 1500 Zeichen.');
    expect(errors.reason).toBe('Bitte höchstens 30 Zeilen.');
  });
});
