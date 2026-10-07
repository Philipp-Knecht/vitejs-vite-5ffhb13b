import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  buildPlatformLinks,
  CarModelSchema,
  EMPTY_SEARCH,
  findModel,
  MAKES,
  makeById,
  modelById,
  MODELS,
  parseSearchParams,
  toSearchParams,
  type SearchQuery,
} from './index';

const isModelId = (id: string) => modelById(id) !== null;
const NOW = new Date('2026-10-06T12:00:00Z');

describe('makes and models', () => {
  it('have unique ids and models belong to a known make', () => {
    expect(new Set(MAKES.map((make) => make.id)).size).toBe(MAKES.length);
    expect(new Set(MODELS.map((model) => model.id)).size).toBe(MODELS.length);
    for (const model of MODELS) {
      expect(makeById(model.makeId), model.id).not.toBeNull();
      expect(model.id.startsWith(`${model.makeId}-`), model.id).toBe(true);
      expect(model.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });

  it('finds a model from typed text or an alias', () => {
    expect(findModel('vw', 'golf')?.id).toBe('vw-golf');
    expect(findModel('vw', 'Golf Variant')?.id).toBe('vw-golf');
    expect(findModel('mercedes', 'C-Klasse')?.id).toBe('mercedes-c-klasse');
    expect(findModel('skoda', 'Octavia Combi')?.id).toBe('skoda-octavia');
    expect(findModel('vw', 'Phaeton')).toBeNull();
  });
});

describe('search parameters', () => {
  it('reads a search and writes the same parameters back', () => {
    const params = new URLSearchParams(
      'marke=vw&modell=vw-golf&preis_bis=15000&ez_ab=2016&km_bis=120000&kraftstoff=diesel&getriebe=schaltgetriebe&karosserie=kombi&plz=79098&umkreis=50',
    );
    const query = parseSearchParams(params, isModelId, NOW);
    expect(query).toEqual({
      ...EMPTY_SEARCH,
      makeId: 'vw',
      modelId: 'vw-golf',
      priceMax: 15000,
      yearMin: 2016,
      kmMax: 120000,
      fuel: 'diesel',
      transmission: 'manual',
      body: 'kombi',
      zip: '79098',
      radiusKm: 50,
    });
    expect(toSearchParams(query).toString()).toBe(params.toString());
  });

  it('drops invalid values and keeps free model text clean', () => {
    const query = parseSearchParams(
      new URLSearchParams(
        'marke=VW%20<b>&modell=<script>Phaeton</script>&preis_bis=-5&ez_ab=1800&km_bis=abc&kraftstoff=kerosin&plz=1234&umkreis=70',
      ),
      isModelId,
      NOW,
    );
    expect(query.makeId).toBeNull();
    expect(query.modelId).toBeNull();
    expect(query.modelText).toBe('script Phaeton script');
    expect(query.priceMax).toBeNull();
    expect(query.yearMin).toBeNull();
    expect(query.kmMax).toBeNull();
    expect(query.fuel).toBeNull();
    expect(query.zip).toBeNull();
    expect(query.radiusKm).toBe(100);
  });

  it('swaps reversed ranges', () => {
    const query = parseSearchParams(
      new URLSearchParams('preis_ab=20000&preis_bis=5000&ez_ab=2020&ez_bis=2012'),
      isModelId,
      NOW,
    );
    expect([query.priceMin, query.priceMax, query.yearMin, query.yearMax]).toEqual([
      5000, 20000, 2012, 2020,
    ]);
  });
});

describe('platform links', () => {
  const golf: SearchQuery = {
    ...EMPTY_SEARCH,
    makeId: 'vw',
    modelId: 'vw-golf',
    priceMax: 15000,
    yearMin: 2016,
    kmMax: 120000,
    fuel: 'diesel',
    transmission: 'manual',
    zip: '79098',
    radiusKm: 50,
  };
  const links = buildPlatformLinks(golf, {
    make: makeById('vw'),
    model: modelById('vw-golf'),
    modelText: null,
  });
  const link = (platform: string) => {
    const found = links.find((item) => item.platform === platform);
    if (!found) throw new Error(`no link for ${platform}`);
    return found;
  };

  it('passes make, model and filters to mobile.de', () => {
    const url = new URL(link('mobile_de').url);
    expect(url.host).toBe('suchen.mobile.de');
    expect(url.searchParams.get('ms')).toBe('25200;;;Golf');
    expect(url.searchParams.get('p')).toBe(':15000');
    expect(url.searchParams.get('fr')).toBe('2016:');
    expect(url.searchParams.get('ml')).toBe(':120000');
    expect(url.searchParams.get('ft')).toBe('DIESEL');
    expect(url.searchParams.get('tr')).toBe('MANUAL_GEAR');
    expect(url.searchParams.get('zip')).toBe('79098');
    expect(link('mobile_de').applied).toEqual([
      'make',
      'model',
      'price',
      'year',
      'km',
      'fuel',
      'transmission',
      'location',
    ]);
  });

  it('builds AutoScout24, Kleinanzeigen, eBay and Facebook searches', () => {
    expect(link('autoscout24').url).toBe(
      'https://www.autoscout24.de/lst/volkswagen/golf?atype=C&cy=D&damaged_listing=exclude&priceto=15000&fregfrom=2016&kmto=120000&fuel=D&gear=M&zip=79098&zipr=50&sort=standard&desc=0',
    );
    expect(link('kleinanzeigen').url).toBe(
      'https://www.kleinanzeigen.de/s-autos/volkswagen/preis::15000/golf/k0c216+autos.marke_s:volkswagen+autos.ez_i:2016,+autos.km_i:,120000+autos.shift_s:manuell+autos.fuel_s:diesel',
    );
    expect(link('ebay').url).toBe(
      'https://www.ebay.de/sch/9801/i.html?_nkw=VW+Golf&_udhi=15000&_stpos=79098&_sadis=50',
    );
    expect(link('facebook').url).toBe(
      'https://www.facebook.com/marketplace/category/vehicles?query=VW+Golf&maxPrice=15000&minYear=2016&maxMileage=120000',
    );
  });

  it('falls back to the platforms’ model pages where codes are unknown', () => {
    const [mobile] = buildPlatformLinks(
      { ...EMPTY_SEARCH, makeId: 'skoda', modelId: 'skoda-octavia', priceMax: 9000 },
      { make: makeById('skoda'), model: modelById('skoda-octavia'), modelText: null },
    );
    expect(mobile?.url).toBe('https://suchen.mobile.de/auto/skoda-octavia.html');
    expect(mobile?.applied).toEqual(['make', 'model']);
  });

  it('keeps every link on the platform’s own host', () => {
    const hostile = buildPlatformLinks(
      { ...EMPTY_SEARCH, modelText: '../../evil.example/?x=1#' },
      { make: null, model: null, modelText: 'evil.example/x' },
    );
    for (const item of [...links, ...hostile]) {
      const url = new URL(item.url);
      expect(url.protocol).toBe('https:');
      expect(url.host).toMatch(
        /^(?:suchen\.mobile\.de|www\.autoscout24\.de|www\.kleinanzeigen\.de|www\.ebay\.de|www\.autohero\.com|suche\.pkw\.de|www\.facebook\.com)$/,
      );
    }
  });
});

describe('model knowledge files', () => {
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../data/models');
  const files = readdirSync(dir).filter((file) => file.endsWith('.json'));

  it('are valid, sourced and belong to catalog models', () => {
    for (const file of files) {
      const model = CarModelSchema.parse(JSON.parse(readFileSync(path.join(dir, file), 'utf8')));
      expect(`${model.id}.json`).toBe(file);
      expect(modelById(model.id), model.id).not.toBeNull();
      if (model.twinOf) expect(modelById(model.twinOf), model.twinOf).not.toBeNull();
      for (const generation of model.generations) {
        expect(generation.id.startsWith(`${model.id}-`), generation.id).toBe(true);
        const [from, to] = generation.years;
        if (to !== null) expect(to, generation.id).toBeGreaterThanOrEqual(from);
        for (const issue of generation.issues) expect(issue.sources.length).toBeGreaterThan(0);
      }
    }
  });
});
