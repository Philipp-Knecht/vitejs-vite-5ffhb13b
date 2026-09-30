import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { Actor } from '../application/actor';
import type { Services } from '../container';
import { randomToken } from '../lib/crypto';

export const SESSION_COOKIE = 'kc_session';
export const ANONYMOUS_COOKIE = 'kc_anon';
const ANONYMOUS_MAX_AGE_S = 400 * 24 * 60 * 60;
const ANONYMOUS_ID = /^[A-Za-z0-9_-]{22}$/;

declare module 'fastify' {
  interface FastifyRequest {
    actor: Actor;
    sessionToken: string | null;
  }
}

export interface CookieOptions {
  secure: boolean;
}

export function setSessionCookie(
  reply: FastifyReply,
  token: string,
  expiresAt: Date,
  options: CookieOptions,
): void {
  reply.setCookie(SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: options.secure,
    expires: expiresAt,
  });
}

export function clearSessionCookie(reply: FastifyReply, options: CookieOptions): void {
  reply.clearCookie(SESSION_COOKIE, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: options.secure,
  });
}

/**
 * The anonymous identifier is only created when a visitor starts an
 * analysis (needed to enforce the free quota), never on page views.
 * It is random, signed and carries no personal information.
 */
export function ensureAnonymousId(
  request: FastifyRequest,
  reply: FastifyReply,
  options: CookieOptions,
): void {
  if (request.actor.userId || request.actor.anonymousId) return;
  const id = randomToken(16);
  reply.setCookie(ANONYMOUS_COOKIE, id, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: options.secure,
    signed: true,
    maxAge: ANONYMOUS_MAX_AGE_S,
  });
  request.actor = { ...request.actor, anonymousId: id };
}

/** Do Not Track (`DNT: 1`) or Global Privacy Control (`Sec-GPC: 1`). */
function trackingOptOut(request: FastifyRequest): boolean {
  return request.headers.dnt === '1' || request.headers['sec-gpc'] === '1';
}

/** Resolves the session and anonymous id for every API request. */
export const requestContextPlugin = fp(
  (app: FastifyInstance, options: { services: Services }) => {
    const { auth, plans, config } = options.services;
    const cookieOptions = { secure: config.secureCookies };
    app.decorateRequest('actor', null as unknown as Actor);
    app.decorateRequest('sessionToken', null);

    app.addHook('onRequest', async (request, reply) => {
      if (!request.url.startsWith('/api/')) return;

      let user = null;
      const token = request.cookies[SESSION_COOKIE] ?? null;
      if (token) {
        const session = await auth.resolveSession(token);
        if (session) {
          user = session.user;
          request.sessionToken = token;
          if (session.refreshed) setSessionCookie(reply, token, session.expiresAt, cookieOptions);
        } else {
          clearSessionCookie(reply, cookieOptions);
        }
      }

      let anonymousId: string | null = null;
      const rawAnonymous = request.cookies[ANONYMOUS_COOKIE];
      if (rawAnonymous) {
        const unsigned = request.unsignCookie(rawAnonymous);
        if (unsigned.valid && unsigned.value && ANONYMOUS_ID.test(unsigned.value))
          anonymousId = unsigned.value;
      }

      const plan = user ? (user.plan === 'PRO' ? 'pro' : 'free') : 'anonymous';
      request.actor = {
        userId: user?.id ?? null,
        email: user?.email ?? null,
        anonymousId,
        plan,
        entitlements: plans[plan],
        trackingAllowed: !trackingOptOut(request),
      };
    });
  },
  { name: 'request-context' },
);
