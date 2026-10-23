// Updates AVERAGE_LOAN_RATE in packages/shared/src/financing.ts with the newest
// month of the Bundesbank series SUD130 (effective annual rate including costs
// of new consumer loans to households). Run: npm run loan-rate:update
import { readFile, writeFile } from 'node:fs/promises';

const SERIES = 'BBIM1/M.DE.B.A2B.A.C.A.2250.EUR.N';
const FILE = new URL('../packages/shared/src/financing.ts', import.meta.url);

const response = await fetch(
  `https://api.statistiken.bundesbank.de/rest/data/${SERIES}?lastNObservations=1`,
  { headers: { Accept: 'text/csv' }, signal: AbortSignal.timeout(20_000) },
);
if (!response.ok) throw new Error(`Bundesbank: HTTP ${response.status}`);
const [header, row] = (await response.text())
  .replace(/^\uFEFF/, '')
  .trim()
  .split(/\r?\n/);
const columns = header.split(';');
const values = row.split(';');
// The CSV is not quoted: a semicolon in a text column would shift the others.
if (values.length !== columns.length) throw new Error('Bundesbank: unexpected CSV columns');
const value = (name) => values[columns.indexOf(name)];
const month = value('TIME_PERIOD');
const percent = Number(value('OBS_VALUE'));
const provisional = value('OBS_STATUS') === 'P';
if (!/^\d{4}-\d{2}$/.test(month) || !(percent > 0 && percent < 30))
  throw new Error(`Unexpected figure: ${month} ${value('OBS_VALUE')}`);

const source = await readFile(FILE, 'utf8');
const block = /export const AVERAGE_LOAN_RATE = \{[\s\S]*?\} as const;/;
const current = block.exec(source)?.[0];
if (!current) throw new Error('AVERAGE_LOAN_RATE not found');
let next = current;
for (const [pattern, replacement] of [
  [/(\bpercent: )[\d.]+,/, `$1${percent},`],
  [/(\bmonth: ')\d{4}-\d{2}(',)/, `$1${month}$2`],
  [/(\bprovisional: )(true|false),/, `$1${provisional},`],
]) {
  if (!pattern.test(next)) throw new Error(`AVERAGE_LOAN_RATE: ${pattern} not found`);
  next = next.replace(pattern, replacement);
}
if (next === current) console.log(`Unchanged: ${percent} % (${month})`);
else {
  await writeFile(FILE, source.replace(current, next));
  console.log(`Updated: ${percent} % (${month}${provisional ? ', provisional' : ''})`);
}
