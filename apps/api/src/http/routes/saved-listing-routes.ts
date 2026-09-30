import {
  ComparisonRequestSchema,
  SaveListingRequestSchema,
  UpdateSavedListingRequestSchema,
} from '@kaufcheck/shared';
import type { FastifyInstance } from 'fastify';
import type { Services } from '../../container';
import { respondWithAnalysis } from '../analysis-stream';
import { parseInput } from '../errors';

export function savedListingRoutes(app: FastifyInstance, services: Services): void {
  const { savedListings, config } = services;

  app.get('/api/saved-listings', async (request) => savedListings.list(request.actor));

  app.post('/api/saved-listings', async (request, reply) => {
    const body = parseInput(SaveListingRequestSchema, request.body);
    const saved = await savedListings.save(request.actor, body.analysisId, body.title);
    return reply.status(201).send(saved);
  });

  app.patch<{ Params: { id: string } }>('/api/saved-listings/:id', async (request) => {
    const body = parseInput(UpdateSavedListingRequestSchema, request.body);
    return savedListings.rename(request.actor, request.params.id, body.title);
  });

  app.delete<{ Params: { id: string } }>('/api/saved-listings/:id', async (request, reply) => {
    await savedListings.remove(request.actor, request.params.id);
    return reply.status(204).send();
  });

  app.post<{ Params: { id: string } }>(
    '/api/saved-listings/:id/reanalyze',
    {
      config: {
        rateLimit: { max: config.limits.analyzeRatePerMinute, timeWindow: '1 minute' },
        compress: false,
      },
    },
    async (request, reply) =>
      respondWithAnalysis(request, reply, (ctx) =>
        savedListings.reanalyze(request.actor, request.params.id, ctx),
      ),
  );

  app.post('/api/comparisons', async (request) => {
    const body = parseInput(ComparisonRequestSchema, request.body);
    return savedListings.compare(request.actor, body.savedListingIds);
  });
}
