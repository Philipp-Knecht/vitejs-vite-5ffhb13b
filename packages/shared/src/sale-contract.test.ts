import { describe, expect, it } from 'vitest';
import {
  cleanLine,
  cleanText,
  CONTRACT_STATEMENTS,
  EMPTY_SALE_CONTRACT,
  parseWholeNumber,
  saleContractBlocks,
  validateSaleContract,
  type ContractBlock,
  type SaleContractValues,
} from './sale-contract';

const text = (blocks: ContractBlock[]) => JSON.stringify(blocks);
const choices = (blocks: ContractBlock[]) =>
  blocks.filter(
    (block): block is Extract<ContractBlock, { kind: 'choice' }> => block.kind === 'choice',
  );
const field = (blocks: ContractBlock[], label: string) =>
  blocks
    .flatMap((block) => (block.kind === 'fields' ? block.rows : []))
    .find((row) => row.label === label)?.value;

const filled: SaleContractValues = {
  ...EMPTY_SALE_CONTRACT,
  seller: { ...EMPTY_SALE_CONTRACT.seller, name: 'Muster, Erika', birthDate: '1980-02-29' },
  make: 'Audi',
  model: 'A4 Avant',
  vin: 'wauzzz8k 9ba123456',
  price: '12.500',
  deposit: '500',
  payment: 'transfer',
  odometerKm: '154 300',
  totalMileage: 'matches',
  answers: {
    damageOwn: 'yes',
    damageBefore: 'no',
    commercialUse: 'unknown',
    imported: 'no',
    engineReplaced: '',
    openRecalls: 'no',
  },
  details: {
    ...EMPTY_SALE_CONTRACT.details,
    damageOwn: 'Parkschaden hinten links, in einer Werkstatt lackiert',
    damageBefore: 'should not be printed',
  },
  registration: 'registered',
  handoverDate: '2026-10-20',
  reRegisterBy: '2026-10-27',
  documents: ['registrationPart1', 'registrationPart2'],
};

describe('saleContractBlocks', () => {
  it('leaves every statement unticked and every field open when nothing is entered', () => {
    const blocks = saleContractBlocks(EMPTY_SALE_CONTRACT);
    expect(choices(blocks).every((choice) => choice.checked === null)).toBe(true);
    expect(
      blocks.some(
        (block) => block.kind === 'checklist' && block.items.some((item) => item.checked),
      ),
    ).toBe(false);
    expect(field(blocks, 'Kaufpreis')).toBe('');
    expect(field(blocks, 'Tachostand bei Vertragsschluss (abgelesen)')).toBe('');
    // The fuel is open, so the battery question is there for electric cars.
    expect(text(blocks)).toContain('Nur bei Elektroautos und Plug-in-Hybriden');
  });

  it('excludes liability only with the carve-outs the law requires', () => {
    const all = text(saleContractBlocks(EMPTY_SALE_CONTRACT));
    expect(all).toContain('Verletzung des Lebens, des Körpers oder der Gesundheit');
    expect(all).toContain('grob fahrlässigen oder vorsätzlichen Pflichtverletzung');
    expect(all).toContain('seines gesetzlichen Vertreters oder seines Erfüllungsgehilfen');
    expect(all).toContain('arglistig verschwiegen');
    expect(all).toContain('eine Garantie für die Beschaffenheit');
    expect(all).toContain('vereinbarte Beschaffenheit');
    expect(all).toContain('Rechtsmängeln bleiben unberührt');
    // No guarantees or catch-all phrases slipped in.
    expect(all).not.toMatch(
      /garantiert|sichert zu|zugesichert|gekauft wie gesehen|soweit gesetzlich zulässig/i,
    );
  });

  it('prints what was entered', () => {
    const blocks = saleContractBlocks(filled);
    expect(field(blocks, 'Kaufpreis')).toBe('12.500 Euro');
    expect(field(blocks, 'in Worten')).toBe('zwölftausendfünfhundert Euro');
    expect(field(blocks, 'Fahrzeug-Identifizierungsnummer (FIN)')).toBe('WAUZZZ8K9BA123456');
    const parties = blocks.find((block) => block.kind === 'parties');
    expect(
      parties?.kind === 'parties' && parties.rows.find((row) => row.label === 'Geburtsdatum'),
    ).toEqual({
      label: 'Geburtsdatum',
      seller: '29.02.1980',
      buyer: '',
    });
    expect(field(blocks, 'Tachostand bei Vertragsschluss (abgelesen)')).toBe('154.300 km');
    expect(text(blocks)).toContain('Anzahlung von 500 Euro');
    expect(text(blocks)).toContain('Der restliche Kaufpreis beträgt 12.000 Euro.');
    expect(text(blocks)).toContain('spätestens am 27.10.2026');
  });

  it('ticks the seller’s answers and prints details only for „Ja“', () => {
    const statements = choices(saleContractBlocks(filled)).slice(
      -CONTRACT_STATEMENTS.length - 2,
      -2,
    );
    expect(statements.map((choice) => choice.checked)).toEqual([0, 1, 2, 1, null, 1]);
    expect(statements[0]?.detail?.value).toBe(
      'Parkschaden hinten links, in einer Werkstatt lackiert',
    );
    expect(statements[1]?.detail?.value).toBe('');
    expect(statements[0]?.options[1]).toBe('Nein');
    expect(statements[1]?.options[1]).toBe('Nein, soweit dem Verkäufer bekannt');
  });

  it('keeps a deposit without a price, with the rest left open', () => {
    const all = text(saleContractBlocks({ ...EMPTY_SALE_CONTRACT, deposit: '500' }));
    expect(all).toContain('Anzahlung von 500 Euro');
    expect(all).toContain('Der restliche Kaufpreis beträgt _______________ Euro.');
  });

  it('prints no battery clause for a car without an electric drive', () => {
    const blocks = saleContractBlocks({
      ...EMPTY_SALE_CONTRACT,
      fuel: 'petrol',
      battery: 'rented',
    });
    expect(text(blocks)).not.toContain('Antriebsbatterie');
  });

  it('makes only the binding mileage option an agreed quality', () => {
    const blocks = saleContractBlocks({
      ...EMPTY_SALE_CONTRACT,
      totalMileage: 'agreed',
      totalMileageKm: '180000',
    });
    const choice = choices(blocks)[0];
    expect(choice?.checked).toBe(3);
    expect(choice?.options[3]).toBe(
      'Sie betrug bei Vertragsschluss höchstens 180.000 km; das gehört zur vereinbarten Beschaffenheit.',
    );
    expect(choice?.options[2]).toContain('_______________ km');
  });

  it('leaves out the duties of a registered car when it is deregistered', () => {
    const all = text(saleContractBlocks({ ...EMPTY_SALE_CONTRACT, registration: 'deregistered' }));
    expect(all).not.toContain('stellt der Käufer den Verkäufer frei');
    expect(all).toContain('zeigt den Verkauf unverzüglich seiner Kfz-Versicherung an.');
    expect(all).not.toContain('Zulassungsbehörde an');
  });

  it('asks about the traction battery of an electric car', () => {
    const blocks = saleContractBlocks({
      ...EMPTY_SALE_CONTRACT,
      fuel: 'electric',
      battery: 'rented',
    });
    const battery = choices(blocks).find((choice) => choice.text === 'Die Antriebsbatterie');
    expect(battery?.checked).toBe(1);
  });
});

describe('validateSaleContract', () => {
  it('accepts an empty form – everything can be filled in by hand', () => {
    expect(validateSaleContract(EMPTY_SALE_CONTRACT)).toEqual({});
  });

  it('accepts a filled form', () => {
    expect(validateSaleContract(filled)).toEqual({});
  });

  it.each([
    [{ price: '12,5' }, 'price'],
    [{ price: '0' }, 'price'],
    [{ price: '10000000' }, 'price'],
    [{ price: '1000', deposit: '1000' }, 'deposit'],
    [{ vin: 'WAUZZZ8K9BA12345O' }, 'vin'],
    [{ vin: 'WAU-ZZZ' }, 'vin'],
    [{ huUntil: '13/2027' }, 'huUntil'],
    [{ handoverDate: '2026-02-30' }, 'handoverDate'],
    [{ handoverTime: '25:00' }, 'handoverTime'],
    [
      { registration: 'registered', handoverDate: '2026-10-20', reRegisterBy: '2026-10-19' },
      'reRegisterBy',
    ],
    [{ odometerKm: 'viel' }, 'odometerKm'],
    [{ totalMileage: 'differs', totalMileageKm: 'x' }, 'totalMileageKm'],
    [{ odometerKm: '154.3' }, 'odometerKm'],
    [{ price: '1.2.3' }, 'price'],
    [{ huUntil: '09/1900' }, 'huUntil'],
    [{ knownDefects: 'x\n'.repeat(21) }, 'knownDefects'],
    [{ knownDefects: 'x'.repeat(1501) }, 'knownDefects'],
  ] as [Partial<SaleContractValues>, string][])('rejects %o', (change, key) => {
    expect(Object.keys(validateSaleContract({ ...EMPTY_SALE_CONTRACT, ...change }))).toContain(key);
  });

  it('ignores fields hidden by an answer', () => {
    expect(
      validateSaleContract({
        ...EMPTY_SALE_CONTRACT,
        answers: { ...EMPTY_SALE_CONTRACT.answers, imported: 'unknown' },
        details: { ...EMPTY_SALE_CONTRACT.details, imported: 'x'.repeat(400) },
        registration: 'deregistered',
        reRegisterBy: '2020-13-45',
      }),
    ).toEqual({});
  });

  it('rejects a birth date in the future', () => {
    const errors = validateSaleContract(
      {
        ...EMPTY_SALE_CONTRACT,
        seller: { ...EMPTY_SALE_CONTRACT.seller, birthDate: '2027-01-01' },
      },
      new Date(2026, 9, 15),
    );
    expect(Object.keys(errors)).toEqual(['seller.birthDate']);
  });

  it('allows line breaks in longer texts', () => {
    expect(validateSaleContract({ ...EMPTY_SALE_CONTRACT, knownDefects: 'Rost\nDelle' })).toEqual(
      {},
    );
  });

  it('checks the parties', () => {
    const errors = validateSaleContract({
      ...EMPTY_SALE_CONTRACT,
      buyer: { ...EMPTY_SALE_CONTRACT.buyer, birthDate: '1990-13-01', name: 'x'.repeat(101) },
    });
    expect(Object.keys(errors).sort()).toEqual(['buyer.birthDate', 'buyer.name']);
  });
});

describe('cleanLine and cleanText', () => {
  it('turn pasted tabs and separators into spaces or line breaks and drop invisible characters', () => {
    expect(cleanLine(' Musterstraße\t1\u2028 ')).toBe('Musterstraße 1');
    expect(cleanLine('Ende\u00adweich\u0007')).toBe('Endeweich');
    expect(cleanText('Rost\u2028Delle\r\n\n\n\nKratzer\t links')).toBe(
      'Rost\nDelle\n\nKratzer links',
    );
  });

  it('are applied to the printed contract', () => {
    const blocks = saleContractBlocks({
      ...EMPTY_SALE_CONTRACT,
      seller: { ...EMPTY_SALE_CONTRACT.seller, name: 'Łukasz\tŻółć' },
    });
    const parties = blocks.find((block) => block.kind === 'parties');
    expect(parties?.kind === 'parties' && parties.rows[0]?.seller).toBe('Łukasz Żółć');
  });
});

describe('parseWholeNumber', () => {
  it.each([
    ['12500', 12500],
    ['12.500', 12500],
    ['12 500', 12500],
    ['12.500,-', 12500],
    [' 7 ', 7],
    ['12,50', null],
    ['12.50', null],
    ['1.2.3', null],
    ['1.234.567', 1234567],
    ['12\u00a0500', 12500],
    ['-5', null],
    ['', null],
  ])('%s → %s', (value, expected) => {
    expect(parseWholeNumber(value)).toBe(expected);
  });
});

describe('power', () => {
  it('prints kW and PS, or the one given', () => {
    const power = (powerKw: string, powerPs: string) =>
      field(saleContractBlocks({ ...filled, powerKw, powerPs }), 'Leistung');
    expect(power('110', '150')).toBe('110 kW (150 PS)');
    expect(power('110', '')).toBe('110 kW');
    expect(power('', '150')).toBe('150 PS');
    expect(power('', '')).toBe('');
  });

  it('rejects kW and PS that do not agree', () => {
    const errors = (powerKw: string, powerPs: string) =>
      validateSaleContract({ ...filled, powerKw, powerPs }, new Date(2026, 9, 15));
    expect(errors('110', '150')).toEqual({});
    expect(errors('110', '149')).toEqual({});
    expect(Object.keys(errors('110', '148'))).toEqual(['powerPs']);
    expect(Object.keys(errors('110', 'viel'))).toEqual(['powerPs']);
    expect(Object.keys(errors('2001', '150'))).toEqual(['powerKw']);
  });
});
