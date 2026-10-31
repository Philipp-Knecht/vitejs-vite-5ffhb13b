/**
 * Writes data/model-images.json and apps/web/public/model-images/<generation id>.webp:
 * one photo per generation from Wikimedia Commons, chosen in
 * data/model-image-sources.json (the lead image of the generation's
 * Wikipedia article, checked by eye). Only free licences pass; title, author,
 * licence and file page are kept for the credit under the photo. The photo
 * is served from our own server, so visitors load nothing from Wikimedia.
 * Readable number plates are pixelated: their boxes are listed with the file,
 * in pixels of the 960 px copy, found by eye.
 * Run: `npm run catalog:images` (needs ImageMagick's `convert` with WebP).
 *
 * The file details come through the Wikidata Query Service's MediaWiki API
 * bridge, which also works where the Commons API limits a shared address.
 */
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const USER_AGENT = 'KaufCheckBot/1.0 (+https://kaufcheck-app.de/bot)';
const WIDTH = 960;
const QUALITY = '72';
/** Licences that allow showing the photo with a credit; anything else is refused. */
const FREE = /^(CC BY(-SA)? \d\.\d( [a-z]{2})?|CC0|Public domain|Attribution)$/i;
/** Thumbnails come from Wikimedia's own servers only. */
const HOSTS = new Set(['upload.wikimedia.org', 'thumb.wikimedia.org']);
const CODERS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png' };

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(here, '../data');
const imageDir = path.resolve(here, '../../../apps/web/public/model-images');

/** x, y, width, height in pixels of the 960 px copy. */
const Box = z.tuple([
  z.number().int().nonnegative(),
  z.number().int().nonnegative(),
  z.number().int().positive(),
  z.number().int().positive(),
]);
const Sources = z.record(
  z.string().regex(/^[a-z0-9-]+$/),
  z.union([
    z.string().min(1),
    z.object({ file: z.string().min(1), plates: z.array(Box).min(1) }).strict(),
  ]),
);
/** What model-images.json keeps per generation. */
const Entry = z.object({
  file: z.string(),
  title: z.string(),
  author: z.string(),
  license: z.string(),
  licenseUrl: z.string().nullable(),
  width: z.number(),
  height: z.number(),
  plates: z.array(Box).optional(),
});
type Entry = z.infer<typeof Entry>;

const FIELDS = [
  'ObjectName',
  'LicenseShortName',
  'LicenseUrl',
  'Artist',
  'Attribution',
  'Permission',
  'Restrictions',
] as const;

type Details = Record<'title' | 'thumb' | 'w' | 'h', string> &
  Partial<Record<(typeof FIELDS)[number], string>>;

async function details(file: string): Promise<Details | null> {
  const outputs = FIELDS.map(
    (field) => `?${field} wikibase:apiOutput "imageinfo/ii/extmetadata/${field}/@value".`,
  ).join('\n');
  const query = `SELECT ?title ${FIELDS.map((field) => `?${field}`).join(' ')} ?thumb ?w ?h WHERE {
  SERVICE wikibase:mwapi {
    bd:serviceParam wikibase:endpoint "commons.wikimedia.org"; wikibase:api "Generator"; wikibase:limit 1;
      mwapi:generator "allpages"; mwapi:gapnamespace "6"; mwapi:gapfrom ${JSON.stringify(file)}; mwapi:gaplimit "1";
      mwapi:prop "imageinfo"; mwapi:iiprop "extmetadata|url|size"; mwapi:iiurlwidth "${WIDTH}".
    ?title wikibase:apiOutput mwapi:title.
${outputs}
    ?thumb wikibase:apiOutput "imageinfo/ii/@thumburl".
    ?w wikibase:apiOutput "imageinfo/ii/@thumbwidth".
    ?h wikibase:apiOutput "imageinfo/ii/@thumbheight".
  } }`;
  const attempts = 4;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const response = await fetch('https://query.wikidata.org/sparql', {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/sparql-results+json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ query }),
    });
    if (response.ok) {
      const body = (await response.json()) as {
        results: { bindings: Record<string, { value: string }>[] };
      };
      const row = body.results.bindings[0];
      if (!row) return null;
      return Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key, value.value]),
      ) as Details;
    }
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 8000 * attempt));
  }
  throw new Error(`No answer for ${file}`);
}

/** The text without the markup Commons wraps around names and titles. */
function plain(html: string | undefined): string {
  return (
    (html ?? '')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#0?39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      // A wiki signature („Name (talk) 13:33, 5 April 2009 (UTC)“) keeps only the name.
      .replace(/\s*\(talk\)\s*\d{1,2}:\d{2}, \d{1,2} \w+ \d{4} \(UTC\)/g, '')
      .replace(/\s+/g, ' ')
      .replace(/\s+,/g, ',')
      .trim()
  );
}

/**
 * Each box is blurred, then shown as a few coarse blocks: the plate is gone, the
 * picture stays calm.
 */
function pixelate(plates: readonly z.infer<typeof Box>[]): string[] {
  return plates.flatMap(([x, y, w, h]) => {
    const block = Math.max(10, Math.round(h / 2.5));
    return [
      '(',
      '+clone',
      '-crop',
      `${w}x${h}+${x}+${y}`,
      '+repage',
      '-blur',
      `0x${Math.round(h / 4)}`,
      '-scale',
      `${Math.ceil(w / block)}x${Math.ceil(h / block)}!`,
      '-scale',
      `${w}x${h}!`,
      ')',
      '-geometry',
      `+${x}+${y}`,
      '-composite',
    ];
  });
}

async function download(
  url: string,
  work: string,
  id: string,
  plates: readonly z.infer<typeof Box>[],
): Promise<string> {
  const { protocol, hostname } = new URL(url);
  if (protocol !== 'https:' || !HOSTS.has(hostname)) {
    throw new Error(`${id}: thumbnail not on Wikimedia's servers: ${url}`);
  }
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`${response.status} for ${url}`);
  const type = (response.headers.get('content-type') ?? '').split(';')[0]?.trim() ?? '';
  const coder = CODERS[type];
  if (!coder) throw new Error(`${id}: unexpected content type „${type}“ for ${url}`);
  const raw = path.join(work, `${id}.${coder}`);
  const target = path.join(work, `${id}.webp`);
  writeFileSync(raw, Buffer.from(await response.arrayBuffer()));
  // Resized (credited as „verkleinert“), plates pixelated; only the colour profile is kept.
  execFileSync('convert', [
    `${coder}:${raw}`,
    ...pixelate(plates),
    '+profile',
    '!icc,*',
    '-quality',
    QUALITY,
    `webp:${target}`,
  ]);
  return target;
}

const sources = Object.fromEntries(
  Object.entries(
    Sources.parse(JSON.parse(readFileSync(path.join(dataDir, 'model-image-sources.json'), 'utf8'))),
  ).map(([id, source]) => [id, typeof source === 'string' ? { file: source, plates: [] } : source]),
);
// A photo already fetched for the same file and boxes is kept; only new or changed ones are fetched.
const earlier = (() => {
  try {
    return z
      .object({ images: z.record(z.string(), z.unknown()) })
      .parse(JSON.parse(readFileSync(path.join(dataDir, 'model-images.json'), 'utf8'))).images;
  } catch {
    return {};
  }
})();
const images: Record<string, Entry> = {};
const fetched = new Map<string, string>();
const work = mkdtempSync(path.join(tmpdir(), 'kaufcheck-images-'));
try {
  for (const [id, { file, plates }] of Object.entries(sources)) {
    const before = Entry.safeParse(earlier[id]);
    if (
      before.success &&
      before.data.file === file &&
      JSON.stringify(before.data.plates ?? []) === JSON.stringify(plates) &&
      existsSync(path.join(imageDir, `${id}.webp`))
    ) {
      images[id] = before.data;
      continue;
    }
    const found = await details(file);
    if (!found || found.title.replaceAll(' ', '_') !== `File:${file.replaceAll(' ', '_')}`) {
      throw new Error(`${id}: ${file} not found on Commons`);
    }
    const license = found.LicenseShortName ?? '';
    if (!FREE.test(license)) throw new Error(`${id}: licence „${license}“ is not on the list`);
    const restrictions = plain(found.Restrictions);
    if (restrictions) {
      throw new Error(`${id}: ${file} carries restrictions („${restrictions}“); choose another`);
    }
    const width = Number(found.w);
    const height = Number(found.h);
    for (const [x, y, w, h] of plates) {
      if (width !== WIDTH || x + w > width || y + h > height) {
        throw new Error(`${id}: plate box ${[x, y, w, h].join(',')} outside ${width}×${height}`);
      }
    }
    fetched.set(id, await download(found.thumb, work, id, plates));
    images[id] = {
      file,
      title: plain(found.ObjectName) || file.replace(/\.[a-z]+$/i, '').replaceAll('_', ' '),
      // The name the author asks to be credited with, if any.
      author: plain(found.Attribution) || plain(found.Artist) || 'unbekannt',
      license,
      licenseUrl: found.LicenseUrl || null,
      width,
      height,
      ...(plates.length > 0 ? { plates } : {}),
    };
    // For a look by hand: what the author grants, in their words.
    console.log(id, license, '–', plain(found.Permission).slice(0, 160));
  }
  // Only once every photo is ready: the copies on the server change together.
  mkdirSync(imageDir, { recursive: true });
  for (const [id, file] of fetched) copyFileSync(file, path.join(imageDir, `${id}.webp`));
} finally {
  rmSync(work, { recursive: true, force: true });
}
// Photos of generations no longer listed go.
for (const name of readdirSync(imageDir)) {
  if (name.endsWith('.webp') && !(name.slice(0, -'.webp'.length) in sources)) {
    rmSync(path.join(imageDir, name));
  }
}
writeFileSync(
  path.join(dataDir, 'model-images.json'),
  `${JSON.stringify({ retrieved: new Date().toISOString().slice(0, 10), images }, null, 2)}\n`,
);
