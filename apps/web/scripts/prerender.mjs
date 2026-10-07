/**
 * Prerenders the static pages after `vite build` (client) and
 * `vite build --ssr` (server entry):
 *  - dist/_pages/<path>/index.html – full HTML per static page (hydrated in the browser),
 *  - dist/index.html – empty SPA shell for client-rendered routes (noindex),
 *  - dist/sitemap.xml and dist/robots.txt.
 * Canonical URLs use PUBLIC_SITE_URL, which must be set for production builds.
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const ssrDir = path.join(root, 'dist-ssr');

try {
  process.loadEnvFile(path.resolve(root, '../../.env'));
} catch {
  // No .env file – use the process environment.
}
const siteUrl = (process.env.PUBLIC_SITE_URL ?? 'http://localhost:5173').replace(/\/+$/, '');
const MODIFIED = '2026-09-30';

const { render, STATIC_PAGES, MODEL_PAGES } = await import(
  pathToFileURL(path.join(ssrDir, 'entry-server.js')).href
);
const template = await readFile(path.join(dist, 'index.html'), 'utf8');
if (!template.includes('<!--app-head-->') || !template.includes('<!--app-html-->')) {
  throw new Error('index.html is missing the <!--app-head--> or <!--app-html--> marker');
}

const escapeHtml = (value) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
const jsonLd = (data) =>
  `<script type="application/ld+json">${JSON.stringify(data).replaceAll('<', '\\u003c')}</script>`;
const pageUrl = (pagePath) => `${siteUrl}${pagePath}`;

const GUIDES = new Set([
  '/gebrauchtwagen-kaufen',
  '/gebrauchtwagen-checkliste',
  '/auto-besichtigung-checkliste',
]);

function structuredData(pagePath, meta) {
  const organization = { '@type': 'Organization', name: 'KaufCheck', url: `${siteUrl}/` };
  const model = MODEL_PAGES.find((page) => page.path === pagePath);
  if (model) {
    return [
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'KaufCheck', item: `${siteUrl}/` },
          { '@type': 'ListItem', position: 2, name: 'Modelle', item: pageUrl('/modelle') },
          { '@type': 'ListItem', position: 3, name: model.name, item: pageUrl(pagePath) },
        ],
      },
    ];
  }
  if (pagePath === '/') {
    return [
      {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'KaufCheck',
        url: `${siteUrl}/`,
        description: meta.description,
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'Web',
        inLanguage: 'de-DE',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
      },
    ];
  }
  if (GUIDES.has(pagePath)) {
    return [
      {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: meta.title.replace(/ \| KaufCheck$/, ''),
        description: meta.description,
        inLanguage: 'de-DE',
        dateModified: MODIFIED,
        mainEntityOfPage: pageUrl(pagePath),
        author: organization,
        publisher: organization,
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'KaufCheck', item: `${siteUrl}/` },
          {
            '@type': 'ListItem',
            position: 2,
            name: meta.title.replace(/ \| KaufCheck$/, ''),
            item: pageUrl(pagePath),
          },
        ],
      },
    ];
  }
  return [];
}

function headTags(page, meta) {
  const url = page.path === '/' ? `${siteUrl}/` : pageUrl(page.path);
  const tags = [
    `<meta name="description" content="${escapeHtml(meta.description)}" />`,
    page.indexable
      ? `<link rel="canonical" href="${escapeHtml(url)}" />`
      : '<meta name="robots" content="noindex" />',
    '<meta property="og:type" content="website" />',
    '<meta property="og:site_name" content="KaufCheck" />',
    '<meta property="og:locale" content="de_DE" />',
    `<meta property="og:title" content="${escapeHtml(meta.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(meta.description)}" />`,
    `<meta property="og:url" content="${escapeHtml(url)}" />`,
    `<meta property="og:image" content="${escapeHtml(siteUrl)}/og-image.png" />`,
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    '<meta property="og:image:alt" content="KaufCheck – Gebraucht kaufen. Besser entscheiden." />',
    '<meta name="twitter:card" content="summary_large_image" />',
    ...structuredData(page.path, meta).map(jsonLd),
  ];
  return tags.join('\n    ');
}

const pages = [...STATIC_PAGES, ...MODEL_PAGES];
for (const page of pages) {
  const { html, meta, data } = render(page.path);
  // Model pages embed their data, so the browser hydrates the same content.
  const pageData = data
    ? `<script id="page-data" type="application/json">${JSON.stringify(data).replaceAll('<', '\\u003c')}</script>`
    : '';
  const document = template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(meta.title)}</title>`)
    .replace('<!--app-head-->', headTags(page, meta))
    .replace(
      '<div id="root"><!--app-html--></div>',
      `<div id="root" data-prerendered="true">${html}</div>${pageData}`,
    );
  const target = path.join(
    dist,
    '_pages',
    page.path === '/' ? '' : page.path.slice(1),
    'index.html',
  );
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, document);
}

// Client-rendered routes (results, account pages) are served with this empty shell.
const shell = template
  .replace('<!--app-head-->', '<meta name="robots" content="noindex" />')
  .replace('<!--app-html-->', '');
await writeFile(path.join(dist, 'index.html'), shell);

const indexable = pages.filter((page) => page.indexable);
const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...indexable.map(
    (page) =>
      `  <url><loc>${escapeHtml(page.path === '/' ? `${siteUrl}/` : pageUrl(page.path))}</loc><lastmod>${MODIFIED}</lastmod></url>`,
  ),
  '</urlset>',
  '',
].join('\n');
await writeFile(path.join(dist, 'sitemap.xml'), sitemap);

// Result pages are private links; the API is not for crawlers.
const robots = [
  'User-agent: *',
  'Disallow: /api/',
  'Disallow: /analyse/',
  '',
  `Sitemap: ${siteUrl}/sitemap.xml`,
  '',
].join('\n');
await writeFile(path.join(dist, 'robots.txt'), robots);

await rm(ssrDir, { recursive: true, force: true });
console.log(`Prerendered ${pages.length} pages (${MODEL_PAGES.length} model pages) for ${siteUrl}`);
