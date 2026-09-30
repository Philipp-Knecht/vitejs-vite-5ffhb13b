import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PublicConfigSchema } from '@kaufcheck/shared';
import type { BuiltApp } from '../src/app';
import {
  createTestApp,
  errorOf,
  ORIGIN,
  PASTED_LISTING,
  resetDatabase,
  TestClient,
  URLS,
} from './helpers';

describe('HTTP security', () => {
  let built: BuiltApp;

  beforeAll(async () => {
    built = await createTestApp({ ANALYZE_RATE_PER_MINUTE: '3' });
  });
  beforeEach(() => resetDatabase(built.services.db));
  afterAll(() => built.app.close());

  const post = (headers: Record<string, string>, payload = JSON.stringify({ text: 'x' })) =>
    built.app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers,
      payload,
      remoteAddress: '10.9.9.9',
    });

  it('rejects cross-site state-changing requests (CSRF)', async () => {
    const foreign = await post({
      origin: 'https://evil.example',
      'content-type': 'application/json',
    });
    expect(foreign.statusCode).toBe(403);
    expect(errorOf(foreign).code).toBe('FORBIDDEN');

    const crossSite = await post({
      'sec-fetch-site': 'cross-site',
      'content-type': 'application/json',
    });
    expect(crossSite.statusCode).toBe(403);

    const sameOrigin = await post({ origin: ORIGIN, 'content-type': 'application/json' });
    expect(sameOrigin.statusCode).toBe(204);
  });

  it('only accepts JSON bodies', async () => {
    const form = await built.app.inject({
      method: 'POST',
      url: '/api/listings/analyze',
      headers: { origin: ORIGIN, 'content-type': 'application/x-www-form-urlencoded' },
      payload: `url=${encodeURIComponent(URLS.audi)}`,
    });
    expect(form.statusCode).toBe(415);
    expect(errorOf(form).code).toBe('VALIDATION_ERROR');

    const broken = await built.app.inject({
      method: 'POST',
      url: '/api/listings/analyze',
      headers: { origin: ORIGIN, 'content-type': 'application/json' },
      payload: '{"url":',
    });
    expect(broken.statusCode).toBe(400);
    expect(errorOf(broken).message).toBe('Die Anfrage enthält kein gültiges JSON.');
  });

  it('limits request sizes', async () => {
    const response = await built.app.inject({
      method: 'POST',
      url: '/api/listings/analyze-text',
      headers: { origin: ORIGIN, 'content-type': 'application/json' },
      payload: JSON.stringify({ text: 'a'.repeat(200 * 1024) }),
    });
    expect(response.statusCode).toBe(413);
  });

  it('rate-limits analyses per client', async () => {
    const client = new TestClient(built.app);
    const statuses: number[] = [];
    for (let index = 0; index < 4; index += 1) {
      statuses.push((await client.post('/api/listings/analyze', { url: URLS.blocked })).statusCode);
    }
    expect(statuses.slice(0, 3).every((status) => status !== 429)).toBe(true);
    const limited = await client.post('/api/listings/analyze', { url: URLS.blocked });
    expect(limited.statusCode).toBe(429);
    expect(errorOf(limited).code).toBe('RATE_LIMITED');
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
    // Another client is not affected.
    expect(
      (await new TestClient(built.app).post('/api/listings/analyze', { url: URLS.blocked }))
        .statusCode,
    ).not.toBe(429);
  });

  it('sets security headers and request ids', async () => {
    const response = await built.app.inject({
      method: 'GET',
      url: '/api/config',
      headers: { 'x-request-id': 'req_12345678' },
    });
    expect(response.headers['x-request-id']).toBe('req_12345678');
    const csp = String(response.headers['content-security-policy']);
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain('https://img.kleinanzeigen.de');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['permissions-policy']).toContain('camera=()');
    expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');

    const invalidId = await built.app.inject({
      method: 'GET',
      url: '/api/config',
      headers: { 'x-request-id': '<script>' },
    });
    expect(invalidId.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('answers unknown API routes with a JSON 404', async () => {
    const response = await built.app.inject({ method: 'GET', url: '/api/does-not-exist' });
    expect(response.statusCode).toBe(404);
    expect(errorOf(response).code).toBe('NOT_FOUND');
    expect(typeof errorOf(response).requestId).toBe('string');
  });

  it('accepts only allowlisted analytics events and properties', async () => {
    const client = new TestClient(built.app);
    const ok = await client.post('/api/events', {
      name: 'seller_questions_copied',
      props: { count: 7, email: 'x@example.com' },
    });
    expect(ok.statusCode).toBe(204);
    const invalid = await client.post('/api/events', { name: 'page_scrolled', props: {} });
    expect(invalid.statusCode).toBe(400);
    const stored = await built.services.db.analyticsEvent.findMany();
    expect(stored).toHaveLength(1);
    expect(stored[0]?.name).toBe('seller_questions_copied');
    expect(JSON.stringify(stored[0]?.props)).not.toContain('example.com');
  });

  it('records no analytics for Do Not Track or Global Privacy Control', async () => {
    const client = new TestClient(built.app);
    const dnt = await client.request('POST', '/api/events', {
      json: { name: 'landing_page_view' },
      headers: { dnt: '1' },
    });
    expect(dnt.statusCode).toBe(204);
    const analysis = await client.request('POST', '/api/listings/analyze-text', {
      json: { text: PASTED_LISTING },
      headers: { 'sec-gpc': '1' },
    });
    expect(analysis.statusCode).toBe(201);

    // Events are written in the background: once the one allowed event is
    // stored, nothing from the opted-out requests may follow.
    await client.request('POST', '/api/events', { json: { name: 'landing_page_view' } });
    const count = () => built.services.db.analyticsEvent.count();
    await vi.waitFor(async () => expect(await count()).toBe(1));
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(await count()).toBe(1);
  });

  it('does not reveal the server stack', async () => {
    const response = await built.app.inject({ method: 'GET', url: '/api/health' });
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers.server).toBeUndefined();
  });
});

describe('analytics switched off', () => {
  it('stores nothing', async () => {
    const built = await createTestApp({ ANALYTICS_ENABLED: 'false' });
    try {
      await resetDatabase(built.services.db);
      const client = new TestClient(built.app);
      expect((await client.post('/api/events', { name: 'landing_page_view' })).statusCode).toBe(
        204,
      );
      await client.analyzeUrl(URLS.audi);
      expect(await built.services.db.analyticsEvent.count()).toBe(0);
    } finally {
      await built.app.close();
    }
  });
});

describe('transport security in production', () => {
  const production = { NODE_ENV: 'production', LISTING_FETCH_MODE: 'off', SERVE_WEB: 'false' };

  it('sends HSTS and upgrades requests only when the site is served over HTTPS', async () => {
    const httpsApp = await createTestApp({
      ...production,
      PUBLIC_SITE_URL: 'https://kaufcheck.example',
    });
    const httpApp = await createTestApp({
      ...production,
      PUBLIC_SITE_URL: 'http://localhost:3000',
    });
    try {
      const secure = await httpsApp.app.inject({ method: 'GET', url: '/api/health' });
      expect(secure.headers['strict-transport-security']).toContain('max-age=31536000');
      expect(String(secure.headers['content-security-policy'])).toContain(
        'upgrade-insecure-requests',
      );

      const plain = await httpApp.app.inject({ method: 'GET', url: '/api/health' });
      expect(plain.headers['strict-transport-security']).toBeUndefined();
      expect(String(plain.headers['content-security-policy'])).not.toContain(
        'upgrade-insecure-requests',
      );
    } finally {
      await httpsApp.app.close();
      await httpApp.app.close();
    }
  });
});

describe('public config', () => {
  it('matches the shared contract and names the facts the privacy policy needs', async () => {
    const built = await createTestApp({ RENDER: 'true', ANON_RETENTION_DAYS: '30' });
    try {
      const response = await new TestClient(built.app).get('/api/config');
      const config = PublicConfigSchema.parse(response.json());
      expect(config.privacy).toEqual({ hosting: 'render', anonymousRetentionDays: 30 });
      // The development mock is not a real AI provider.
      expect(config.features.aiProvider).toBeNull();
    } finally {
      await built.app.close();
    }
  });
});

describe('client address behind a CDN', () => {
  it('rate-limits by the trusted header and ignores forged forwarding headers', async () => {
    const built = await createTestApp({
      ANALYZE_RATE_PER_MINUTE: '2',
      CLIENT_IP_HEADER: 'cf-connecting-ip',
      TRUST_PROXY: 'true',
    });
    try {
      await resetDatabase(built.services.db);
      const analyze = (headers: Record<string, string>) =>
        built.app.inject({
          method: 'POST',
          url: '/api/listings/analyze',
          headers: { origin: ORIGIN, 'content-type': 'application/json', ...headers },
          payload: JSON.stringify({ url: URLS.blocked }),
          remoteAddress: '10.20.30.40',
        });
      const visitor = { 'cf-connecting-ip': '203.0.113.10' };
      expect((await analyze(visitor)).statusCode).not.toBe(429);
      expect((await analyze(visitor)).statusCode).not.toBe(429);
      // A forged X-Forwarded-For does not give the same visitor a new budget …
      const forged = await analyze({ ...visitor, 'x-forwarded-for': '198.51.100.1' });
      expect(forged.statusCode).toBe(429);
      // … while another visitor behind the same proxy has its own.
      expect((await analyze({ 'cf-connecting-ip': '203.0.113.11' })).statusCode).not.toBe(429);
    } finally {
      await built.app.close();
    }
  });
});
