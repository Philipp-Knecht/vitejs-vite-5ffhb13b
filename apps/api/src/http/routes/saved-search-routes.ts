import { SaveSearchRequestSchema } from '@kaufcheck/shared';
import type { FastifyInstance } from 'fastify';
import type { Services } from '../../container';
import { parseInput } from '../errors';

export function savedSearchRoutes(app: FastifyInstance, services: Services): void {
  const { savedSearches } = services;

  app.get('/api/saved-searches', async (request) => savedSearches.list(request.actor));

  app.post('/api/saved-searches', async (request, reply) => {
    const body = parseInput(SaveSearchRequestSchema, request.body);
    const saved = await savedSearches.save(request.actor, body.name, body.query);
    return reply.status(201).send(saved);
  });

  app.delete<{ Params: { id: string } }>('/api/saved-searches/:id', async (request, reply) => {
    await savedSearches.remove(request.actor, request.params.id);
    return reply.status(204).send();
  });
}
