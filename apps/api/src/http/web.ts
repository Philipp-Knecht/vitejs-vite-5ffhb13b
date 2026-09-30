import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import fastifyStatic from '@fastify/static';
import { isAppRoute } from '@kaufcheck/shared';
import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '../config/env';

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

  app.setNotFoundHandler((request, reply) => {
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
    reply.header('cache-control', 'no-cache');
    reply.type('text/html; charset=utf-8');
    return reply.status(isAppRoute(decoded) ? 200 : 404).send(createReadStream(file));
  });
  return true;
}
