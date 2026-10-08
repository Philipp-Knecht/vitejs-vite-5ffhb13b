import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, TestClient } from './helpers';

const PAGE = '<!doctype html><html lang="de"><head><title>KaufCheck</title></head></html>';
const RENDER = { host: 'kaufcheck.onrender.com' };
const DOMAIN = 'kaufcheck.example';

describe('Custom domain', () => {
  let webDir: string;

  beforeAll(async () => {
    webDir = await mkdtemp(path.join(tmpdir(), 'kaufcheck-web-'));
    await mkdir(path.join(webDir, '_pages', 'impressum'), { recursive: true });
    await writeFile(path.join(webDir, 'index.html'), PAGE);
    await writeFile(path.join(webDir, '_pages', 'index.html'), PAGE);
    await writeFile(path.join(webDir, '_pages', 'impressum', 'index.html'), PAGE);
    await mkdir(path.join(webDir, '_pages', 'modelle', 'vw-golf'), { recursive: true });
    await writeFile(path.join(webDir, '_pages', 'modelle', 'vw-golf', 'index.html'), PAGE);
    await mkdir(path.join(webDir, 'assets'), { recursive: true });
    await writeFile(path.join(webDir, 'assets', 'index-abc.js'), 'export {};');
  });
  afterAll(() => rm(webDir, { recursive: true, force: true }));

  const web = () => ({ SERVE_WEB: 'true', WEB_DIST_DIR: webDir });

  it('serves generated model pages and a real 404 for unknown models', async () => {
    const built = await createTestApp({ ...web(), PUBLIC_SITE_URL: `https://${DOMAIN}` });
    try {
      const client = new TestClient(built.app);
      expect((await client.get('/modelle/vw-golf', { host: DOMAIN })).statusCode).toBe(200);
      expect((await client.get('/modelle/unbekannt', { host: DOMAIN })).statusCode).toBe(404);
      expect((await client.get('/modelle/../impressum', { host: DOMAIN })).statusCode).toBe(200);
    } finally {
      await built.app.close();
    }
  });

  it('does not count build files against the rate limit', async () => {
    const built = await createTestApp(web());
    try {
      const client = new TestClient(built.app);
      // More than the 300 requests per minute that pages and the API allow.
      for (let index = 0; index < 310; index += 1) {
        expect((await client.get('/assets/index-abc.js')).statusCode).toBe(200);
      }
      expect((await client.get('/impressum')).statusCode).toBe(200);
      expect((await client.get('/api/config')).statusCode).toBe(200);
    } finally {
      await built.app.close();
    }
  });

  it('sends pages under the onrender.com address to the domain', async () => {
    const built = await createTestApp({ ...web(), PUBLIC_SITE_URL: `https://${DOMAIN}` });
    try {
      const client = new TestClient(built.app);
      const page = await client.get('/impressum?von=mail', RENDER);
      expect(page.statusCode).toBe(301);
      expect(page.headers.location).toBe(`https://${DOMAIN}/impressum?von=mail`);
      const head = await built.app.inject({ method: 'HEAD', url: '/', headers: RENDER });
      expect(head.statusCode).toBe(301);
      expect(head.headers.location).toBe(`https://${DOMAIN}/`);

      expect((await client.get('/impressum', { host: DOMAIN })).statusCode).toBe(200);
      // Health checks and the Stripe webhook keep working under the onrender.com address.
      expect((await client.get('/api/health', RENDER)).statusCode).toBe(200);
    } finally {
      await built.app.close();
    }
  });

  it('serves the onrender.com address while it is the public one', async () => {
    const built = await createTestApp({
      ...web(),
      PUBLIC_SITE_URL: 'https://kaufcheck.onrender.com',
    });
    try {
      const client = new TestClient(built.app);
      expect((await client.get('/impressum', RENDER)).statusCode).toBe(200);
    } finally {
      await built.app.close();
    }
  });
});
