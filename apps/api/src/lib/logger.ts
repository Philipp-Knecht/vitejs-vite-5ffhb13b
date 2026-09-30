import type { FastifyServerOptions } from 'fastify';
import type { AppConfig } from '../config/env';

/**
 * Structured JSON logs. Request logs contain method, route path (no query
 * string), status and duration – never cookies, auth headers, IPs, request
 * bodies or listing texts.
 */
export function loggerOptions(config: AppConfig): FastifyServerOptions['logger'] {
  return {
    level: config.logLevel,
    base: { service: 'kaufcheck-api', env: config.env },
    redact: {
      paths: [
        'req.headers.cookie',
        'req.headers.authorization',
        'res.headers["set-cookie"]',
        '*.password',
        '*.passwordHash',
        '*.token',
        '*.apiKey',
        '*.text',
        '*.description',
      ],
      censor: '[redacted]',
    },
    serializers: {
      req(request: { method: string; url: string; id: string }) {
        return { method: request.method, path: request.url.split('?')[0], requestId: request.id };
      },
      res(reply: { statusCode: number }) {
        return { statusCode: reply.statusCode };
      },
    },
  };
}
