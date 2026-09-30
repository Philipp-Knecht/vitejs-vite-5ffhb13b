import {
  AnalyzeExampleRequestSchema,
  AnalyzeTextRequestSchema,
  AnalyzeUrlRequestSchema,
  type AnalysisListResponseSchema,
} from '@kaufcheck/shared';
import type { FastifyInstance } from 'fastify';
import type { z } from 'zod';
import type { Services } from '../../container';
import { AppError } from '../../lib/errors';
import { respondWithAnalysis } from '../analysis-stream';
import { parseInput } from '../errors';
import { ensureAnonymousId } from '../request-context';

export function listingRoutes(app: FastifyInstance, services: Services): void {
  const { analyses, config } = services;
  const cookieOptions = { secure: config.secureCookies };
  const analyzeLimit = { rateLimit: { max: config.limits.analyzeRatePerMinute, timeWindow: '1 minute' } };

  app.post('/api/listings/analyze', { config: { ...analyzeLimit, compress: false } }, async (request, reply) => {
    const body = parseInput(AnalyzeUrlRequestSchema, request.body);
    ensureAnonymousId(request, reply, cookieOptions);
    return respondWithAnalysis(request, reply, (ctx) =>
      analyses.run({ kind: 'url', url: body.url }, { ...ctx, actor: request.actor }),
    );
  });

  app.post('/api/listings/analyze-text', { config: { ...analyzeLimit, compress: false } }, async (request, reply) => {
    const body = parseInput(AnalyzeTextRequestSchema, request.body);
    ensureAnonymousId(request, reply, cookieOptions);
    return respondWithAnalysis(request, reply, (ctx) =>
      analyses.run({ kind: 'text', text: body.text, url: body.url }, { ...ctx, actor: request.actor }),
    );
  });

  app.post('/api/listings/analyze-example', { config: { ...analyzeLimit, compress: false } }, async (request, reply) => {
    const body = parseInput(AnalyzeExampleRequestSchema, request.body);
    ensureAnonymousId(request, reply, cookieOptions);
    return respondWithAnalysis(request, reply, (ctx) =>
      analyses.run({ kind: 'example', exampleId: body.exampleId }, { ...ctx, actor: request.actor }),
    );
  });

  app.get<{ Params: { id: string } }>('/api/analyses/:id', async (request, reply) => {
    const dto = await analyses.analyses.findDto(request.params.id, request.actor.userId);
    if (!dto) throw new AppError('NOT_FOUND', { message: 'Diese Analyse gibt es nicht (mehr).' });
    reply.header('cache-control', 'private, no-store');
    // Result pages are private links and must not be indexed.
    reply.header('x-robots-tag', 'noindex');
    return dto;
  });

  app.get('/api/analyses', async (request): Promise<z.infer<typeof AnalysisListResponseSchema>> => {
    const { actor } = request;
    if (!actor.userId) throw new AppError('UNAUTHENTICATED');
    if (!actor.entitlements.history) {
      throw new AppError('PLAN_LIMIT_REACHED', { message: 'Der Verlauf aller Analysen ist in KaufCheck Pro enthalten.' });
    }
    return { items: await analyses.analyses.listForUser(actor.userId) };
  });
}
