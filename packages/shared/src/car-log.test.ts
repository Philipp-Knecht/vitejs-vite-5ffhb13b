import { describe, expect, it } from 'vitest';
import {
  carLogCsv,
  carLogSummary,
  parseEuroCents,
  parseQuantity,
  yearBefore,
  type CarLogCsvEntry,
  type CarLogEntryLike,
} from './car-log';

const entry = (overrides: Partial<CarLogEntryLike>): CarLogEntryLike => ({
  date: '2026-05-01',
  kind: 'other',
  odometerKm: null,
  amountCents: null,
  quantity: null,
  fullTank: false,
  ...overrides,
});

describe('amounts', () => {
  it('reads euros as typed in Germany', () => {
    expect(parseEuroCents('72,45')).toBe(7245);
    expect(parseEuroCents('1.234,5')).toBe(123450);
    expect(parseEuroCents('1234')).toBe(123400);
    expect(parseEuroCents('72.45')).toBe(7245);
    expect(parseEuroCents('1.234')).toBe(123400);
    expect(parseEuroCents(' 89 € ')).toBe(8900);
    expect(parseEuroCents('0')).toBe(0);
    for (const bad of ['', '12,345', '-5', 'zwölf', '1,2,3', '12.3.4'])
      expect(parseEuroCents(bad)).toBeNull();
  });

  it('reads quantities with two decimals at most', () => {
    expect(parseQuantity('41,4')).toBe(41.4);
    expect(parseQuantity('41.45')).toBe(41.45);
    expect(parseQuantity('0')).toBeNull();
    expect(parseQuantity('41,456')).toBeNull();
  });
});

describe('summary', () => {
  it('sums the last twelve months by kind', () => {
    const summary = carLogSummary(
      [
        entry({ date: '2025-10-15', kind: 'tax', amountCents: 10_000 }),
        entry({ date: '2025-10-16', kind: 'tax', amountCents: 12_000 }),
        entry({ date: '2026-03-01', kind: 'fuel', amountCents: 7_000, odometerKm: 90_000 }),
        entry({ date: '2026-09-01', kind: 'service', amountCents: 30_000, odometerKm: 96_000 }),
        // Not yet: entered for a future day, it does not count.
        entry({ date: '2026-10-16', kind: 'repair', amountCents: 99_999 }),
      ],
      '2026-10-15',
    );
    expect(summary.byKind).toEqual([
      { kind: 'service', cents: 30_000 },
      { kind: 'tax', cents: 12_000 },
      { kind: 'fuel', cents: 7_000 },
    ]);
    expect(summary.yearCents).toBe(49_000);
    expect(summary.months).toBe(12);
    expect(summary.yearKm).toBe(6_000);
  });

  it('counts fewer months for a young book and needs two readings for the distance', () => {
    const summary = carLogSummary(
      [entry({ date: '2026-08-20', kind: 'fuel', amountCents: 5_000, odometerKm: 1_000 })],
      '2026-10-15',
    );
    expect(summary.months).toBe(2);
    expect(summary.yearKm).toBeNull();
    expect(carLogSummary([], '2026-10-15')).toMatchObject({ months: 0, yearCents: 0 });
  });

  it('calculates the consumption between full fill-ups only', () => {
    const fills = [
      entry({ date: '2026-01-01', kind: 'fuel', quantity: 40, fullTank: true, odometerKm: 10_000 }),
      // A partial fill-up in between counts towards the next full one.
      entry({ date: '2026-01-10', kind: 'fuel', quantity: 10, fullTank: false, odometerKm: null }),
      entry({ date: '2026-01-20', kind: 'fuel', quantity: 30, fullTank: true, odometerKm: 10_700 }),
      // Without a reading the interval ends without a result …
      entry({ date: '2026-02-01', kind: 'fuel', quantity: 35, fullTank: true, odometerKm: null }),
      // … and the next one starts again.
      entry({ date: '2026-02-10', kind: 'fuel', quantity: 33, fullTank: true, odometerKm: 11_300 }),
      entry({ date: '2026-02-20', kind: 'fuel', quantity: 36, fullTank: true, odometerKm: 11_900 }),
    ];
    const summary = carLogSummary(fills, '2026-10-15');
    // (10 + 30 + 36) l over (700 + 600) km.
    expect(summary.fuelPer100Km).toBe(5.8);
    expect(summary.fuelIntervals).toBe(2);
    expect(carLogSummary(fills.slice(0, 1), '2026-10-15').fuelPer100Km).toBeNull();
  });

  it('starts the window a year back, also from 29 February', () => {
    expect(yearBefore('2026-10-15')).toBe('2025-10-15');
    expect(yearBefore('2028-02-29')).toBe('2027-03-01');
  });
});

describe('CSV export', () => {
  it('writes German numbers and defuses formulas', () => {
    const rows: CarLogCsvEntry[] = [
      {
        ...entry({ date: '2026-05-12', kind: 'service', amountCents: 34_950, odometerKm: 95_000 }),
        workshop: 'Autohaus Muster; Köln',
        note: '=HYPERLINK("x")\nÖl',
        invoice: true,
      },
      {
        ...entry({ date: '2026-01-02', kind: 'fuel', quantity: 41.4, fullTank: true }),
        workshop: null,
        note: null,
        invoice: false,
      },
    ];
    const lines = carLogCsv(rows).replace(/^\ufeff/, '').split('\r\n');
    expect(lines[0]).toBe(
      'Datum;Art;Kilometerstand;Betrag in Euro;Menge;Einheit;Vollgetankt;Werkstatt;Notiz;Rechnung vorhanden',
    );
    expect(lines[1]).toBe('2026-01-02;Tanken;;;41,4;l;ja;;;nein');
    expect(lines[2]).toContain('"Autohaus Muster; Köln"');
    expect(lines[2]).toContain(`"'=HYPERLINK(""x"")`);
    expect(lines[2]).toContain('349,5');
  });
});
