import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

/** Nearest directory with a package.json – works from `src/config` (dev) and the bundled `dist/`. */
function findApiRoot(): string {
  let directory = path.dirname(fileURLToPath(import.meta.url));
  while (!existsSync(path.join(directory, 'package.json'))) {
    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  return directory;
}

const apiRoot = findApiRoot();

const booleanString = z
  .enum(['true', 'false', '1', '0', 'yes', 'no'])
  .transform((value) => value === 'true' || value === '1' || value === 'yes');

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().default('0.0.0.0'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    PUBLIC_SITE_URL: z.url().optional(),
    /** Additional origins allowed to call the API (comma separated), e.g. the Vite dev server. */
    ALLOWED_ORIGINS: optionalString,
    TRUST_PROXY: optionalString,

    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    COOKIE_SECRET: optionalString,

    LISTING_FETCH_MODE: z.enum(['off', 'live', 'fixtures']).optional(),
    LISTING_FIXTURES_DIR: optionalString,
    FETCH_USER_AGENT: optionalString,
    FETCH_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30_000).default(8000),
    FETCH_MAX_BYTES: z.coerce.number().int().min(100_000).max(10_000_000).default(3_000_000),
    FETCH_RATE_PER_MINUTE: z.coerce.number().int().min(1).max(600).default(30),
    SHOW_LISTING_PHOTOS: booleanString.default(true),

    AI_PROVIDER: z.enum(['none', 'anthropic', 'openai', 'mock']).default('none'),
    ANTHROPIC_API_KEY: optionalString,
    ANTHROPIC_MODEL: z.string().default('claude-opus-5-5'),
    ANTHROPIC_EFFORT: z.enum(['low', 'medium', 'high', 'xhigh', 'max']).default('medium'),
    OPENAI_API_KEY: optionalString,
    OPENAI_MODEL: optionalString,
    OPENAI_BASE_URL: z.url().default('https://api.openai.com/v1'),
    AI_TIMEOUT_MS: z.coerce.number().int().min(5000).max(180_000).default(60_000),
    AI_MAX_CONCURRENCY: z.coerce.number().int().min(1).max(100).default(6),
    AI_PHOTO_ANALYSIS: booleanString.default(true),
    AI_MAX_PHOTOS: z.coerce.number().int().min(1).max(10).default(4),

    ANON_MONTHLY_ANALYSES: z.coerce.number().int().min(0).optional(),
    FREE_MONTHLY_ANALYSES: z.coerce.number().int().min(0).optional(),
    PRO_MONTHLY_ANALYSES: z.coerce.number().int().min(0).optional(),
    ANALYZE_RATE_PER_MINUTE: z.coerce.number().int().min(1).max(1000).default(10),

    STRIPE_SECRET_KEY: optionalString,
    STRIPE_WEBHOOK_SECRET: optionalString,
    STRIPE_PRICE_ID_PRO: optionalString,
    PRO_PRICE_LABEL: optionalString,

    EMAIL_TRANSPORT: z.enum(['none', 'smtp', 'console']).default('none'),
    SMTP_URL: optionalString,
    EMAIL_FROM: optionalString,

    ANALYTICS_ENABLED: booleanString.default(true),
    SERVE_WEB: booleanString.optional(),
    WEB_DIST_DIR: optionalString,
    ANON_RETENTION_DAYS: z.coerce.number().int().min(1).max(3650).default(90),
    /** Named in the privacy policy; detected automatically on Render. */
    HOSTING_PROVIDER: z.enum(['render']).optional(),
    /** Set to "true" by Render on its services. */
    RENDER: optionalString,
  })
  .superRefine((env, ctx) => {
    const production = env.NODE_ENV === 'production';
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message });
    if (production && !env.PUBLIC_SITE_URL) issue('PUBLIC_SITE_URL', 'is required in production');
    if (production && (!env.COOKIE_SECRET || env.COOKIE_SECRET.length < 32)) {
      issue('COOKIE_SECRET', 'must be at least 32 characters in production');
    }
    if (production && env.AI_PROVIDER === 'mock')
      issue('AI_PROVIDER', 'the mock provider is not allowed in production');
    if (production && env.LISTING_FETCH_MODE === 'fixtures') {
      issue('LISTING_FETCH_MODE', 'fixtures are development data and not allowed in production');
    }
    if (production && env.EMAIL_TRANSPORT === 'console')
      issue('EMAIL_TRANSPORT', 'console is not allowed in production');
    if (env.AI_PROVIDER === 'anthropic' && !env.ANTHROPIC_API_KEY)
      issue('ANTHROPIC_API_KEY', 'is required for AI_PROVIDER=anthropic');
    if (env.AI_PROVIDER === 'openai' && (!env.OPENAI_API_KEY || !env.OPENAI_MODEL)) {
      issue(
        'OPENAI_API_KEY',
        'OPENAI_API_KEY and OPENAI_MODEL are required for AI_PROVIDER=openai',
      );
    }
    if (env.EMAIL_TRANSPORT === 'smtp' && (!env.SMTP_URL || !env.EMAIL_FROM)) {
      issue('SMTP_URL', 'SMTP_URL and EMAIL_FROM are required for EMAIL_TRANSPORT=smtp');
    }
    const stripeValues = [
      env.STRIPE_SECRET_KEY,
      env.STRIPE_WEBHOOK_SECRET,
      env.STRIPE_PRICE_ID_PRO,
    ];
    if (stripeValues.some(Boolean) && !stripeValues.every(Boolean)) {
      issue(
        'STRIPE_SECRET_KEY',
        'STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET and STRIPE_PRICE_ID_PRO must be set together',
      );
    }
  });

export type Env = z.infer<typeof EnvSchema>;

export interface AppConfig {
  env: Env['NODE_ENV'];
  isProduction: boolean;
  host: string;
  port: number;
  logLevel: Env['LOG_LEVEL'];
  publicSiteUrl: string;
  allowedOrigins: string[];
  trustProxy: boolean | number;
  databaseUrl: string;
  cookieSecret: string;
  secureCookies: boolean;
  fetch: {
    mode: 'off' | 'live' | 'fixtures';
    fixturesDir: string;
    userAgent: string;
    timeoutMs: number;
    maxBytes: number;
    ratePerMinute: number;
  };
  showListingPhotos: boolean;
  ai: {
    provider: Env['AI_PROVIDER'];
    anthropic: { apiKey?: string; model: string; effort: Env['ANTHROPIC_EFFORT'] };
    openai: { apiKey?: string; model?: string; baseUrl: string };
    timeoutMs: number;
    maxConcurrency: number;
    photoAnalysis: boolean;
    maxPhotos: number;
  };
  limits: {
    anonymousMonthlyAnalyses?: number;
    freeMonthlyAnalyses?: number;
    proMonthlyAnalyses?: number;
    analyzeRatePerMinute: number;
  };
  stripe: { secretKey: string; webhookSecret: string; priceIdPro: string } | null;
  proPriceLabel: string | null;
  email: { transport: Env['EMAIL_TRANSPORT']; smtpUrl?: string; from?: string };
  analyticsEnabled: boolean;
  serveWeb: boolean;
  webDistDir: string;
  anonRetentionDays: number;
  hostingProvider: 'render' | null;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

function parseTrustProxy(value: string | undefined): boolean | number {
  if (!value) return false;
  if (value === 'true') return true;
  if (value === 'false') return false;
  const hops = Number(value);
  return Number.isInteger(hops) && hops >= 0 ? hops : false;
}

/** Validates the environment once at startup. Secrets are never logged. */
export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new ConfigError(`Invalid configuration – ${details}`);
  }
  const env = parsed.data;
  const production = env.NODE_ENV === 'production';
  const publicSiteUrl = (env.PUBLIC_SITE_URL ?? 'http://localhost:5173').replace(/\/$/, '');
  const defaultFetchMode = production ? 'off' : env.NODE_ENV === 'test' ? 'fixtures' : 'live';

  return {
    env: env.NODE_ENV,
    isProduction: production,
    host: env.HOST,
    port: env.PORT,
    logLevel: env.NODE_ENV === 'test' && !source.LOG_LEVEL ? 'silent' : env.LOG_LEVEL,
    publicSiteUrl,
    allowedOrigins: [
      new URL(publicSiteUrl).origin,
      ...(env.ALLOWED_ORIGINS ?? '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ],
    trustProxy: parseTrustProxy(env.TRUST_PROXY),
    databaseUrl: env.DATABASE_URL,
    // Development falls back to a per-process secret: anonymous ids reset on restart.
    cookieSecret: env.COOKIE_SECRET ?? randomBytes(32).toString('hex'),
    secureCookies: publicSiteUrl.startsWith('https://'),
    fetch: {
      mode: env.LISTING_FETCH_MODE ?? defaultFetchMode,
      fixturesDir: env.LISTING_FIXTURES_DIR ?? path.join(apiRoot, 'fixtures', 'listings'),
      userAgent: env.FETCH_USER_AGENT ?? `KaufCheckBot/1.0 (+${publicSiteUrl}/bot)`,
      timeoutMs: env.FETCH_TIMEOUT_MS,
      maxBytes: env.FETCH_MAX_BYTES,
      ratePerMinute: env.FETCH_RATE_PER_MINUTE,
    },
    showListingPhotos: env.SHOW_LISTING_PHOTOS,
    ai: {
      provider: env.AI_PROVIDER,
      anthropic: {
        apiKey: env.ANTHROPIC_API_KEY,
        model: env.ANTHROPIC_MODEL,
        effort: env.ANTHROPIC_EFFORT,
      },
      openai: { apiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL, baseUrl: env.OPENAI_BASE_URL },
      timeoutMs: env.AI_TIMEOUT_MS,
      maxConcurrency: env.AI_MAX_CONCURRENCY,
      photoAnalysis: env.AI_PHOTO_ANALYSIS,
      maxPhotos: env.AI_MAX_PHOTOS,
    },
    limits: {
      anonymousMonthlyAnalyses: env.ANON_MONTHLY_ANALYSES,
      freeMonthlyAnalyses: env.FREE_MONTHLY_ANALYSES,
      proMonthlyAnalyses: env.PRO_MONTHLY_ANALYSES,
      analyzeRatePerMinute: env.ANALYZE_RATE_PER_MINUTE,
    },
    stripe:
      env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET && env.STRIPE_PRICE_ID_PRO
        ? {
            secretKey: env.STRIPE_SECRET_KEY,
            webhookSecret: env.STRIPE_WEBHOOK_SECRET,
            priceIdPro: env.STRIPE_PRICE_ID_PRO,
          }
        : null,
    proPriceLabel: env.PRO_PRICE_LABEL ?? null,
    email: { transport: env.EMAIL_TRANSPORT, smtpUrl: env.SMTP_URL, from: env.EMAIL_FROM },
    analyticsEnabled: env.ANALYTICS_ENABLED,
    serveWeb: env.SERVE_WEB ?? production,
    webDistDir: env.WEB_DIST_DIR ?? path.resolve(apiRoot, '../web/dist'),
    anonRetentionDays: env.ANON_RETENTION_DAYS,
    hostingProvider: env.HOSTING_PROVIDER ?? (env.RENDER === 'true' ? 'render' : null),
  };
}

/** Configuration summary for startup logs – no secrets. */
export function describeConfig(config: AppConfig): Record<string, unknown> {
  return {
    publicSiteUrl: config.publicSiteUrl,
    listingFetchMode: config.fetch.mode,
    aiProvider: config.ai.provider,
    aiModel:
      config.ai.provider === 'anthropic'
        ? config.ai.anthropic.model
        : config.ai.provider === 'openai'
          ? config.ai.openai.model
          : null,
    billing: config.stripe ? 'stripe' : 'not_configured',
    email: config.email.transport,
    analytics: config.analyticsEnabled,
    serveWeb: config.serveWeb,
  };
}
