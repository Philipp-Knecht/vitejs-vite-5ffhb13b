import { normalizeDutchPlate, type RdwLookupResponse } from '@kaufcheck/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Services } from '../../container';
import { AppError } from '../../lib/errors';

const BodySchema = z.object({ plate: z.string().max(20) });

export function rdwRoutes(app: FastifyInstance, services: Services): void {
  // The registration number goes to the RDW from our server, so the RDW never sees the visitor.
  // It travels in the body, so that it is in no log of a URL (ours, the host's, the CDN's).
  app.post(
    '/api/rdw',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply): Promise<RdwLookupResponse> => {
      const body = BodySchema.safeParse(request.body);
      const plate = body.success ? normalizeDutchPlate(body.data.plate) : null;
      if (!plate)
        throw new AppError('VALIDATION_ERROR', {
          message: 'Bitte gib ein niederländisches Kennzeichen ein, zum Beispiel AB-123-C.',
        });
      reply.header('cache-control', 'private, no-store');
      return services.rdw.lookup(plate);
    },
  );
}
