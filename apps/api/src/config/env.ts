import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PAYMENT_METHODS,
  VAT_MODES,
  type OperatorInfo,
  type PaymentMethod,
} from '@kaufcheck/shared';
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
    /** Header with the visitor address set by a trusted CDN, e.g. cf-connecting-ip. */
    CLIENT_IP_HEADER: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9-]+$/, 'must be a header name')
      .optional(),

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
    /** Payment methods offered in Stripe Checkout (comma separated). */
    STRIPE_PAYMENT_METHODS: z
      .string()
      .default('card')
      .transform((value) =>
        value
          .split(',')
          .map((method) => method.trim())
          .filter(Boolean),
      )
      .pipe(z.array(z.enum(PAYMENT_METHODS)).min(1)),
    /** small_business = Kleinunternehmer (§ 19 UStG), standard = price includes 19 % VAT. */
    VAT_MODE: z.enum(VAT_MODES).optional(),

    /** Operator details; the same variables fill the imprint of the web app at build time. */
    VITE_IMPRINT_NAME: optionalString,
    VITE_IMPRINT_ADDRESS: optionalString,
    VITE_CONTACT_EMAIL: optionalString,
    VITE_CONTACT_PHONE: optionalString,

    EMAIL_TRANSPORT: z.enum(['none', 'smtp', 'console']).default('none'),
    SMTP_URL: optionalString,
    EMAIL_FROM: optionalString,

    /** Google AdSense publisher ID (ca-pub-…): ads.txt and site verification. */
    ADSENSE_CLIENT: z
      .string()
      .trim()
      .regex(/^ca-pub-\d{16}$/, 'must look like ca-pub-0000000000000000')
      .optional(),
    /** AdSense ad unit (data-ad-slot); with it, ads are shown to visitors without Pro. */
    ADSENSE_SLOT: z
      .string()
      .trim()
      .regex(/^\d{6,20}$/, 'must be the numeric ad unit ID')
      .optional(),

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
    // Paid contracts need the confirmations required by law (§§ 312f, 312i, 312k, 356a BGB)
    // and the operator's full contact details (Art. 246a § 1 Abs. 1 Nr. 2 and 3 EGBGB).
    if (stripeValues.every(Boolean)) {
      const emailReady =
        env.EMAIL_TRANSPORT === 'smtp' || (!production && env.EMAIL_TRANSPORT === 'console');
      if (!emailReady) {
        issue(
          'EMAIL_TRANSPORT',
          'payments need e-mail (EMAIL_TRANSPORT=smtp) for the legally required confirmations',
        );
      }
      if (!env.VAT_MODE) {
        issue('VAT_MODE', 'is required for payments: small_business (§ 19 UStG) or standard');
      }
      const operator = {
        VITE_IMPRINT_NAME: env.VITE_IMPRINT_NAME,
        VITE_IMPRINT_ADDRESS: env.VITE_IMPRINT_ADDRESS,
        VITE_CONTACT_EMAIL: env.VITE_CONTACT_EMAIL,
        VITE_CONTACT_PHONE: env.VITE_CONTACT_PHONE,
      };
      for (const [key, value] of Object.entries(operator)) {
        if (!value) issue(key, 'is required for payments (operator details in the contract)');
      }
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
  clientIpHeader: string | null;
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
  stripe: {
    secretKey: string;
    webhookSecret: string;
    priceIdPro: string;
    paymentMethods: PaymentMethod[];
    vatMode: (typeof VAT_MODES)[number];
  } | null;
  /** Operator named in contracts and e-mails; null until name, address and e-mail are set. */
  operator: OperatorInfo | null;
  email: {
    transport: Env['EMAIL_TRANSPORT'];
    smtpUrl?: string;
    from?: string;
    /** Named in the privacy policy when recognised from the SMTP host. */
    provider: 'brevo' | 'gmail' | 'other' | null;
  };
  /** Google AdSense; `slot` null = only verification (ads.txt, meta tag), no ads yet. */
  adsense: { client: string; slot: string | null } | null;
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

/** Address lines separated by "|" or a literal "\\n" (as in the web app's imprint). */
function addressLines(value: string | undefined): string[] {
  return (value ?? '')
    .split(/\||\\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function operatorFrom(env: Env): OperatorInfo | null {
  const lines = addressLines(env.VITE_IMPRINT_ADDRESS);
  if (!env.VITE_IMPRINT_NAME || lines.length === 0 || !env.VITE_CONTACT_EMAIL) return null;
  return {
    name: env.VITE_IMPRINT_NAME,
    addressLines: lines,
    email: env.VITE_CONTACT_EMAIL,
    phone: env.VITE_CONTACT_PHONE ?? '',
  };
}

function emailProvider(env: Env): 'brevo' | 'gmail' | 'other' | null {
  if (env.EMAIL_TRANSPORT !== 'smtp' || !env.SMTP_URL) return null;
  let host: string;
  try {
    host = new URL(env.SMTP_URL).hostname.toLowerCase();
  } catch {
    return 'other';
  }
  if (host === 'brevo.com' || host.endsWith('.brevo.com')) return 'brevo';
  if (host === 'smtp.gmail.com' || host === 'smtp.googlemail.com') return 'gmail';
  return 'other';
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
  const hostingProvider = env.HOSTING_PROVIDER ?? (env.RENDER === 'true' ? 'render' : null);

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
    // Render serves through Cloudflare, which sets CF-Connecting-IP and rejects it from clients.
    clientIpHeader:
      env.CLIENT_IP_HEADER ?? (hostingProvider === 'render' ? 'cf-connecting-ip' : null),
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
      env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET && env.STRIPE_PRICE_ID_PRO && env.VAT_MODE
        ? {
            secretKey: env.STRIPE_SECRET_KEY,
            webhookSecret: env.STRIPE_WEBHOOK_SECRET,
            priceIdPro: env.STRIPE_PRICE_ID_PRO,
            paymentMethods: env.STRIPE_PAYMENT_METHODS,
            vatMode: env.VAT_MODE,
          }
        : null,
    operator: operatorFrom(env),
    email: {
      transport: env.EMAIL_TRANSPORT,
      smtpUrl: env.SMTP_URL,
      from: env.EMAIL_FROM,
      provider: emailProvider(env),
    },
    adsense: env.ADSENSE_CLIENT
      ? { client: env.ADSENSE_CLIENT, slot: env.ADSENSE_SLOT ?? null }
      : null,
    analyticsEnabled: env.ANALYTICS_ENABLED,
    serveWeb: env.SERVE_WEB ?? production,
    webDistDir: env.WEB_DIST_DIR ?? path.resolve(apiRoot, '../web/dist'),
    anonRetentionDays: env.ANON_RETENTION_DAYS,
    hostingProvider,
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
    ads: config.adsense ? (config.adsense.slot ? 'adsense' : 'adsense_verification_only') : 'none',
    email: config.email.transport,
    analytics: config.analyticsEnabled,
    serveWeb: config.serveWeb,
  };
}
