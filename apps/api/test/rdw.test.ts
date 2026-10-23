import { RdwLookupResponseSchema } from '@kaufcheck/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { RdwFetch } from '../src/application/rdw-service';
import { createTestApp, TestClient } from './helpers';

type BuiltApp = Awaited<ReturnType<typeof createTestApp>>;

/** Answers in the format of RDW Open Data (strings, dates as YYYYMMDD); not real data. */
const ROWS: Record<string, Record<string, string>[]> = {
  'm9d7-ebf2': [
    {
      kenteken: 'AB123C',
      voertuigsoort: 'Personenauto',
      merk: 'VOLKSWAGEN',
      handelsbenaming: 'GOLF',
      datum_eerste_toelating: '20140301',
      datum_eerste_tenaamstelling_in_nederland: '20170610',
      datum_tenaamstelling: '20200711',
      vervaldatum_apk: '20270302',
      export_indicator: 'Ja',
      taxi_indicator: 'Nee',
      wam_verzekerd: 'Nee',
      catalogusprijs: '32816',
      eerste_kleur: 'GRIJS',
      tellerstandoordeel: 'Onlogisch',
      code_toelichting_tellerstandoordeel: '04',
      jaar_laatste_registratie_tellerstand: '2024',
    },
  ],
  '8ys7-d773': [
    { kenteken: 'AB123C', brandstof_omschrijving: 'Diesel', nettomaximumvermogen: '81.00' },
    {
      kenteken: 'AB123C',
      brandstof_omschrijving: 'Elektriciteit',
      netto_max_vermogen_elektrisch: '40.00',
    },
  ],
  't49b-isb7': [
    { kenteken: 'AB123C', referentiecode_rdw: 'RA2019-001', code_status: 'O' },
    { kenteken: 'AB123C', referentiecode_rdw: 'RA2017-123', code_status: 'P' },
  ],
  'a34c-vvps': [
    {
      kenteken: 'AB123C',
      meld_datum_door_keuringsinstantie: '20230301',
      gebrek_identificatie: '205',
      aantal_gebreken_geconstateerd: '2',
    },
    {
      kenteken: 'AB123C',
      meld_datum_door_keuringsinstantie: '20230301',
      gebrek_identificatie: 'AC1',
      aantal_gebreken_geconstateerd: '1',
    },
    {
      kenteken: 'AB123C',
      meld_datum_door_keuringsinstantie: '20250305',
      gebrek_identificatie: '205',
      aantal_gebreken_geconstateerd: '1',
    },
  ],
  'hx2c-gt7k': [
    {
      gebrek_identificatie: '205',
      ingangsdatum_gebrek: '20120101',
      gebrek_omschrijving: 'oude omschrijving',
    },
    {
      gebrek_identificatie: '205',
      ingangsdatum_gebrek: '20200101',
      gebrek_omschrijving: 'Band profiel',
    },
  ],
};

describe('RDW lookup', () => {
  let built: BuiltApp;
  const calls: { dataset: string; query: Record<string, string> }[] = [];
  let failing = false;

  const rdwFetch: RdwFetch = (dataset, query) => {
    calls.push({ dataset, query });
    if (failing) return Promise.reject(new Error('timeout'));
    const plate = query.kenteken ?? /kenteken='(\w+)'/.exec(query.$where ?? '')?.[1];
    if (plate && plate !== 'AB123C') return Promise.resolve([]);
    return Promise.resolve(ROWS[dataset] ?? []);
  };

  beforeAll(async () => {
    built = await createTestApp({}, { rdwFetch });
  });
  afterAll(() => built.app.close());

  it('turns the RDW rows into a vehicle with its verdict, recalls and defects', async () => {
    const client = new TestClient(built.app);
    const response = await client.post('/api/rdw', { plate: 'ab-123-c' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('private, no-store');
    const { vehicle } = RdwLookupResponseSchema.parse(response.json());
    expect(vehicle).toMatchObject({
      plate: 'AB123C',
      make: 'VOLKSWAGEN',
      firstAdmission: '2014-03-01',
      firstRegistrationNl: '2017-06-10',
      exported: true,
      taxi: false,
      insured: false,
      listPriceEur: 32816,
      odometer: { verdict: 'illogical', code: '04', lastReadingYear: 2024 },
      recalls: [
        { reference: 'RA2019-001', open: true },
        { reference: 'RA2017-123', open: false },
      ],
      fuels: [
        { fuel: 'Diesel', kw: 81 },
        { fuel: 'Elektriciteit', kw: 40 },
      ],
    });
    // The newest inspection first, the newest description of a defect, the code where there is none.
    expect(vehicle?.inspections).toEqual([
      {
        date: '2025-03-05',
        defects: [{ code: '205', count: 1, description: 'Band profiel', advisory: false }],
      },
      {
        date: '2023-03-01',
        defects: [
          { code: '205', count: 2, description: 'Band profiel', advisory: false },
          { code: 'AC1', count: 1, description: null, advisory: true },
        ],
      },
    ]);
    const defects = calls.find((call) => call.dataset === 'hx2c-gt7k');
    expect(defects?.query.$where).toBe("gebrek_identificatie in ('205','AC1')");
    // Only the APK, not gas systems or tachographs.
    const inspections = calls.find((call) => call.dataset === 'a34c-vvps');
    expect(inspections?.query.$where).toBe(
      "kenteken='AB123C' AND soort_erkenning_keuringsinstantie in ('AL','AZ')",
    );
    expect(calls.find((call) => call.dataset === '8ys7-d773')?.query.$order).toBe(
      'brandstof_volgnummer',
    );
  });

  it('answers „no vehicle“ for an unknown plate and asks the RDW once per hour', async () => {
    const client = new TestClient(built.app);
    calls.length = 0;
    const first = RdwLookupResponseSchema.parse(
      (await client.post('/api/rdw', { plate: 'XX99XX' })).json(),
    );
    expect(first.vehicle).toBeNull();
    const asked = calls.length;
    await client.post('/api/rdw', { plate: 'xx-99-xx' });
    expect(calls.length).toBe(asked);
  });

  it('rejects what is no Dutch plate, and reports an unreachable RDW', async () => {
    const client = new TestClient(built.app);
    for (const plate of ['ABCDEF', "AB'1;3", 'AB123CD', 'x'.repeat(21)])
      expect((await client.post('/api/rdw', { plate })).statusCode).toBe(400);
    expect((await client.post('/api/rdw', { plate: 42 })).statusCode).toBe(400);
    failing = true;
    const response = await client.post('/api/rdw', { plate: 'ZZ11ZZ' });
    failing = false;
    expect(response.statusCode).toBe(503);
    expect(response.json<{ error: { message: string } }>().error.message).toContain('RDW');
  });

  it('asks the RDW once for the same plate at the same time', async () => {
    const client = new TestClient(built.app);
    calls.length = 0;
    await Promise.all([
      client.post('/api/rdw', { plate: 'YY11YY' }),
      client.post('/api/rdw', { plate: 'YY-11-YY' }),
    ]);
    expect(calls.filter((call) => call.dataset === 'm9d7-ebf2')).toHaveLength(1);
  });
});

describe('RDW lookup switched off', () => {
  let built: BuiltApp;
  beforeAll(async () => {
    built = await createTestApp({ RDW_LOOKUP_MODE: 'off' });
  });
  afterAll(() => built.app.close());

  it('says so', async () => {
    const response = await new TestClient(built.app).post('/api/rdw', { plate: 'QQ999Q' });
    expect(response.statusCode).toBe(503);
    expect(response.json<{ error: { message: string } }>().error.message).toBe(
      'Die Abfrage bei der RDW ist zurzeit abgeschaltet.',
    );
  });
});

describe('RDW lookup with fixtures', () => {
  let built: BuiltApp;
  beforeAll(async () => {
    built = await createTestApp({ RDW_LOOKUP_MODE: 'fixtures' });
  });
  afterAll(() => built.app.close());

  it('answers from the synthetic files', async () => {
    const client = new TestClient(built.app);
    const known = RdwLookupResponseSchema.parse(
      (await client.post('/api/rdw', { plate: 'QQ999Q' })).json(),
    );
    expect(known.vehicle?.odometer.verdict).toBe('logical');
    const unknown = RdwLookupResponseSchema.parse(
      (await client.post('/api/rdw', { plate: 'QQ777Q' })).json(),
    );
    expect(unknown.vehicle).toBeNull();
  });
});

describe('RDW lookup limit for the server', () => {
  let built: BuiltApp;
  beforeAll(async () => {
    built = await createTestApp(
      { RDW_LOOKUPS_PER_MINUTE: '1' },
      { rdwFetch: () => Promise.resolve([]) },
    );
  });
  afterAll(() => built.app.close());

  it('answers 429 beyond it, and the cache still answers', async () => {
    const client = new TestClient(built.app);
    expect((await client.post('/api/rdw', { plate: 'AB123C' })).statusCode).toBe(200);
    expect((await client.post('/api/rdw', { plate: 'AB124C' })).statusCode).toBe(429);
    expect((await client.post('/api/rdw', { plate: 'AB123C' })).statusCode).toBe(200);
  });
});
