import { OwnedCarInputSchema } from '@kaufcheck/shared';
import type { FastifyInstance } from 'fastify';
import type { Services } from '../../container';
import { parseInput } from '../errors';

export function ownedCarRoutes(app: FastifyInstance, services: Services): void {
  const { ownedCars } = services;

  app.get('/api/owned-cars', async (request) => ownedCars.list(request.actor));

  app.post('/api/owned-cars', async (request, reply) => {
    const body = parseInput(OwnedCarInputSchema, request.body);
    return reply.status(201).send(await ownedCars.add(request.actor, body));
  });

  app.put<{ Params: { id: string } }>('/api/owned-cars/:id', async (request) => {
    const body = parseInput(OwnedCarInputSchema, request.body);
    return ownedCars.update(request.actor, request.params.id, body);
  });

  app.delete<{ Params: { id: string } }>('/api/owned-cars/:id', async (request, reply) => {
    await ownedCars.remove(request.actor, request.params.id);
    return reply.status(204).send();
  });
}
