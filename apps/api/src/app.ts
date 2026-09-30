import { randomUUID } from 'node:crypto';
import compress from '@fastify/compress';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import type { AppConfig } from './config/env';
import { createServices, type ServiceOverrides, type Services } from './container';
import { registerErrorHandling } from './http/errors';
import { requestContextPlugin } from './http/request-context';
import { accountRoutes } from './http/routes/account-routes';
import { listingRoutes } from './http/routes/listing-routes';
import { savedListingRoutes } from './http/routes/saved-listing-routes';
import { systemRoutes } from './http/routes/system-routes';
import { registerSecurity } from './http/security';
import { registerWeb } from './http/web';
import { AppError } from './lib/errors';
import { loggerOptions } from './lib/logger';

const REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;

declare module 'fastify' {
  interface FastifyContextConfig {
    compress?: false;
  }
}

export interface BuiltApp {
  app: FastifyInstance;
  services: Services;
}

export async function buildApp(
  config: AppConfig,
  overrides: ServiceOverrides = {},
): Promise<BuiltApp> {
  const app = Fastify({
    logger: loggerOptions(config),
    // A hop count trusts that many proxies in front of the server (e.g. 1 behind a load balancer).
    trustProxy:
      typeof config.trustProxy === 'number'
        ? (_address: string, hop: number) => hop < (config.trustProxy as number)
        : config.trustProxy,
    bodyLimit: 128 * 1024,
    genReqId: (request) => {
      const header = request.headers['x-request-id'];
      return typeof header === 'string' && REQUEST_ID.test(header) ? header : randomUUID();
    },
  });

  const services = createServices(config, app.log, overrides);
  app.addHook('onClose', async () => {
    await services.db.$disconnect();
  });
  app.addHook('onSend', async (request, reply, payload) => {
    reply.header('x-request-id', request.id);
    return payload;
  });

  registerErrorHandling(app);
  await registerSecurity(app, config);
  await app.register(cookie, { secret: config.cookieSecret });
  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: '1 minute',
    // The error is handled by the common error handler (RATE_LIMITED + Retry-After).
    errorResponseBuilder: (_request, context) =>
      new AppError('RATE_LIMITED', {
        details: { retryAfterSeconds: Math.ceil(context.ttl / 1000) },
      }),
  });
  await app.register(compress, { global: true, threshold: 1024, encodings: ['br', 'gzip'] });
  await app.register(requestContextPlugin, { services });

  systemRoutes(app, services);
  accountRoutes(app, services);
  listingRoutes(app, services);
  savedListingRoutes(app, services);

  const servingWeb = await registerWeb(app, config);
  if (!servingWeb) {
    app.setNotFoundHandler((request, reply) =>
      reply
        .status(404)
        .send({ error: { code: 'NOT_FOUND', message: 'Nicht gefunden.', requestId: request.id } }),
    );
  }
  return { app, services };
}
