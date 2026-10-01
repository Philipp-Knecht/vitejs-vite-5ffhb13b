import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PublicConfigSchema } from '@kaufcheck/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, TestClient } from './helpers';

const CLIENT = 'ca-pub-1234567890123456';
const PAGE = [
  '<!doctype html>',
  '<html lang="de">',
  '  <head>',
  '    <title>KaufCheck</title>',
  '    <script type="module" crossorigin src="/assets/index-abc.js"></script>',
  '    <link rel="modulepreload" crossorigin href="/assets/vendor-abc.js">',
  '    <link rel="stylesheet" crossorigin href="/assets/index-abc.css">',
  '  </head>',
  '  <body><div id="root"></div></body>',
  '</html>',
].join('\n');

describe('Google AdSense', () => {
  let webDir: string;

  beforeAll(async () => {
    webDir = await mkdtemp(path.join(tmpdir(), 'kaufcheck-web-'));
    await mkdir(path.join(webDir, '_pages', 'impressum'), { recursive: true });
    await writeFile(path.join(webDir, 'index.html'), PAGE);
    await writeFile(path.join(webDir, '_pages', 'index.html'), PAGE);
    await writeFile(path.join(webDir, '_pages', 'impressum', 'index.html'), PAGE);
  });
  afterAll(() => rm(webDir, { recursive: true, force: true }));

  const web = () => ({ SERVE_WEB: 'true', WEB_DIST_DIR: webDir });

  it('stays out entirely without a publisher ID', async () => {
    const built = await createTestApp(web());
    try {
      const client = new TestClient(built.app);
      expect((await client.get('/ads.txt')).statusCode).toBe(404);
      const page = await client.get('/impressum');
      expect(page.body).not.toContain('google-adsense-account');
      expect(String(page.headers['content-security-policy'])).toContain("script-src 'self'");
      expect(PublicConfigSchema.parse((await client.get('/api/config')).json()).ads).toBeNull();
    } finally {
      await built.app.close();
    }
  });

  it('only verifies the site while no ad unit is set', async () => {
    const built = await createTestApp({ ...web(), ADSENSE_CLIENT: CLIENT });
    try {
      const client = new TestClient(built.app);
      const adsTxt = await client.get('/ads.txt');
      expect(adsTxt.statusCode).toBe(200);
      expect(adsTxt.headers['content-type']).toContain('text/plain');
      expect(adsTxt.body).toBe('google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n');

      const page = await client.get('/impressum');
      expect(page.body).toContain(`<meta name="google-adsense-account" content="${CLIENT}" />`);
      expect(page.body).not.toContain('nonce=');
      // No ad script is loaded yet, so the strict policy stays.
      expect(String(page.headers['content-security-policy'])).toContain("script-src 'self'");
      expect(PublicConfigSchema.parse((await client.get('/api/config')).json()).ads).toBeNull();
    } finally {
      await built.app.close();
    }
  });

  it('serves pages with a fresh nonce and Google’s strict policy once ads are on', async () => {
    const built = await createTestApp({
      ...web(),
      ADSENSE_CLIENT: CLIENT,
      ADSENSE_SLOT: '1234567890',
    });
    try {
      const client = new TestClient(built.app);
      const first = await client.get('/');
      const second = await client.get('/meine-angebote');
      expect(first.statusCode).toBe(200);
      expect(second.statusCode).toBe(200);

      const nonceOf = (html: string) => /<script nonce="([^"]+)" type="module"/.exec(html)?.[1];
      const nonce = nonceOf(first.body);
      expect(nonce).toMatch(/^[A-Za-z0-9+/=]{24}$/);
      expect(nonceOf(second.body)).not.toBe(nonce);
      expect(first.body).toContain(`<link nonce="${nonce}" rel="modulepreload"`);
      expect(first.body).not.toContain(`<link nonce="${nonce}" rel="stylesheet"`);

      const csp = String(first.headers['content-security-policy']);
      expect(csp).toContain(`script-src 'nonce-${nonce}' 'strict-dynamic'`);
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("base-uri 'none'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(first.headers['cache-control']).toBe('no-store');

      const config = PublicConfigSchema.parse((await client.get('/api/config')).json());
      expect(config.ads).toEqual({ client: CLIENT, slot: '1234567890' });
      // API responses keep the strict policy.
      expect(
        String((await client.get('/api/health')).headers['content-security-policy']),
      ).toContain("script-src 'self'");
    } finally {
      await built.app.close();
    }
  });
});
