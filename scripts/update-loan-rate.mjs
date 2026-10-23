// Updates AVERAGE_LOAN_RATE in packages/shared/src/financing.ts with the newest
// month of the Bundesbank series SUD114 (effective rate of new consumer loans,
// over 1 up to 5 years). Run: npm run loan-rate:update
import { readFile, writeFile } from 'node:fs/promises';

const SERIES = 'BBIM1/M.DE.B.A2B.I.R.A.2250.EUR.N';
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
const value = (name) => values[columns.indexOf(name)];
const month = value('TIME_PERIOD');
const percent = Number(value('OBS_VALUE'));
const provisional = value('OBS_STATUS') === 'P';
if (!/^\d{4}-\d{2}$/.test(month) || !(percent > 0 && percent < 30))
  throw new Error(`Unexpected figure: ${month} ${value('OBS_VALUE')}`);

const source = await readFile(FILE, 'utf8');
const updated = source
  .replace(/(AVERAGE_LOAN_RATE = \{\n {2}percent: )[\d.]+,/, `$1${percent},`)
  .replace(/(\n {2}month: ')\d{4}-\d{2}(',)/, `$1${month}$2`)
  .replace(/(\n {2}provisional: )(true|false),/, `$1${provisional},`);
if (updated === source) console.log(`Unchanged: ${percent} % (${month})`);
else {
  await writeFile(FILE, updated);
  console.log(`Updated: ${percent} % (${month}${provisional ? ', provisional' : ''})`);
}
