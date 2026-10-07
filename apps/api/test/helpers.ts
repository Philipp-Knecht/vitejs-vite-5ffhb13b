import { randomBytes } from 'node:crypto';
import type { AnalysisDto, AnalysisStreamEvent } from '@kaufcheck/shared';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { expect, inject } from 'vitest';
import { buildApp, type BuiltApp } from '../src/app';
import { loadConfig, type AppConfig } from '../src/config/env';
import type { ServiceOverrides } from '../src/container';
import type { Db } from '../src/infrastructure/db/client';
import type { EmailMessage, EmailService } from '../src/infrastructure/email/email-service';

export const ORIGIN = 'http://localhost:5173';
export const PASSWORD = 'ein-sicheres-passwort';

export const listingUrl = (id: string) =>
  `https://www.kleinanzeigen.de/s-anzeige/auto/${id}-216-3331`;
export const URLS = {
  audi: listingUrl('2912345678'),
  bmw: listingUrl('2911111111'),
  mercedes: listingUrl('2913333333'),
  blocked: listingUrl('2919999999'),
  removed: listingUrl('2918888888'),
  unknown: listingUrl('2900000001'),
};

export const PASTED_LISTING = [
  'VW Golf 1.4 TSI Highline',
  '8.450 € VB',
  '10115 Berlin - Mitte',
  'Details',
  'Marke',
  'Volkswagen',
  'Modell',
  'Golf',
  'Kilometerstand',
  '142.000 km',
  'Erstzulassung',
  'März 2014',
  'Kraftstoffart',
  'Benzin',
  'Getriebe',
  'Manuell',
  'Beschreibung',
  'Gepflegter Golf aus zweiter Hand. Scheckheft vorhanden, neue Bremsen vorne. Probefahrt nach Absprache.',
].join('\n');

export function testConfig(env: Record<string, string> = {}): AppConfig {
  return loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: inject('databaseUrl'),
    COOKIE_SECRET: 'integration-test-cookie-secret-0123456789abcdef',
    PUBLIC_SITE_URL: ORIGIN,
    AI_PROVIDER: 'none',
    LISTING_FETCH_MODE: 'fixtures',
    ANALYZE_RATE_PER_MINUTE: '1000',
    SERVE_WEB: 'false',
    ...env,
  });
}

export function createTestApp(
  env: Record<string, string> = {},
  overrides: ServiceOverrides = {},
): Promise<BuiltApp> {
  return buildApp(testConfig(env), overrides);
}

const TABLES = [
  'User',
  'Session',
  'PasswordResetToken',
  'Listing',
  'Vehicle',
  'Analysis',
  'SellerQuestion',
  'SavedListing',
  'SavedSearch',
  'Usage',
  'Subscription',
  'BillingEvent',
  'AnalyticsEvent',
  'Order',
  'ContractNotice',
];

export async function resetDatabase(db: Db): Promise<void> {
  await db.$executeRawUnsafe(
    `TRUNCATE ${TABLES.map((table) => `"${table}"`).join(', ')} RESTART IDENTITY CASCADE`,
  );
}

export const uniqueEmail = () => `nutzer-${randomBytes(4).toString('hex')}@example.com`;

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

function randomClientIp(): string {
  const [a = 1, b = 1, c = 1] = randomBytes(3);
  return `10.${a}.${b}.${(c % 250) + 1}`;
}

/**
 * A browser-like client for `app.inject`: keeps cookies, sends our Origin on
 * state-changing requests and uses its own client IP (separate rate limits).
 */
export class TestClient {
  private readonly cookies = new Map<string, string>();
  readonly remoteAddress = randomClientIp();

  constructor(private readonly app: FastifyInstance) {}

  cookie(name: string): string | undefined {
    return this.cookies.get(name);
  }

  forgetCookies(): void {
    this.cookies.clear();
  }

  async request(
    method: Method,
    url: string,
    options: { json?: unknown; payload?: string | Buffer; headers?: Record<string, string> } = {},
  ): Promise<LightMyRequestResponse> {
    const headers: Record<string, string> = {};
    if (this.cookies.size > 0) {
      headers.cookie = [...this.cookies]
        .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
        .join('; ');
    }
    if (method !== 'GET') headers.origin = ORIGIN;
    if (options.json !== undefined) headers['content-type'] = 'application/json';
    Object.assign(headers, options.headers);
    const response = await this.app.inject({
      method,
      url,
      headers,
      remoteAddress: this.remoteAddress,
      payload: options.json !== undefined ? JSON.stringify(options.json) : options.payload,
    });
    for (const cookie of response.cookies as {
      name: string;
      value: string;
      expires?: Date;
      maxAge?: number;
    }[]) {
      const expired =
        cookie.value === '' ||
        cookie.maxAge === 0 ||
        (cookie.expires && cookie.expires.getTime() <= Date.now());
      if (expired) this.cookies.delete(cookie.name);
      else this.cookies.set(cookie.name, cookie.value);
    }
    return response;
  }

  get(url: string, headers?: Record<string, string>) {
    return this.request('GET', url, { headers });
  }

  post(url: string, json?: unknown, headers?: Record<string, string>) {
    return this.request('POST', url, { json: json ?? {}, headers });
  }

  patch(url: string, json: unknown) {
    return this.request('PATCH', url, { json });
  }

  delete(url: string, json?: unknown) {
    return this.request('DELETE', url, json === undefined ? {} : { json });
  }

  /** Registers a new account in this client (the session cookie is kept). */
  async register(
    email = uniqueEmail(),
    password = PASSWORD,
  ): Promise<{ id: string; email: string; password: string }> {
    const response = await this.post('/api/auth/register', { email, password });
    expect(response.statusCode, response.body).toBe(201);
    return { id: response.json<{ user: { id: string } }>().user.id, email, password };
  }

  /** Runs a URL analysis and returns the created analysis. */
  async analyzeUrl(url: string): Promise<AnalysisDto> {
    const response = await this.post('/api/listings/analyze', { url });
    expect(response.statusCode, response.body).toBe(201);
    return response.json();
  }
}

export function ndjson(response: LightMyRequestResponse): AnalysisStreamEvent[] {
  return response.body
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as AnalysisStreamEvent);
}

export function errorOf(response: LightMyRequestResponse): {
  code: string;
  message: string;
  requestId?: string;
  details?: Record<string, unknown>;
} {
  return response.json<{
    error: { code: string; message: string; requestId?: string; details?: Record<string, unknown> };
  }>().error;
}

/** Captures e-mails instead of sending them. */
export class CapturingEmailService implements EmailService {
  readonly enabled = true;
  readonly sent: EmailMessage[] = [];

  send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
    return Promise.resolve();
  }
}

/** Waits for fire-and-forget writes such as analytics events. */
export async function eventually<T>(
  read: () => Promise<T>,
  accept: (value: T) => boolean,
  timeoutMs = 2000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await read();
    if (accept(value) || Date.now() > deadline) return value;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}
