import { createReadStream, existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import fastifyStatic from '@fastify/static';
import { isAppRoute } from '@kaufcheck/shared';
import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '../config/env';
import { adsContentSecurityPolicy, createNonce, prepareHtml } from './ads';
import { servedOverHttps } from './security';

/** Directory (inside the web build) with prerendered static pages. */
export const PRERENDERED_DIR = '_pages';

/**
 * Serves the built web app: hashed assets with long-term caching,
 * prerendered pages (from `_pages/`) as static HTML, other client routes
 * via the empty SPA shell and a real 404 status for unknown paths.
 */
export async function registerWeb(app: FastifyInstance, config: AppConfig): Promise<boolean> {
  const root = path.resolve(config.webDistDir);
  const shell = path.join(root, 'index.html');
  if (!config.serveWeb || !existsSync(shell)) return false;

  await app.register(fastifyStatic, {
    root,
    prefix: '/',
    index: false,
    wildcard: false,
    redirect: false,
    // Prerendered pages are only reachable under their canonical paths.
    allowedPath: (pathName) =>
      !pathName.startsWith(`/${PRERENDERED_DIR}/`) && pathName !== '/index.html',
    setHeaders(response, filePath) {
      response.header(
        'cache-control',
        filePath.includes(`${path.sep}assets${path.sep}`)
          ? 'public, max-age=31536000, immutable'
          : 'public, max-age=3600',
      );
    },
  });

  // With AdSense, pages carry the verification tag and – once ads are shown – a nonce per response.
  const html = new Map<string, string>();
  const readHtml = async (file: string) => {
    const cached = html.get(file);
    if (cached !== undefined) return cached;
    const content = await readFile(file, 'utf8');
    html.set(file, content);
    return content;
  };

  app.setNotFoundHandler(async (request, reply) => {
    const pathname = (request.url.split('?')[0] ?? '/').replace(/\/+$/, '') || '/';
    if (pathname.startsWith('/api/') || (request.method !== 'GET' && request.method !== 'HEAD')) {
      return reply
        .status(404)
        .send({ error: { code: 'NOT_FOUND', message: 'Nicht gefunden.', requestId: request.id } });
    }
    // Missing files (e.g. outdated asset hashes) get a plain 404, never the HTML shell.
    if (/\.[a-z0-9]{1,8}$/i.test(pathname)) {
      return reply.status(404).type('text/plain; charset=utf-8').send('Nicht gefunden');
    }
    let decoded: string;
    try {
      decoded = decodeURIComponent(pathname);
    } catch {
      decoded = '/';
    }
    const pagesRoot = path.join(root, PRERENDERED_DIR);
    const prerendered = path.resolve(pagesRoot, `.${decoded}`, 'index.html');
    const insideRoot = prerendered.startsWith(`${pagesRoot}${path.sep}`);
    const file = insideRoot && existsSync(prerendered) ? prerendered : shell;
    reply.type('text/html; charset=utf-8');
    // Prerendered pages exist (model pages are generated from data); other paths must be app routes.
    reply.status(file !== shell || isAppRoute(decoded) ? 200 : 404);
    const { adsense } = config;
    if (!adsense) {
      reply.header('cache-control', 'no-cache');
      return reply.send(createReadStream(file));
    }
    const nonce = adsense.slot ? createNonce() : null;
    if (nonce) {
      reply.header(
        'content-security-policy',
        adsContentSecurityPolicy(nonce, servedOverHttps(config)),
      );
      // A cached copy would carry an outdated nonce.
      reply.header('cache-control', 'no-store');
    } else {
      reply.header('cache-control', 'no-cache');
    }
    return reply.send(prepareHtml(await readHtml(file), { adsenseClient: adsense.client, nonce }));
  });
  return true;
}
