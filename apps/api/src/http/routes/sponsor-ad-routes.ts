import { AD_PLACEMENTS, type AdPlacement, type SponsorAdResponse } from '@kaufcheck/shared';
import type { FastifyInstance } from 'fastify';
import type { Services } from '../../container';
import { AppError } from '../../lib/errors';
import { trackingOptOut } from '../request-context';

export function sponsorAdRoutes(app: FastifyInstance, services: Services): void {
  const { sponsorAds } = services;

  // Each page view asks once; the answer is counted, so it must not be cached.
  app.get<{ Params: { placement: string } }>(
    '/api/sponsor-ads/:placement',
    async (request, reply): Promise<SponsorAdResponse> => {
      const { placement } = request.params;
      if (!(AD_PLACEMENTS as readonly string[]).includes(placement))
        throw new AppError('NOT_FOUND', { message: 'Diesen Werbeplatz gibt es nicht.' });
      reply.header('cache-control', 'no-store');
      return { ad: await sponsorAds.pick(placement as AdPlacement, request.actor) };
    },
  );

  // The click goes through our server, so that it is counted without anything in the browser.
  // Outside /api/ there is no session context: only the opt-out signals matter here.
  app.get<{ Params: { id: string } }>('/go/:id', async (request, reply) => {
    const target = /^[a-z0-9-]{1,40}$/.test(request.params.id)
      ? await sponsorAds.click(request.params.id, !trackingOptOut(request))
      : null;
    reply.header('cache-control', 'no-store');
    reply.header('x-robots-tag', 'noindex');
    if (!target) return reply.status(404).type('text/plain; charset=utf-8').send('Nicht gefunden');
    return reply.redirect(target, 302);
  });
}
