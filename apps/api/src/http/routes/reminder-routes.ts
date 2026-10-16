import {
  ReminderConfirmRequestSchema,
  ReminderInputSchema,
  ReminderUnsubscribeRequestSchema,
} from '@kaufcheck/shared';
import type { FastifyInstance } from 'fastify';
import type { Services } from '../../container';
import { parseInput } from '../errors';

export function reminderRoutes(app: FastifyInstance, services: Services): void {
  const { reminders } = services;

  app.get<{ Params: { carId: string } }>('/api/owned-cars/:carId/reminders', async (request) =>
    reminders.list(request.actor, request.params.carId),
  );

  app.put<{ Params: { carId: string; kind: string } }>(
    '/api/owned-cars/:carId/reminders/:kind',
    async (request) => {
      const body = parseInput(ReminderInputSchema, request.body);
      return reminders.update(request.actor, request.params.carId, request.params.kind, body);
    },
  );

  app.post('/api/reminders/confirmation', async (request, reply) => {
    await reminders.requestConfirmation(request.actor);
    return reply.status(204).send();
  });

  app.post('/api/reminders/confirm', async (request, reply) => {
    const { token } = parseInput(ReminderConfirmRequestSchema, request.body);
    await reminders.confirm(token);
    return reply.status(204).send();
  });

  /**
   * Unsubscribing: from the page behind the e-mail link (JSON) and as the
   * one-click POST of RFC 8058, which mail providers send form-encoded with
   * the id and token in the URL, without cookies.
   */
  app.register((scope, _options, done) => {
    scope.addContentTypeParser(
      'application/x-www-form-urlencoded',
      { parseAs: 'string', bodyLimit: 1024 },
      (_request, _body, parsed) => {
        parsed(null, {});
      },
    );
    scope.post<{ Querystring: { r?: string; t?: string } }>(
      '/api/reminders/unsubscribe',
      async (request, reply) => {
        const body =
          request.query.r !== undefined
            ? { reminder: request.query.r, token: request.query.t ?? '' }
            : request.body;
        const { reminder, token } = parseInput(ReminderUnsubscribeRequestSchema, body);
        await reminders.unsubscribe(reminder, token);
        return reply.status(204).send();
      },
    );
    done();
  });
}
