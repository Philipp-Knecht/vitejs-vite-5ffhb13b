/**
 * Writes data/engines/<model id>.json: displacement, power, CO₂ and fuel
 * consumption of the engines registered in Germany, per model and year, from
 * the EEA's „Monitoring of CO2 emissions from passenger cars“ (Regulation (EU)
 * 2019/631, licence CC BY 4.0). Run: `npm run catalog:engines`.
 *
 * The raw rows are kept in a cache file (ENGINES_CACHE, default in the system
 * temp directory), so that mapping changes do not query the EEA again.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { engineMakeId, engineModelId, extraModel, typoModelId } from '../src/engine-match';
import { foldName, MODELS } from '../src/models';
import { aggregateEngines, consumptionPerCo2, type RawEngineRow } from '../src/engine-aggregate';

const SQL_URL = 'https://discodata.eea.europa.eu/sql';
const PAGE = 50_000;
const QUERY = `SELECT UPPER(LTRIM(RTRIM(Mk))) AS mk, UPPER(LTRIM(RTRIM(Cn))) AS cn,
  UPPER(Ft) AS ft, UPPER(Fm) AS fm, [Ec (cm3)] AS ccm, [Ep (KW)] AS kw, Year AS y,
  [Ewltp (g/km)] AS w, COALESCE([Enedc (g/km)], [E (g/km)]) AS e,
  SUM(COALESCE(R, 1)) AS n, AVG(Fc) AS fc, AVG([Z (Wh/km)]) AS z
FROM [CO2Emission].[latest].[co2cars] WHERE MS = 'DE'
GROUP BY UPPER(LTRIM(RTRIM(Mk))), UPPER(LTRIM(RTRIM(Cn))), UPPER(Ft), UPPER(Fm),
  [Ec (cm3)], [Ep (KW)], Year, [Ewltp (g/km)], COALESCE([Enedc (g/km)], [E (g/km)])
ORDER BY mk, cn, ft, fm, ccm, kw, y, w, e`;

const dataDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data');
const cache = process.env.ENGINES_CACHE ?? path.join(tmpdir(), 'kaufcheck-eea-co2cars-de.json');

async function download(): Promise<RawEngineRow[]> {
  const rows: RawEngineRow[] = [];
  for (let page = 1; ; page++) {
    const url = new URL(SQL_URL);
    url.searchParams.set('query', QUERY);
    url.searchParams.set('p', String(page));
    url.searchParams.set('nrOfHits', String(PAGE));
    const response = await fetch(url, { signal: AbortSignal.timeout(300_000) });
    if (!response.ok) throw new Error(`EEA: HTTP ${response.status}`);
    const body = (await response.json()) as { results?: RawEngineRow[]; errors?: unknown };
    if (!body.results) throw new Error(`EEA: ${JSON.stringify(body.errors)}`);
    rows.push(...body.results);
    console.log(`page ${page}: ${body.results.length} rows`);
    if (body.results.length < PAGE) return rows;
  }
}

const rows: RawEngineRow[] = existsSync(cache)
  ? (JSON.parse(readFileSync(cache, 'utf8')) as RawEngineRow[])
  : await download();
if (!existsSync(cache)) writeFileSync(cache, JSON.stringify(rows));

/** A model of its own needs this many registrations, so that rare spellings stay out. */
const EXTRA_MIN_REGISTRATIONS = 5_000;

const byModel = new Map<string, RawEngineRow[]>();
const add = (modelId: string, row: RawEngineRow) => {
  const list = byModel.get(modelId) ?? [];
  list.push(row);
  byModel.set(modelId, list);
};
const extras = new Map<
  string,
  { makeId: string; rows: RawEngineRow[]; names: Map<string, number> }
>();
for (const row of rows) {
  const makeId = engineMakeId(row.mk);
  if (!makeId) continue;
  const modelId = engineModelId(makeId, row.cn);
  if (modelId) {
    add(modelId, row);
    continue;
  }
  const extra = extraModel(makeId, row.cn);
  if (!extra) continue;
  if ('modelId' in extra) {
    add(extra.modelId, row);
    continue;
  }
  const typo = typoModelId(extra.makeId, extra.key);
  if (typo) {
    add(typo, row);
    continue;
  }
  const id = `${extra.makeId}|${extra.key}`;
  const group = extras.get(id) ?? {
    makeId: extra.makeId,
    rows: [],
    names: new Map<string, number>(),
  };
  group.rows.push(row);
  group.names.set(extra.name, (group.names.get(extra.name) ?? 0) + row.n);
  extras.set(id, group);
}

const slug = (name: string) => foldName(name).replace(/ /g, '-');
const names = new Map<string, { makeId: string; name: string }>(
  MODELS.map((model) => [model.id, { makeId: model.makeId, name: model.model }]),
);
let extraCount = 0;
for (const { makeId, rows: extraRows, names: spellings } of extras.values()) {
  const total = extraRows.reduce((sum, row) => sum + row.n, 0);
  if (total < EXTRA_MIN_REGISTRATIONS) continue;
  const name = [...spellings].sort((a, b) => b[1] - a[1])[0]![0];
  let id = `${makeId}-${slug(name)}`;
  if (names.has(id) && !byModel.has(id)) id = `${id}-eu`;
  if (!names.has(id)) names.set(id, { makeId, name });
  for (const row of extraRows) add(id, row);
  extraCount++;
}

const outDir = path.join(dataDir, 'engines');
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
const retrieved = new Date().toISOString().slice(0, 10);
const index: Record<string, { id: string; name: string }[]> = {};
for (const [modelId, modelRows] of [...byModel].sort(([a], [b]) => a.localeCompare(b))) {
  const engines = aggregateEngines(modelRows);
  if (engines.length === 0) continue;
  writeFileSync(
    path.join(outDir, `${modelId}.json`),
    `${JSON.stringify({ retrieved, engines })}\n`,
  );
  const { makeId, name } = names.get(modelId)!;
  (index[makeId] ??= []).push({ id: modelId, name });
}
for (const models of Object.values(index))
  models.sort((a, b) => a.name.localeCompare(b.name, 'de'));
writeFileSync(
  path.join(dataDir, 'engine-index.json'),
  `${JSON.stringify({ retrieved, consumptionPerCo2: consumptionPerCo2(rows), makes: index }, null, 2)}\n`,
);
const files = readdirSync(outDir).length;
console.log(`data/engines: ${files} models, ${extraCount} of them not in the catalog`);
