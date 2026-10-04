import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '../config/env';

/** Render's default address, which stays reachable after a custom domain is added. */
const RENDER_HOST = /\.onrender\.com$/i;
const API_PATH = /^\/api(?:[/?]|$)/;

/**
 * Once PUBLIC_SITE_URL names a custom domain, pages requested under the
 * onrender.com address are redirected there permanently, keeping path and
 * query: search engines and Google AdSense see a single site, and old links
 * keep working. API requests (health check, Stripe webhook) are answered
 * under every address.
 */
export function redirectToPublicSite(app: FastifyInstance, config: AppConfig): void {
  const site = new URL(config.publicSiteUrl);
  if (RENDER_HOST.test(site.hostname)) return;
  app.addHook('onRequest', async (request, reply) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') return;
    if (!RENDER_HOST.test(request.hostname)) return;
    // Only paths ("/…"), so the target can never point to another host.
    if (!request.url.startsWith('/') || API_PATH.test(request.url)) return;
    return reply.redirect(`${site.origin}${request.url}`, 301);
  });
}
