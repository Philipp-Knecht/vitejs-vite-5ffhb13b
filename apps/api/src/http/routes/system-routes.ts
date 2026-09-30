import { AnalyticsEventRequestSchema, type PublicConfig } from '@kaufcheck/shared';
import type { FastifyInstance } from 'fastify';
import { AnalyticsService } from '../../application/analytics-service';
import type { AppConfig } from '../../config/env';
import type { Services } from '../../container';
import { AppError } from '../../lib/errors';
import { parseInput } from '../errors';

export function systemRoutes(app: FastifyInstance, services: Services): void {
  const { config, db, plans, enricher, billing, auth, analytics } = services;

  app.get('/api/health', { config: { rateLimit: false } }, async (_request, reply) => {
    try {
      await db.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'ok' };
    } catch {
      return reply.status(503).send({ status: 'degraded', database: 'unavailable' });
    }
  });

  app.get('/api/config', async (_request, reply): Promise<PublicConfig> => {
    reply.header('cache-control', 'public, max-age=60');
    return {
      features: {
        urlRetrieval: services.retriever.mode !== 'off',
        listingPhotos: config.showListingPhotos,
        ai: enricher !== null,
        aiProvider: realAiProvider(config.ai.provider, enricher?.isMock ?? true),
        aiIsMock: enricher?.isMock ?? false,
        photoAnalysis: enricher?.photoAnalysisAvailable ?? false,
        billing: billing.configured,
        passwordReset: auth.passwordResetEnabled,
        analytics: analytics.isEnabled,
      },
      plans,
      pro: { priceLabel: config.proPriceLabel },
      privacy: {
        hosting: config.hostingProvider,
        anonymousRetentionDays: config.anonRetentionDays,
      },
    };
  });

  app.post(
    '/api/events',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request, reply) => {
      if (!analytics.isEnabled) return reply.status(204).send();
      const raw = (request.body ?? {}) as { name?: unknown; props?: Record<string, unknown> };
      const body = parseInput(AnalyticsEventRequestSchema, {
        name: raw.name,
        props: AnalyticsService.sanitize(raw.props),
      });
      analytics.track(body.name, body.props, request.actor);
      return reply.status(204).send();
    },
  );

  app.post('/api/billing/checkout', async (request) => {
    const { actor } = request;
    if (!actor.userId || !actor.email) {
      throw new AppError('UNAUTHENTICATED', { message: 'Bitte melde dich an, um Pro zu buchen.' });
    }
    if (actor.plan === 'pro')
      throw new AppError('VALIDATION_ERROR', { message: 'Du hast bereits KaufCheck Pro.' });
    return billing.createCheckoutSession({
      userId: actor.userId,
      email: actor.email,
      successUrl: `${config.publicSiteUrl}/konto?checkout=erfolgreich`,
      cancelUrl: `${config.publicSiteUrl}/pro?checkout=abgebrochen`,
    });
  });

  app.post('/api/billing/portal', async (request) => {
    const { actor } = request;
    if (!actor.userId) throw new AppError('UNAUTHENTICATED');
    return billing.createPortalSession({
      userId: actor.userId,
      returnUrl: `${config.publicSiteUrl}/konto`,
    });
  });

  // Stripe needs the raw body to verify the signature.
  app.register((scope, _options, done) => {
    scope.addContentTypeParser(
      'application/json',
      { parseAs: 'buffer', bodyLimit: 1024 * 1024 },
      (_request, body, parsed) => {
        parsed(null, body);
      },
    );
    scope.post('/api/billing/webhook', { config: { rateLimit: false } }, async (request, reply) => {
      const signature = request.headers['stripe-signature'];
      await billing.handleWebhook(
        request.body as Buffer,
        typeof signature === 'string' ? signature : undefined,
      );
      return reply.status(200).send({ received: true });
    });
    done();
  });
}

function realAiProvider(
  provider: AppConfig['ai']['provider'],
  isMock: boolean,
): 'anthropic' | 'openai' | null {
  return !isMock && (provider === 'anthropic' || provider === 'openai') ? provider : null;
}
