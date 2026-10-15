import { describe, expect, it } from 'vitest';
import {
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
    expect(field(blocks, 'Tachostand bei Übergabe (abgelesen)')).toBe('');
    // No battery question for a car without an electric drive.
    expect(text(blocks)).not.toContain('Antriebsbatterie');
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
    expect(field(blocks, 'Tachostand bei Übergabe (abgelesen)')).toBe('154.300 km');
    expect(text(blocks)).toContain('Eine Anzahlung von 500 Euro');
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
    [{ make: 'Audi\u0007' }, 'make'],
    [{ model: 'A4\nAvant' }, 'model'],
    [{ knownDefects: 'x'.repeat(1501) }, 'knownDefects'],
  ] as [Partial<SaleContractValues>, string][])('rejects %o', (change, key) => {
    expect(Object.keys(validateSaleContract({ ...EMPTY_SALE_CONTRACT, ...change }))).toContain(key);
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

describe('parseWholeNumber', () => {
  it.each([
    ['12500', 12500],
    ['12.500', 12500],
    ['12 500', 12500],
    ['12.500,-', 12500],
    [' 7 ', 7],
    ['12,50', null],
    ['-5', null],
    ['', null],
  ])('%s → %s', (value, expected) => {
    expect(parseWholeNumber(value)).toBe(expected);
  });
});
