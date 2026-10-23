import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  aggregateEngines,
  consumptionPerCo2,
  engineFuel,
  type RawEngineRow,
} from './engine-aggregate';
import { engineMakeId, engineModelId, extraModel, oneEditApart } from './engine-match';
import {
  engineCo2,
  engineConsumption,
  EngineFileSchema,
  EngineIndexSchema,
  engineLabel,
  engineTaxDrive,
} from './engines';
import { makeById } from './makes';
import { modelById } from './models';

const row = (values: Partial<RawEngineRow>): RawEngineRow => ({
  mk: 'VOLKSWAGEN, VW',
  cn: 'GOLF',
  ft: 'PETROL',
  fm: 'M',
  ccm: 1498,
  kw: 110,
  y: 2021,
  w: 130,
  e: null,
  n: 10,
  fc: 5.7,
  z: null,
  ...values,
});

describe('EEA names', () => {
  it('finds the make in its many spellings', () => {
    for (const mk of ['VOLKSWAGEN', 'VOLKSWAGEN, VW', 'VOLKSWAGEN  VW', 'OLKSWAGEN VW'])
      expect(engineMakeId(mk)).toBe('vw');
    expect(engineMakeId('MERCEDES-AMG')).toBe('mercedes');
    expect(engineMakeId('HYUNDAI, GENESIS')).toBeNull();
    expect(engineMakeId(null)).toBeNull();
  });

  it('maps commercial names to catalog models', () => {
    expect(engineModelId('vw', 'GOLF VARIANT')).toBe('vw-golf');
    expect(engineModelId('vw', 'GOLFPLUS')).toBe('vw-golf');
    expect(engineModelId('mazda', 'MAZDA CX-30')).toBe('mazda-cx-30');
    expect(engineModelId('mazda', 'MAZDA CX-3')).toBe('mazda-cx-3');
    expect(engineModelId('hyundai', 'I 30')).toBe('hyundai-i30');
    expect(engineModelId('hyundai', 'KONA, KAUAI')).toBe('hyundai-kona');
    expect(engineModelId('audi', 'AUDIA4')).toBe('audi-a4');
    expect(engineModelId('audi', 'A4AVANT')).toBe('audi-a4');
    expect(engineModelId('bmw', '320D XDRIVE')).toBe('bmw-3er');
    expect(engineModelId('bmw', 'M440i xDrive')).toBe('bmw-4er');
    expect(engineModelId('bmw', 'X1 xDrive25e')).toBe('bmw-x1');
    expect(engineModelId('mercedes', 'C 220 D')).toBe('mercedes-c-klasse');
    expect(engineModelId('mercedes', 'GLC 300 DE 4MATIC')).toBe('mercedes-glc');
    expect(engineModelId('mercedes', 'CLA 250 E')).toBe('mercedes-cla');
    expect(engineModelId('mini', 'MINI')).toBe('mini-cooper');
  });

  it('does not take a different model for a longer name', () => {
    expect(engineModelId('fiat', 'FIAT 500L')).toBeNull();
    expect(engineModelId('fiat', 'FIAT 500X')).toBe('fiat-500x');
    // Active Tourer and Gran Tourer are no 2er Coupé.
    expect(engineModelId('bmw', '218I ACTIVE TOURER')).toBeNull();
  });

  it('makes models of their own from names outside the catalog', () => {
    expect(extraModel('toyota', 'TOYOTA AVENSIS')).toEqual({
      key: 'avensis',
      name: 'Avensis',
      makeId: 'toyota',
    });
    expect(extraModel('toyota', 'TOYOTAAVENSIS')).toMatchObject({ key: 'avensis' });
    expect(extraModel('audi', 'RS 3 SPORTBACK')).toEqual({ modelId: 'audi-a3' });
    expect(extraModel('audi', 'SQ5 TDI')).toEqual({ modelId: 'audi-q5' });
    expect(extraModel('citroen', 'DS3')).toMatchObject({ makeId: 'ds' });
    expect(extraModel('vw', 'KOMBI')).toBeNull();
    expect(extraModel('bmw', 'X REIHE')).toBeNull();
    expect(oneEditApart('ibia', 'ibiza')).toBe(true);
    expect(oneEditApart('ibia', 'ibizaa')).toBe(false);
  });
});

describe('aggregating the EEA rows', () => {
  it('takes the median CO₂ value and the mean consumption per engine and year', () => {
    const [engine, ...rest] = aggregateEngines([
      row({ w: 120, n: 6, fc: 5.2 }),
      row({ w: 130, n: 3, fc: 5.8 }),
      row({ w: 150, n: 2, fc: 6.4 }),
    ]);
    expect(rest).toEqual([]);
    expect(engine).toMatchObject({
      year: 2021,
      fuel: 'petrol',
      ccm: 1498,
      kw: 110,
      registrations: 11,
      co2Wltp: 120,
      consumption: 5.6,
    });
  });

  it('leaves out engines with few registrations and without power or displacement', () => {
    expect(aggregateEngines([row({ n: 9 })])).toEqual([]);
    expect(aggregateEngines([row({ kw: null })])).toEqual([]);
    expect(aggregateEngines([row({ ccm: null })])).toEqual([]);
    expect(aggregateEngines([row({ ft: 'ELECTRIC', ccm: null, w: 0, fc: null, z: 160 })])).toEqual([
      expect.objectContaining({ fuel: 'electric', ccm: null, co2Wltp: null, electricity: 16 }),
    ]);
  });

  it('tells hybrids and plug-in hybrids apart', () => {
    expect(engineFuel({ ft: 'PETROL/ELECTRIC', fm: 'P', w: 30, e: null })).toBe('plugin_hybrid');
    expect(engineFuel({ ft: 'PETROL', fm: 'H', w: 100, e: null })).toBe('hybrid');
    expect(engineFuel({ ft: 'DIESEL/ELECTRIC', fm: 'M', w: null, e: 48 })).toBe(
      'plugin_hybrid_diesel',
    );
    expect(engineFuel({ ft: 'PETROL-ELECTRIC', fm: 'M', w: null, e: 92 })).toBe('hybrid');
    expect(engineFuel({ ft: 'NG-BIOMETHANE', fm: 'B', w: null, e: 99 })).toBe('cng');
    expect(engineFuel({ ft: 'UNKNOWN', fm: '', w: null, e: null })).toBeNull();
  });

  it('works out litres per g/km of CO₂ for petrol and diesel only', () => {
    const ratio = consumptionPerCo2([
      row({ w: 100, fc: 4.4, n: 1 }),
      row({ ft: 'DIESEL', w: 100, fc: 3.8, n: 1 }),
      row({ ft: 'LPG', fm: 'B', w: 100, fc: 6, n: 1 }),
    ]);
    expect(ratio).toEqual({ diesel: 0.038, petrol: 0.044 });
  });
});

describe('using an engine', () => {
  const engine = EngineFileSchema.shape.engines.element.parse({
    year: 2018,
    fuel: 'diesel',
    ccm: 1968,
    kw: 110,
    registrations: 100,
    co2Wltp: 140,
    co2Nedc: 115,
    consumption: null,
    electricity: null,
  });

  it('takes the CO₂ value of the test the tax counts', () => {
    expect(engineCo2(engine, '2018-08-31')).toBe(115);
    expect(engineCo2(engine, '2018-09-01')).toBe(140);
    expect(engineCo2({ ...engine, co2Nedc: null }, '2017-01-01')).toBe(140);
  });

  it('estimates the consumption from the CO₂ value when none is reported', () => {
    const index = { consumptionPerCo2: { petrol: 0.044, diesel: 0.038 } };
    expect(engineConsumption(engine, index)).toEqual({ litres: 5.3, estimated: true });
    expect(engineConsumption({ ...engine, consumption: 4.9 }, index)).toEqual({
      litres: 4.9,
      estimated: false,
    });
    expect(engineConsumption({ ...engine, fuel: 'plugin_hybrid' }, index)).toBeNull();
  });

  it('names the engine and its tax drive', () => {
    expect(engineLabel(engine)).toBe('2,0 l Diesel, 110 kW (150 PS)');
    expect(engineLabel({ fuel: 'electric', ccm: null, kw: 150 })).toBe('Elektro, 150 kW (204 PS)');
    expect(engineTaxDrive('hybrid_diesel')).toBe('diesel');
    expect(engineTaxDrive('lpg')).toBe('petrol');
    expect(engineTaxDrive('hydrogen')).toBe('electric');
  });
});

describe('data/engines', () => {
  const dir = new URL('../data/engines/', import.meta.url);
  const files = readdirSync(dir).filter((file) => file.endsWith('.json'));
  const index = EngineIndexSchema.parse(
    JSON.parse(readFileSync(new URL('../data/engine-index.json', import.meta.url), 'utf8')),
  );

  it('has a valid file for every model of the index, and the index names them all', () => {
    const indexed = Object.values(index.makes).flatMap((models) => models.map((model) => model.id));
    expect(indexed.toSorted()).toEqual(files.map((file) => file.slice(0, -5)).toSorted());
    for (const file of files)
      EngineFileSchema.parse(JSON.parse(readFileSync(new URL(file, dir), 'utf8')));
  });

  it('uses KaufCheck makes, and catalog names for catalog models', () => {
    for (const [makeId, models] of Object.entries(index.makes)) {
      expect(makeById(makeId), makeId).not.toBeNull();
      for (const model of models) {
        const entry = modelById(model.id);
        if (entry) expect(model.name).toBe(entry.model);
        expect(model.id.startsWith(`${makeId}-`) || entry?.makeId === makeId).toBe(true);
      }
    }
  });
});
