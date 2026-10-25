import { PassThrough } from 'node:stream';
import { ChatRequestSchema, NDJSON_CONTENT_TYPE, type ChatStreamEvent } from '@kaufcheck/shared';
import type { FastifyInstance } from 'fastify';
import type { Services } from '../../container';
import { AppError, isAppError } from '../../lib/errors';
import { clientAddress } from '../client-address';
import { parseInput } from '../errors';
import { ensureAnonymousId } from '../request-context';

/**
 * The chat assistant. The conversation comes in the body (never in a URL, so
 * no log holds it) and the answer streams back as NDJSON. Nothing is stored
 * but the daily count.
 */
export function chatRoutes(app: FastifyInstance, services: Services): void {
  const { chat, config } = services;
  app.post(
    '/api/chat',
    {
      bodyLimit: 256 * 1024,
      config: {
        rateLimit: { max: config.chat.ratePerMinute, timeWindow: '1 minute' },
        compress: false,
      },
    },
    async (request, reply) => {
      if (!chat) {
        throw new AppError('SERVICE_UNAVAILABLE', {
          message: 'Der Assistent ist zurzeit nicht verfügbar.',
        });
      }
      const body = parseInput(ChatRequestSchema, request.body);
      ensureAnonymousId(request, reply, { secure: config.secureCookies });
      // Over a daily limit, the answer is a plain 429 before anything streams.
      const reservation = await chat.reserve(
        request.actor,
        clientAddress(request, config.clientIpHeader),
      );

      const controller = new AbortController();
      reply.raw.on('close', () => {
        if (!reply.raw.writableFinished) controller.abort();
      });
      const stream = new PassThrough();
      const emit = (event: ChatStreamEvent) => {
        if (!stream.writableEnded) stream.write(`${JSON.stringify(event)}\n`);
      };
      chat
        .run(body, reservation, { actor: request.actor, signal: controller.signal, emit })
        .catch((error: unknown) => {
          const appError = isAppError(error) ? error : new AppError('INTERNAL_ERROR');
          if (appError.code === 'REQUEST_ABORTED') return;
          if (appError.status >= 500)
            request.log.warn({ err: error, reason: appError.internalReason }, 'chat failed');
          emit({ type: 'error', error: appError.toApiError(request.id) });
        })
        .finally(() => stream.end());

      return reply
        .header('content-type', `${NDJSON_CONTENT_TYPE}; charset=utf-8`)
        .header('cache-control', 'no-store')
        .header('x-accel-buffering', 'no')
        .send(stream);
    },
  );
}
