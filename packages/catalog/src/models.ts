import type { Segment } from './types';

/**
 * The models offered in the search form. Models with researched knowledge
 * (generations, weaknesses, sources) have a data file in data/models; the
 * others are suggestions only.
 */
export interface ModelEntry {
  /** "<make id>-<model slug>"; also the address of the model page. */
  id: string;
  makeId: string;
  model: string;
  segment: Segment;
  /** Further spellings in listings and searches (lower case). */
  aliases?: readonly string[];
  /** AutoScout24 model slug where it differs from the model name. */
  autoscout24?: string;
}

type Row = readonly [id: string, model: string, segment: Segment, aliases?: readonly string[]];

const BY_MAKE: Record<string, readonly Row[]> = {
  vw: [
    ['vw-up', 'up!', 'kleinstwagen', ['up', 'e-up']],
    ['vw-polo', 'Polo', 'kleinwagen', ['polo gti']],
    [
      'vw-golf',
      'Golf',
      'kompakt',
      ['golf variant', 'golf gti', 'golf gtd', 'golf plus', 'golf sportsvan', 'e-golf'],
    ],
    ['vw-t-cross', 'T-Cross', 'suv_klein'],
    ['vw-t-roc', 'T-Roc', 'suv_klein'],
    ['vw-taigo', 'Taigo', 'suv_klein'],
    ['vw-id-3', 'ID.3', 'kompakt', ['id3']],
    ['vw-id-4', 'ID.4', 'suv_mittel', ['id4']],
    ['vw-touran', 'Touran', 'van'],
    ['vw-tiguan', 'Tiguan', 'suv_kompakt', ['tiguan allspace']],
    ['vw-passat', 'Passat', 'mittelklasse', ['passat variant', 'passat alltrack']],
    ['vw-arteon', 'Arteon', 'mittelklasse'],
    ['vw-sharan', 'Sharan', 'van'],
    ['vw-caddy', 'Caddy', 'hochdachkombi', ['caddy maxi']],
    [
      'vw-multivan',
      'Multivan / Transporter',
      'bus',
      ['multivan', 'transporter', 'california', 't5', 't6', 't7', 'caravelle'],
    ],
    ['vw-touareg', 'Touareg', 'suv_gross'],
    ['vw-scirocco', 'Scirocco', 'sportwagen'],
    ['vw-beetle', 'Beetle', 'kompakt', ['käfer', 'new beetle']],
  ],
  mercedes: [
    ['mercedes-a-klasse', 'A-Klasse', 'kompakt', ['a 180', 'a 200', 'a-klasse limousine']],
    ['mercedes-b-klasse', 'B-Klasse', 'van_klein', ['b 180', 'b 200']],
    ['mercedes-cla', 'CLA', 'kompakt', ['cla shooting brake']],
    ['mercedes-gla', 'GLA', 'suv_kompakt'],
    ['mercedes-glb', 'GLB', 'suv_kompakt'],
    ['mercedes-c-klasse', 'C-Klasse', 'mittelklasse', ['c 180', 'c 200', 'c 220 d', 't-modell']],
    ['mercedes-e-klasse', 'E-Klasse', 'obere_mittelklasse', ['e 200', 'e 220 d', 'e 350']],
    ['mercedes-glc', 'GLC', 'suv_mittel', ['glc coupé']],
    ['mercedes-gle', 'GLE', 'suv_gross', ['ml', 'm-klasse']],
    ['mercedes-s-klasse', 'S-Klasse', 'oberklasse'],
    ['mercedes-v-klasse', 'V-Klasse / Vito', 'bus', ['vito', 'marco polo', 'viano']],
    ['mercedes-slk', 'SLK / SLC', 'sportwagen', ['slc']],
    ['mercedes-eqa', 'EQA', 'suv_kompakt'],
  ],
  bmw: [
    ['bmw-1er', '1er', 'kompakt', ['116i', '118i', '118d', '120d', '120i']],
    [
      'bmw-2er-active-tourer',
      '2er Active Tourer',
      'van_klein',
      ['2er gran tourer', '218i active tourer'],
    ],
    ['bmw-2er', '2er Coupé / Cabrio / Gran Coupé', 'kompakt', ['2er coupé', '2er gran coupé']],
    ['bmw-3er', '3er', 'mittelklasse', ['318i', '320i', '320d', '330i', '330d', 'touring']],
    ['bmw-4er', '4er', 'mittelklasse', ['420i', '420d', '4er gran coupé']],
    ['bmw-5er', '5er', 'obere_mittelklasse', ['520d', '530d', '520i', '530e']],
    ['bmw-x1', 'X1', 'suv_kompakt'],
    ['bmw-x2', 'X2', 'suv_kompakt'],
    ['bmw-x3', 'X3', 'suv_mittel'],
    ['bmw-x5', 'X5', 'suv_gross'],
    ['bmw-i3', 'i3', 'kleinwagen'],
    ['bmw-z4', 'Z4', 'sportwagen'],
  ],
  audi: [
    ['audi-a1', 'A1', 'kleinwagen', ['a1 sportback']],
    ['audi-a3', 'A3', 'kompakt', ['a3 sportback', 'a3 limousine']],
    ['audi-a4', 'A4', 'mittelklasse', ['a4 avant', 'a4 allroad']],
    ['audi-a5', 'A5', 'mittelklasse', ['a5 sportback', 'a5 coupé']],
    ['audi-a6', 'A6', 'obere_mittelklasse', ['a6 avant', 'a6 allroad']],
    ['audi-q2', 'Q2', 'suv_klein'],
    ['audi-q3', 'Q3', 'suv_kompakt', ['q3 sportback']],
    ['audi-q5', 'Q5', 'suv_mittel', ['q5 sportback']],
    ['audi-q7', 'Q7', 'suv_gross'],
    ['audi-tt', 'TT', 'sportwagen'],
    ['audi-e-tron', 'e-tron / Q8 e-tron', 'suv_gross', ['q8 e-tron']],
  ],
  opel: [
    ['opel-adam', 'Adam', 'kleinstwagen'],
    ['opel-karl', 'Karl', 'kleinstwagen'],
    ['opel-corsa', 'Corsa', 'kleinwagen', ['corsa-e']],
    ['opel-astra', 'Astra', 'kompakt', ['astra sports tourer', 'astra kombi']],
    ['opel-meriva', 'Meriva', 'van_klein'],
    ['opel-zafira', 'Zafira', 'van', ['zafira tourer', 'zafira life']],
    [
      'opel-insignia',
      'Insignia',
      'mittelklasse',
      ['insignia sports tourer', 'insignia country tourer'],
    ],
    ['opel-mokka', 'Mokka', 'suv_klein', ['mokka x', 'mokka-e']],
    ['opel-crossland', 'Crossland', 'suv_klein', ['crossland x']],
    ['opel-grandland', 'Grandland', 'suv_kompakt', ['grandland x']],
    ['opel-combo', 'Combo', 'hochdachkombi', ['combo life']],
  ],
  ford: [
    ['ford-ka', 'Ka', 'kleinstwagen', ['ka+']],
    ['ford-fiesta', 'Fiesta', 'kleinwagen'],
    ['ford-puma', 'Puma', 'suv_klein'],
    ['ford-ecosport', 'EcoSport', 'suv_klein'],
    ['ford-focus', 'Focus', 'kompakt', ['focus turnier', 'focus st']],
    ['ford-c-max', 'C-Max', 'van_klein', ['grand c-max']],
    ['ford-kuga', 'Kuga', 'suv_kompakt'],
    ['ford-mondeo', 'Mondeo', 'mittelklasse', ['mondeo turnier']],
    ['ford-s-max', 'S-Max / Galaxy', 'van', ['galaxy']],
    [
      'ford-tourneo-custom',
      'Transit Custom / Tourneo Custom',
      'bus',
      ['tourneo custom', 'transit custom', 'nugget'],
    ],
    ['ford-mustang', 'Mustang', 'sportwagen', ['mustang mach-e']],
  ],
  skoda: [
    ['skoda-citigo', 'Citigo', 'kleinstwagen', ['citigo-e iv']],
    ['skoda-fabia', 'Fabia', 'kleinwagen', ['fabia combi']],
    ['skoda-kamiq', 'Kamiq', 'suv_klein'],
    ['skoda-scala', 'Scala', 'kompakt'],
    ['skoda-rapid', 'Rapid', 'kompakt', ['rapid spaceback']],
    ['skoda-octavia', 'Octavia', 'kompakt', ['octavia combi', 'octavia rs']],
    ['skoda-yeti', 'Yeti', 'suv_kompakt'],
    ['skoda-karoq', 'Karoq', 'suv_kompakt'],
    ['skoda-kodiaq', 'Kodiaq', 'suv_mittel'],
    ['skoda-superb', 'Superb', 'mittelklasse', ['superb combi']],
    ['skoda-enyaq', 'Enyaq', 'suv_mittel', ['enyaq iv', 'enyaq coupé']],
    ['skoda-roomster', 'Roomster', 'hochdachkombi'],
  ],
  seat: [
    ['seat-mii', 'Mii', 'kleinstwagen', ['mii electric']],
    ['seat-ibiza', 'Ibiza', 'kleinwagen', ['ibiza st']],
    ['seat-arona', 'Arona', 'suv_klein'],
    ['seat-leon', 'Leon', 'kompakt', ['leon st', 'leon sportstourer']],
    ['seat-ateca', 'Ateca', 'suv_kompakt'],
    ['seat-tarraco', 'Tarraco', 'suv_mittel'],
    ['seat-alhambra', 'Alhambra', 'van'],
  ],
  cupra: [
    ['cupra-formentor', 'Formentor', 'suv_kompakt'],
    ['cupra-born', 'Born', 'kompakt'],
    ['cupra-leon', 'Leon', 'kompakt'],
  ],
  renault: [
    ['renault-twingo', 'Twingo', 'kleinstwagen'],
    ['renault-clio', 'Clio', 'kleinwagen', ['clio grandtour']],
    ['renault-zoe', 'Zoe', 'kleinwagen', ['zoé']],
    ['renault-captur', 'Captur', 'suv_klein'],
    ['renault-megane', 'Mégane', 'kompakt', ['megane', 'megane grandtour', 'mégane e-tech']],
    ['renault-scenic', 'Scénic', 'van', ['scenic', 'grand scenic', 'grand scénic']],
    ['renault-kadjar', 'Kadjar', 'suv_kompakt'],
    ['renault-austral', 'Austral', 'suv_kompakt'],
    ['renault-kangoo', 'Kangoo', 'hochdachkombi'],
    ['renault-espace', 'Espace', 'van'],
  ],
  dacia: [
    ['dacia-spring', 'Spring', 'kleinstwagen'],
    ['dacia-sandero', 'Sandero', 'kleinwagen', ['sandero stepway']],
    ['dacia-logan', 'Logan', 'kleinwagen', ['logan mcv']],
    ['dacia-duster', 'Duster', 'suv_kompakt'],
    ['dacia-jogger', 'Jogger', 'van'],
    ['dacia-lodgy', 'Lodgy', 'van'],
  ],
  peugeot: [
    ['peugeot-108', '108', 'kleinstwagen', ['107']],
    ['peugeot-208', '208', 'kleinwagen', ['e-208', '207', '206']],
    ['peugeot-2008', '2008', 'suv_klein', ['e-2008']],
    ['peugeot-308', '308', 'kompakt', ['308 sw']],
    ['peugeot-3008', '3008', 'suv_kompakt'],
    ['peugeot-5008', '5008', 'suv_mittel'],
    ['peugeot-508', '508', 'mittelklasse', ['508 sw']],
    ['peugeot-rifter', 'Rifter / Partner', 'hochdachkombi', ['partner', 'partner tepee']],
  ],
  citroen: [
    ['citroen-c1', 'C1', 'kleinstwagen'],
    ['citroen-c3', 'C3', 'kleinwagen'],
    ['citroen-c3-aircross', 'C3 Aircross', 'suv_klein'],
    ['citroen-c4', 'C4', 'kompakt', ['c4 cactus', 'ë-c4']],
    [
      'citroen-c4-picasso',
      'C4 Picasso / SpaceTourer',
      'van',
      ['grand c4 picasso', 'c4 spacetourer', 'grand c4 spacetourer'],
    ],
    ['citroen-c5-aircross', 'C5 Aircross', 'suv_kompakt'],
    ['citroen-berlingo', 'Berlingo', 'hochdachkombi'],
  ],
  fiat: [
    ['fiat-500', '500', 'kleinstwagen', ['500c', '500e', '500 elektro']],
    ['fiat-panda', 'Panda', 'kleinstwagen'],
    ['fiat-punto', 'Punto', 'kleinwagen', ['grande punto', 'punto evo']],
    ['fiat-500x', '500X', 'suv_klein'],
    ['fiat-tipo', 'Tipo', 'kompakt', ['tipo kombi']],
    ['fiat-ducato', 'Ducato', 'bus', ['wohnmobil']],
  ],
  toyota: [
    ['toyota-aygo', 'Aygo', 'kleinstwagen', ['aygo x']],
    ['toyota-yaris', 'Yaris', 'kleinwagen', ['yaris hybrid', 'yaris cross']],
    ['toyota-corolla', 'Corolla / Auris', 'kompakt', ['auris', 'corolla touring sports']],
    ['toyota-c-hr', 'C-HR', 'suv_kompakt'],
    ['toyota-rav4', 'RAV4', 'suv_mittel', ['rav 4']],
    ['toyota-prius', 'Prius', 'kompakt', ['prius+', 'prius plug-in']],
  ],
  hyundai: [
    ['hyundai-i10', 'i10', 'kleinstwagen'],
    ['hyundai-i20', 'i20', 'kleinwagen'],
    ['hyundai-i30', 'i30', 'kompakt', ['i30 kombi', 'i30 fastback']],
    ['hyundai-kona', 'Kona', 'suv_klein', ['kona elektro']],
    ['hyundai-tucson', 'Tucson', 'suv_kompakt', ['ix35']],
    ['hyundai-ioniq', 'Ioniq', 'kompakt', ['ioniq elektro', 'ioniq hybrid']],
    ['hyundai-ioniq-5', 'Ioniq 5', 'suv_mittel'],
    ['hyundai-santa-fe', 'Santa Fe', 'suv_gross'],
  ],
  kia: [
    ['kia-picanto', 'Picanto', 'kleinstwagen'],
    ['kia-rio', 'Rio', 'kleinwagen'],
    ['kia-stonic', 'Stonic', 'suv_klein'],
    ['kia-ceed', 'Ceed', 'kompakt', ["cee'd", 'ceed sportswagon', 'proceed', 'xceed']],
    ['kia-niro', 'Niro', 'suv_kompakt', ['e-niro', 'niro ev']],
    ['kia-sportage', 'Sportage', 'suv_kompakt'],
    ['kia-sorento', 'Sorento', 'suv_gross'],
    ['kia-ev6', 'EV6', 'suv_mittel'],
  ],
  nissan: [
    ['nissan-micra', 'Micra', 'kleinwagen'],
    ['nissan-note', 'Note', 'kleinwagen'],
    ['nissan-juke', 'Juke', 'suv_klein'],
    ['nissan-leaf', 'Leaf', 'kompakt'],
    ['nissan-qashqai', 'Qashqai', 'suv_kompakt', ['qashqai+2']],
    ['nissan-x-trail', 'X-Trail', 'suv_mittel'],
  ],
  mazda: [
    ['mazda-2', 'Mazda2', 'kleinwagen', ['mazda 2']],
    ['mazda-3', 'Mazda3', 'kompakt', ['mazda 3']],
    ['mazda-6', 'Mazda6', 'mittelklasse', ['mazda 6', 'mazda6 kombi']],
    ['mazda-cx-3', 'CX-3', 'suv_klein'],
    ['mazda-cx-30', 'CX-30', 'suv_kompakt'],
    ['mazda-cx-5', 'CX-5', 'suv_kompakt'],
    ['mazda-mx-5', 'MX-5', 'sportwagen', ['mx5', 'miata']],
  ],
  volvo: [
    ['volvo-v40', 'V40', 'kompakt', ['v40 cross country']],
    ['volvo-xc40', 'XC40', 'suv_kompakt'],
    ['volvo-v60', 'V60', 'mittelklasse', ['v60 cross country', 's60']],
    ['volvo-xc60', 'XC60', 'suv_mittel'],
    ['volvo-v90', 'V90 / V70', 'obere_mittelklasse', ['v70', 'xc70', 's90']],
    ['volvo-xc90', 'XC90', 'suv_gross'],
  ],
  mini: [
    [
      'mini-cooper',
      'Cooper / One',
      'kleinwagen',
      ['cooper', 'one', 'cooper s', 'mini 3-türer', 'mini 5-türer', 'cooper se'],
    ],
    ['mini-countryman', 'Countryman', 'suv_klein'],
    ['mini-clubman', 'Clubman', 'kompakt'],
  ],
  smart: [
    ['smart-fortwo', 'fortwo', 'kleinstwagen', ['for two', 'eq fortwo']],
    ['smart-forfour', 'forfour', 'kleinstwagen', ['for four']],
  ],
  suzuki: [
    ['suzuki-ignis', 'Ignis', 'kleinstwagen'],
    ['suzuki-swift', 'Swift', 'kleinwagen'],
    ['suzuki-vitara', 'Vitara', 'suv_klein'],
    ['suzuki-sx4-s-cross', 'SX4 S-Cross', 'suv_kompakt', ['s-cross']],
    ['suzuki-jimny', 'Jimny', 'suv_klein'],
  ],
  honda: [
    ['honda-jazz', 'Jazz', 'kleinwagen'],
    ['honda-civic', 'Civic', 'kompakt'],
    ['honda-hr-v', 'HR-V', 'suv_kompakt'],
    ['honda-cr-v', 'CR-V', 'suv_mittel'],
  ],
  tesla: [
    ['tesla-model-3', 'Model 3', 'mittelklasse'],
    ['tesla-model-y', 'Model Y', 'suv_mittel'],
    ['tesla-model-s', 'Model S', 'oberklasse'],
  ],
  mitsubishi: [
    ['mitsubishi-space-star', 'Space Star', 'kleinstwagen'],
    ['mitsubishi-asx', 'ASX', 'suv_kompakt'],
    [
      'mitsubishi-outlander',
      'Outlander',
      'suv_mittel',
      ['outlander plug-in hybrid', 'outlander phev'],
    ],
  ],
  jeep: [
    ['jeep-renegade', 'Renegade', 'suv_klein'],
    ['jeep-compass', 'Compass', 'suv_kompakt'],
    ['jeep-wrangler', 'Wrangler', 'suv_gross'],
  ],
  porsche: [
    ['porsche-macan', 'Macan', 'suv_mittel'],
    ['porsche-cayenne', 'Cayenne', 'suv_gross'],
    ['porsche-911', '911', 'sportwagen', ['carrera']],
  ],
  'land-rover': [
    ['land-rover-range-rover-evoque', 'Range Rover Evoque', 'suv_kompakt', ['evoque']],
    ['land-rover-discovery-sport', 'Discovery Sport', 'suv_mittel'],
    ['land-rover-defender', 'Defender', 'suv_gross'],
  ],
  'alfa-romeo': [
    ['alfa-romeo-giulietta', 'Giulietta', 'kompakt'],
    ['alfa-romeo-giulia', 'Giulia', 'mittelklasse'],
    ['alfa-romeo-stelvio', 'Stelvio', 'suv_mittel'],
  ],
  mg: [
    ['mg-mg4', 'MG4', 'kompakt', ['mg 4', 'mg4 electric']],
    ['mg-zs', 'ZS', 'suv_klein', ['zs ev']],
  ],
  ds: [['ds-ds-7', 'DS 7', 'suv_kompakt', ['ds7 crossback']]],
  jaguar: [['jaguar-f-pace', 'F-Pace', 'suv_mittel']],
  lexus: [['lexus-nx', 'NX', 'suv_mittel']],
  subaru: [
    ['subaru-forester', 'Forester', 'suv_kompakt'],
    ['subaru-outback', 'Outback', 'mittelklasse'],
  ],
  byd: [['byd-atto-3', 'Atto 3', 'suv_kompakt']],
  polestar: [['polestar-2', '2', 'mittelklasse', ['polestar 2']]],
};

export const MODELS: readonly ModelEntry[] = Object.entries(BY_MAKE).flatMap(([makeId, rows]) =>
  rows.map(([id, model, segment, aliases]) => ({
    id,
    makeId,
    model,
    segment,
    ...(aliases ? { aliases } : {}),
  })),
);

const MODEL_BY_ID = new Map(MODELS.map((model) => [model.id, model]));

export function modelById(id: string | null | undefined): ModelEntry | null {
  return id ? (MODEL_BY_ID.get(id) ?? null) : null;
}

export function modelsOfMake(makeId: string | null | undefined): readonly ModelEntry[] {
  return makeId ? MODELS.filter((model) => model.makeId === makeId) : [];
}

const fold = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Matches typed model text ("golf variant", "C-Klasse") to a catalog model of the make. */
export function findModel(makeId: string | null, text: string): ModelEntry | null {
  const wanted = fold(text);
  if (!wanted) return null;
  const candidates = makeId ? modelsOfMake(makeId) : MODELS;
  return (
    candidates.find(
      (model) =>
        fold(model.model) === wanted ||
        (model.aliases ?? []).some((alias) => fold(alias) === wanted),
    ) ?? null
  );
}
