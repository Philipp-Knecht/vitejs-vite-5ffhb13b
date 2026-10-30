/**
 * Writes data/model-images.json and apps/web/public/model-images/<generation id>.webp:
 * one photo per generation from Wikimedia Commons, chosen in
 * data/model-image-sources.json (the lead image of the generation's
 * Wikipedia article, checked by eye). Only free licences pass; author,
 * licence and file page are kept for the credit under the photo. The photo
 * is served from our own server, so visitors load nothing from Wikimedia.
 * Run: `npm run catalog:images` (needs ImageMagick's `convert` with WebP).
 *
 * The file details come through the Wikidata Query Service's MediaWiki API
 * bridge, which also works where the Commons API limits a shared address.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const USER_AGENT = 'KaufCheckBot/1.0 (+https://kaufcheck-app.de/bot)';
const WIDTH = 960;
const QUALITY = '72';
/** Licences that allow showing the photo with a credit; anything else is refused. */
const FREE = /^(CC BY(-SA)? \d\.\d( [a-z]{2})?|CC0|Public domain|Attribution)$/i;

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(here, '../data');
const imageDir = path.resolve(here, '../../../apps/web/public/model-images');

const Sources = z.record(z.string().regex(/^[a-z0-9-]+$/), z.string().min(1));
const FIELDS = ['LicenseShortName', 'LicenseUrl', 'Artist', 'Restrictions'] as const;

type Details = Record<(typeof FIELDS)[number] | 'title' | 'thumb' | 'w' | 'h', string>;

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
  for (let attempt = 0; attempt < 4; attempt++) {
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
    await new Promise((resolve) => setTimeout(resolve, 8000 * (attempt + 1)));
  }
  throw new Error(`No answer for ${file}`);
}

/** The author's name without the markup Commons wraps around it. */
function plain(html: string): string {
  return (
    html
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

async function download(url: string, target: string): Promise<void> {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`${response.status} for ${url}`);
  const raw = path.join(tmpdir(), `kaufcheck-image-${process.pid}`);
  writeFileSync(raw, Buffer.from(await response.arrayBuffer()));
  // Resized only (credited as „verkleinert“); metadata stripped.
  execFileSync('convert', [raw, '-strip', '-quality', QUALITY, `webp:${target}`]);
  rmSync(raw);
}

const sources = Sources.parse(
  JSON.parse(readFileSync(path.join(dataDir, 'model-image-sources.json'), 'utf8')),
);
mkdirSync(imageDir, { recursive: true });
// A photo already fetched for the same file is kept; only new or changed ones are fetched.
const earlier = (() => {
  try {
    return z
      .object({ images: z.record(z.string(), z.object({ file: z.string() }).passthrough()) })
      .parse(JSON.parse(readFileSync(path.join(dataDir, 'model-images.json'), 'utf8'))).images;
  } catch {
    return {};
  }
})();
const images: Record<string, unknown> = {};
for (const [id, file] of Object.entries(sources)) {
  if (earlier[id]?.file === file && existsSync(path.join(imageDir, `${id}.webp`))) {
    images[id] = earlier[id];
    continue;
  }
  const found = await details(file);
  if (!found || found.title.replaceAll(' ', '_') !== `File:${file.replaceAll(' ', '_')}`) {
    throw new Error(`${id}: ${file} not found on Commons`);
  }
  if (!FREE.test(found.LicenseShortName)) {
    throw new Error(`${id}: licence „${found.LicenseShortName}“ is not on the list`);
  }
  await download(found.thumb, path.join(imageDir, `${id}.webp`));
  images[id] = {
    file,
    author: plain(found.Artist) || 'unbekannt',
    license: found.LicenseShortName,
    licenseUrl: found.LicenseUrl || null,
    width: Number(found.w),
    height: Number(found.h),
    ...(found.Restrictions ? { restrictions: found.Restrictions } : {}),
  };
  console.log(id, found.LicenseShortName);
}
// Photos of generations no longer listed go.
for (const name of readdirSync(imageDir)) {
  if (!(name.replace(/\.webp$/, '') in sources)) rmSync(path.join(imageDir, name));
}
writeFileSync(
  path.join(dataDir, 'model-images.json'),
  `${JSON.stringify({ retrieved: new Date().toISOString().slice(0, 10), images }, null, 2)}\n`,
);
