/**
 * Writes data/engines/<model id>.json: displacement, power, CO₂ and fuel
 * consumption of the engines registered in Germany, per model and year, from
 * the EEA's „Monitoring of CO2 emissions from passenger cars“ (Regulation (EU)
 * 2019/631, licence CC BY 4.0). Run: `npm run catalog:engines`.
 *
 * The raw rows are kept in a cache file (ENGINES_CACHE, default in the system
 * temp directory), so that mapping changes do not query the EEA again.
 */
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { engineMakeId, engineModelId, extraModel, typoModelId } from '../src/engine-match';
import { foldName, MODELS } from '../src/models';
import { aggregateEngines, consumptionPerCo2, type RawEngineRow } from '../src/engine-aggregate';

const SQL_URL = 'https://discodata.eea.europa.eu/sql';
const PAGE = 50_000;
// Each year is in the table twice, provisional (P) and final (F); the script keeps one.
const QUERY = `SELECT UPPER(LTRIM(RTRIM(Mk))) AS mk, UPPER(LTRIM(RTRIM(Cn))) AS cn,
  UPPER(Ft) AS ft, UPPER(Fm) AS fm, [Ec (cm3)] AS ccm, [Ep (KW)] AS kw, Year AS y, Status AS st,
  [Ewltp (g/km)] AS w, COALESCE([Enedc (g/km)], [E (g/km)]) AS e,
  SUM(COALESCE(R, 1)) AS n, AVG(Fc) AS fc, AVG([Z (Wh/km)]) AS z
FROM [CO2Emission].[latest].[co2cars] WHERE MS = 'DE'
GROUP BY UPPER(LTRIM(RTRIM(Mk))), UPPER(LTRIM(RTRIM(Cn))), UPPER(Ft), UPPER(Fm),
  [Ec (cm3)], [Ep (KW)], Year, Status, [Ewltp (g/km)], COALESCE([Enedc (g/km)], [E (g/km)])
ORDER BY mk, cn, ft, fm, ccm, kw, y, st, w, e`;
const COUNT_QUERY = `SELECT COUNT(*) AS rows FROM (${QUERY.replace(/ORDER BY[\s\S]*$/, '')}) t`;

const dataDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data');
// The cache belongs to the query: a changed query fetches again.
const queryHash = createHash('sha256').update(QUERY).digest('hex').slice(0, 12);
const cache =
  process.env.ENGINES_CACHE ?? path.join(tmpdir(), `kaufcheck-eea-co2cars-de-${queryHash}.json`);

const RowSchema = z.object({
  mk: z.string().nullable(),
  cn: z.string().nullable(),
  ft: z.string().nullable(),
  fm: z.string().nullable(),
  ccm: z.number().nullable(),
  kw: z.number().nullable(),
  y: z.number().int(),
  st: z.string().nullable(),
  w: z.number().nullable(),
  e: z.number().nullable(),
  n: z.number(),
  fc: z.number().nullable(),
  z: z.number().nullable(),
});
type Row = z.infer<typeof RowSchema>;

async function sql(query: string, page?: number): Promise<unknown[]> {
  const url = new URL(SQL_URL);
  url.searchParams.set('query', query);
  if (page) {
    url.searchParams.set('p', String(page));
    url.searchParams.set('nrOfHits', String(PAGE));
  }
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(300_000) });
      if (!response.ok) throw new Error(`EEA: HTTP ${response.status}`);
      const body = (await response.json()) as { results?: unknown[]; errors?: unknown };
      if (!body.results) throw new Error(`EEA: ${JSON.stringify(body.errors)}`);
      return body.results;
    } catch (error) {
      if (attempt === 3) throw error;
      console.log(`retrying after: ${String(error)}`);
      await new Promise((resolve) => setTimeout(resolve, 5_000 * attempt));
    }
  }
}

async function download(): Promise<{ retrieved: string; rows: Row[] }> {
  const retrieved = new Date().toISOString().slice(0, 10);
  const [{ rows: expected }] = z
    .tuple([z.object({ rows: z.number() })])
    .parse(await sql(COUNT_QUERY));
  const rows: Row[] = [];
  for (let page = 1; rows.length < expected; page++) {
    const results = z.array(RowSchema).parse(await sql(QUERY, page));
    if (results.length === 0) break;
    rows.push(...results);
    console.log(`page ${page}: ${results.length} rows`);
  }
  if (rows.length !== expected) throw new Error(`EEA: ${rows.length} of ${expected} rows`);
  return { retrieved, rows };
}

const cachedFile: unknown = existsSync(cache) ? JSON.parse(readFileSync(cache, 'utf8')) : null;
// A cache in another format is fetched again.
const cached =
  z.object({ retrieved: z.string(), rows: z.array(RowSchema) }).safeParse(cachedFile).data ?? null;
const download_ = cached ?? (await download());
if (!cached) writeFileSync(cache, JSON.stringify(download_));
const { retrieved } = download_;

// The final figures of a year where there are any, else the provisional ones.
const finalYears = new Set(download_.rows.filter((row) => row.st === 'F').map((row) => row.y));
const kept = download_.rows.filter((row) => (finalYears.has(row.y) ? row.st === 'F' : true));
const provisionalYears = [
  ...new Set(kept.filter((row) => row.st !== 'F').map((row) => row.y)),
].sort();
const rows: RawEngineRow[] = kept;

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
// Written next to the data and swapped in at the end, so that an error leaves the data as it was.
const tmpDir = path.join(dataDir, 'engines.tmp');
rmSync(tmpDir, { recursive: true, force: true });
mkdirSync(tmpDir, { recursive: true });
const index: Record<string, { id: string; name: string }[]> = {};
for (const [modelId, modelRows] of [...byModel].sort(([a], [b]) => a.localeCompare(b))) {
  const engines = aggregateEngines(modelRows);
  if (engines.length === 0) continue;
  writeFileSync(
    path.join(tmpDir, `${modelId}.json`),
    `${JSON.stringify({ retrieved, engines })}\n`,
  );
  const { makeId, name } = names.get(modelId)!;
  (index[makeId] ??= []).push({ id: modelId, name });
}
for (const models of Object.values(index))
  models.sort((a, b) => a.name.localeCompare(b.name, 'de'));
rmSync(outDir, { recursive: true, force: true });
renameSync(tmpDir, outDir);
writeFileSync(
  path.join(dataDir, 'engine-index.json'),
  `${JSON.stringify({ retrieved, provisionalYears, consumptionPerCo2: consumptionPerCo2(rows), makes: index }, null, 2)}\n`,
);
const files = readdirSync(outDir).length;
console.log(`data/engines: ${files} models, ${extraCount} of them not in the catalog`);
