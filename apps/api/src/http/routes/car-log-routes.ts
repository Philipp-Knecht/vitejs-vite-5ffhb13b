import { CarLogEntryInputSchema } from '@kaufcheck/shared';
import type { FastifyInstance } from 'fastify';
import type { Services } from '../../container';
import { parseInput } from '../errors';

export function carLogRoutes(app: FastifyInstance, services: Services): void {
  const { carLog } = services;

  app.get<{ Params: { carId: string } }>('/api/owned-cars/:carId/log', async (request) =>
    carLog.list(request.actor, request.params.carId),
  );

  app.post<{ Params: { carId: string } }>('/api/owned-cars/:carId/log', async (request, reply) => {
    const body = parseInput(CarLogEntryInputSchema, request.body);
    return reply.status(201).send(await carLog.add(request.actor, request.params.carId, body));
  });

  app.put<{ Params: { carId: string; id: string } }>(
    '/api/owned-cars/:carId/log/:id',
    async (request) => {
      const body = parseInput(CarLogEntryInputSchema, request.body);
      return carLog.update(request.actor, request.params.carId, request.params.id, body);
    },
  );

  app.delete<{ Params: { carId: string; id: string } }>(
    '/api/owned-cars/:carId/log/:id',
    async (request, reply) => {
      await carLog.remove(request.actor, request.params.carId, request.params.id);
      return reply.status(204).send();
    },
  );
}
