import helmet from '@fastify/helmet';
import { LISTING_IMAGE_HOSTS } from '@kaufcheck/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AppConfig } from '../config/env';
import { AppError } from '../lib/errors';

const STATE_CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
/** Endpoints called by third parties (signature-verified instead). */
const CSRF_EXEMPT = new Set(['/api/billing/webhook']);

export async function registerSecurity(app: FastifyInstance, config: AppConfig): Promise<void> {
  // HSTS and request upgrades only make sense when the site is served over HTTPS.
  const https = config.isProduction && config.secureCookies;
  const imageSources = config.showListingPhotos
    ? LISTING_IMAGE_HOSTS.map((host) => `https://${host}`)
    : [];
  await app.register(helmet, {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        // React sets inline styles for dynamic values (e.g. progress widths).
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', ...imageSources],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        objectSrc: ["'none'"],
        ...(https ? { upgradeInsecureRequests: [] } : {}),
      },
    },
    crossOriginEmbedderPolicy: false,
    // Listing photos are loaded from the Kleinanzeigen CDN without sending our URL.
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: https ? { maxAge: 31_536_000, includeSubDomains: true } : false,
  });

  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header(
      'permissions-policy',
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
    );
    return payload;
  });

  /**
   * CSRF protection for cookie-authenticated requests: state-changing
   * requests must come from our own origin. Browsers always send `Origin`
   * on cross-site POSTs; `Sec-Fetch-Site` covers the remaining cases. Only
   * JSON bodies are parsed, so classic form posts are rejected with 415.
   */
  const allowed = new Set(config.allowedOrigins);
  app.addHook('onRequest', (request, _reply, done) => {
    const violation = csrfViolation(request, allowed);
    if (violation) done(violation);
    else done();
  });
}

function csrfViolation(request: FastifyRequest, allowed: ReadonlySet<string>): AppError | null {
  if (!STATE_CHANGING.has(request.method)) return null;
  const path = request.url.split('?')[0] ?? '';
  if (!path.startsWith('/api/') || CSRF_EXEMPT.has(path)) return null;
  const origin = request.headers.origin;
  if (origin !== undefined) {
    return allowed.has(origin)
      ? null
      : new AppError('FORBIDDEN', { internalReason: 'origin_not_allowed' });
  }
  if (request.headers['sec-fetch-site'] === 'cross-site') {
    return new AppError('FORBIDDEN', { internalReason: 'cross_site_request' });
  }
  return null;
}
