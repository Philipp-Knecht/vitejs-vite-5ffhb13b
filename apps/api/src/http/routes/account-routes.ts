import {
  DeleteAccountRequestSchema,
  LoginRequestSchema,
  PasswordResetConfirmSchema,
  PasswordResetRequestSchema,
  RegisterRequestSchema,
  type MeDto,
} from '@kaufcheck/shared';
import type { FastifyInstance } from 'fastify';
import type { Services } from '../../container';
import { AppError } from '../../lib/errors';
import { parseInput } from '../errors';
import { clearSessionCookie, setSessionCookie } from '../request-context';

export function accountRoutes(app: FastifyInstance, services: Services): void {
  const { auth, usage, billing, account, config } = services;
  const cookieOptions = { secure: config.secureCookies };

  app.get('/api/me', async (request, reply): Promise<MeDto> => {
    const { actor } = request;
    reply.header('cache-control', 'private, no-store');
    const [currentUsage, subscription] = await Promise.all([
      usage.get(actor),
      actor.userId ? billing.getSubscription(actor.userId) : Promise.resolve(null),
    ]);
    const user = actor.userId
      ? await services.db.user.findUnique({
          where: { id: actor.userId },
          select: { id: true, email: true, createdAt: true },
        })
      : null;
    return {
      user: user
        ? { id: user.id, email: user.email, createdAt: user.createdAt.toISOString() }
        : null,
      plan: actor.plan,
      entitlements: actor.entitlements,
      usage: currentUsage,
      subscription,
    };
  });

  const authLimit = { rateLimit: { max: 10, timeWindow: '15 minutes' } };

  app.post(
    '/api/auth/register',
    { config: { rateLimit: { max: 5, timeWindow: '1 hour' } } },
    async (request, reply) => {
      const body = parseInput(RegisterRequestSchema, request.body);
      const session = await auth.register(body.email, body.password, request.actor.anonymousId);
      setSessionCookie(reply, session.token, session.expiresAt, cookieOptions);
      return reply.status(201).send({ user: { id: session.user.id, email: session.user.email } });
    },
  );

  app.post('/api/auth/login', { config: authLimit }, async (request, reply) => {
    const body = parseInput(LoginRequestSchema, request.body);
    const session = await auth.login(body.email, body.password, request.actor.anonymousId);
    setSessionCookie(reply, session.token, session.expiresAt, cookieOptions);
    return { user: { id: session.user.id, email: session.user.email } };
  });

  app.post('/api/auth/logout', async (request, reply) => {
    if (request.sessionToken) await auth.logout(request.sessionToken);
    clearSessionCookie(reply, cookieOptions);
    return reply.status(204).send();
  });

  app.post('/api/auth/password-reset/request', { config: authLimit }, async (request, reply) => {
    const body = parseInput(PasswordResetRequestSchema, request.body);
    await auth.requestPasswordReset(body.email);
    // Same answer whether or not an account exists.
    return reply.status(202).send({ ok: true });
  });

  app.post('/api/auth/password-reset/confirm', { config: authLimit }, async (request, reply) => {
    const body = parseInput(PasswordResetConfirmSchema, request.body);
    await auth.confirmPasswordReset(body.token, body.password);
    return reply.status(204).send();
  });

  app.delete('/api/account', { config: authLimit }, async (request, reply) => {
    const userId = request.actor.userId;
    if (!userId) throw new AppError('UNAUTHENTICATED');
    const body = parseInput(DeleteAccountRequestSchema, request.body);
    await account.deleteAccount(userId, body.password);
    clearSessionCookie(reply, cookieOptions);
    return reply.status(204).send();
  });
}
