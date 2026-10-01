import { describe, expect, it } from 'vitest';
import { createAiProvider } from '../infrastructure/ai/create-provider';
import { ConfigError, describeConfig, loadConfig } from './env';

const BASE = { DATABASE_URL: 'postgresql://user:pass@localhost:5432/db' };
const PRODUCTION = {
  ...BASE,
  NODE_ENV: 'production',
  PUBLIC_SITE_URL: 'https://kaufcheck.example',
  COOKIE_SECRET: 'x'.repeat(40),
};
/** Everything a paid contract needs besides the Stripe keys. */
const PAYMENT_READY = {
  EMAIL_TRANSPORT: 'smtp',
  SMTP_URL: 'smtps://user:pass@smtp.example:465',
  EMAIL_FROM: 'KaufCheck <noreply@kaufcheck.example>',
  VAT_MODE: 'small_business',
  VITE_IMPRINT_NAME: 'Erika Musterfrau',
  VITE_IMPRINT_ADDRESS: 'Musterstraße 1|12345 Musterstadt',
  VITE_CONTACT_EMAIL: 'kontakt@kaufcheck.example',
  VITE_CONTACT_PHONE: '+49 30 1234567',
};
const STRIPE = {
  STRIPE_SECRET_KEY: 'sk_live_secret',
  STRIPE_WEBHOOK_SECRET: 'whsec_secret',
  STRIPE_PRICE_ID_PRO: 'price_123',
};

describe('loadConfig', () => {
  it('uses safe development defaults', () => {
    const config = loadConfig({ ...BASE, NODE_ENV: 'development' });
    expect(config.fetch.mode).toBe('live');
    expect(config.ai.provider).toBe('none');
    expect(config.stripe).toBeNull();
    expect(config.cookieSecret).toHaveLength(64);
    expect(config.secureCookies).toBe(false);
    expect(config.fetch.userAgent).toBe('KaufCheckBot/1.0 (+http://localhost:5173/bot)');
    expect(config.ai.anthropic.model).toBe('claude-opus-5-5');
    expect(config.ai.anthropic.effort).toBe('medium');
  });

  it('uses fixtures and silent logs in tests', () => {
    const config = loadConfig({ ...BASE, NODE_ENV: 'test' });
    expect(config.fetch.mode).toBe('fixtures');
    expect(config.logLevel).toBe('silent');
  });

  it('disables automatic retrieval by default in production (operator opt-in)', () => {
    const config = loadConfig(PRODUCTION);
    expect(config.fetch.mode).toBe('off');
    expect(config.secureCookies).toBe(true);
    expect(config.serveWeb).toBe(true);
    expect(config.fetch.userAgent).toBe('KaufCheckBot/1.0 (+https://kaufcheck.example/bot)');
  });

  it.each([
    [{ PUBLIC_SITE_URL: undefined }, 'PUBLIC_SITE_URL'],
    [{ COOKIE_SECRET: 'short' }, 'COOKIE_SECRET'],
    [{ AI_PROVIDER: 'mock' }, 'AI_PROVIDER'],
    [{ LISTING_FETCH_MODE: 'fixtures' }, 'LISTING_FETCH_MODE'],
    [{ EMAIL_TRANSPORT: 'console' }, 'EMAIL_TRANSPORT'],
  ])('rejects unsafe production settings (%o)', (override, field) => {
    expect(() => loadConfig({ ...PRODUCTION, ...override })).toThrow(ConfigError);
    expect(() => loadConfig({ ...PRODUCTION, ...override })).toThrow(field);
  });

  it('requires credentials for configured integrations', () => {
    expect(() => loadConfig({ ...BASE, AI_PROVIDER: 'anthropic' })).toThrow('ANTHROPIC_API_KEY');
    expect(() => loadConfig({ ...BASE, AI_PROVIDER: 'openai', OPENAI_API_KEY: 'sk' })).toThrow(
      'OPENAI_MODEL',
    );
    expect(() => loadConfig({ ...BASE, EMAIL_TRANSPORT: 'smtp' })).toThrow('SMTP_URL');
    expect(() => loadConfig({ ...BASE, STRIPE_SECRET_KEY: 'sk_test_x' })).toThrow(
      'must be set together',
    );
    expect(() => loadConfig({})).toThrow('DATABASE_URL');
  });

  it('detects the hosting provider for the privacy policy', () => {
    expect(loadConfig(BASE).hostingProvider).toBeNull();
    expect(loadConfig({ ...BASE, RENDER: 'true' }).hostingProvider).toBe('render');
    expect(loadConfig({ ...BASE, HOSTING_PROVIDER: 'render' }).hostingProvider).toBe('render');
    expect(() => loadConfig({ ...BASE, HOSTING_PROVIDER: 'elsewhere' })).toThrow(ConfigError);
  });

  it('uses the CDN client-address header on Render unless configured otherwise', () => {
    expect(loadConfig(BASE).clientIpHeader).toBeNull();
    expect(loadConfig({ ...BASE, RENDER: 'true' }).clientIpHeader).toBe('cf-connecting-ip');
    expect(loadConfig({ ...BASE, CLIENT_IP_HEADER: 'True-Client-IP' }).clientIpHeader).toBe(
      'true-client-ip',
    );
    expect(() => loadConfig({ ...BASE, CLIENT_IP_HEADER: 'x forwarded' })).toThrow(ConfigError);
  });

  it('parses TRUST_PROXY and allowed origins', () => {
    expect(loadConfig({ ...BASE, TRUST_PROXY: '1' }).trustProxy).toBe(1);
    expect(loadConfig({ ...BASE, TRUST_PROXY: 'true' }).trustProxy).toBe(true);
    expect(loadConfig({ ...BASE, TRUST_PROXY: 'nonsense' }).trustProxy).toBe(false);
    expect(
      loadConfig({ ...BASE, ALLOWED_ORIGINS: 'http://localhost:4173, http://127.0.0.1:5173' })
        .allowedOrigins,
    ).toEqual(['http://localhost:5173', 'http://localhost:4173', 'http://127.0.0.1:5173']);
  });

  it('enables payments only with e-mail, VAT mode and the full operator details', () => {
    const config = loadConfig({ ...PRODUCTION, ...PAYMENT_READY, ...STRIPE });
    expect(config.stripe).toMatchObject({ vatMode: 'small_business', paymentMethods: ['card'] });
    expect(config.operator).toEqual({
      name: 'Erika Musterfrau',
      addressLines: ['Musterstraße 1', '12345 Musterstadt'],
      email: 'kontakt@kaufcheck.example',
      phone: '+49 30 1234567',
    });
    for (const missing of [
      'EMAIL_TRANSPORT',
      'VAT_MODE',
      'VITE_IMPRINT_NAME',
      'VITE_IMPRINT_ADDRESS',
      'VITE_CONTACT_EMAIL',
      'VITE_CONTACT_PHONE',
    ]) {
      const env: Record<string, string> = { ...PRODUCTION, ...PAYMENT_READY, ...STRIPE };
      delete env[missing];
      expect(() => loadConfig(env), missing).toThrow(new RegExp(missing));
    }
    expect(() =>
      loadConfig({
        ...PRODUCTION,
        ...PAYMENT_READY,
        ...STRIPE,
        STRIPE_PAYMENT_METHODS: 'card,bitcoin',
      }),
    ).toThrow(/STRIPE_PAYMENT_METHODS/);
    expect(
      loadConfig({
        ...PRODUCTION,
        ...PAYMENT_READY,
        ...STRIPE,
        STRIPE_PAYMENT_METHODS: 'card, sepa_debit',
      }).stripe?.paymentMethods,
    ).toEqual(['card', 'sepa_debit']);
  });

  it('recognises the e-mail service named in the privacy policy', () => {
    const provider = (smtpUrl: string) =>
      loadConfig({
        ...BASE,
        EMAIL_TRANSPORT: 'smtp',
        SMTP_URL: smtpUrl,
        EMAIL_FROM: 'KaufCheck <noreply@kaufcheck.example>',
      }).email.provider;
    expect(provider('smtp://login:key@smtp-relay.brevo.com:587')).toBe('brevo');
    expect(provider('smtps://me%40gmail.com:app-password@smtp.gmail.com:465')).toBe('gmail');
    expect(provider('smtps://user:pass@smtp.example.com:465')).toBe('other');
    expect(loadConfig({ ...BASE }).email.provider).toBeNull();
  });

  it('never includes secrets in the startup summary', () => {
    const config = loadConfig({
      ...PRODUCTION,
      ...PAYMENT_READY,
      AI_PROVIDER: 'anthropic',
      ANTHROPIC_API_KEY: 'sk-ant-secret-value',
      ...STRIPE,
    });
    const summary = JSON.stringify(describeConfig(config));
    expect(summary).not.toMatch(/secret|sk-ant|whsec|pass@/);
    expect(summary).toContain('"billing":"stripe"');
  });
});

describe('createAiProvider', () => {
  it('creates the configured provider or none', () => {
    expect(createAiProvider(loadConfig({ ...BASE }))).toBeNull();
    expect(createAiProvider(loadConfig({ ...BASE, AI_PROVIDER: 'mock' }))?.isMock).toBe(true);
    const anthropic = createAiProvider(
      loadConfig({ ...BASE, AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'sk-ant-x' }),
    );
    expect(anthropic).toMatchObject({ name: 'anthropic', model: 'claude-opus-5-5', isMock: false });
    const openai = createAiProvider(
      loadConfig({
        ...BASE,
        AI_PROVIDER: 'openai',
        OPENAI_API_KEY: 'sk-x',
        OPENAI_MODEL: 'some-model',
      }),
    );
    expect(openai).toMatchObject({ name: 'openai', model: 'some-model' });
  });
});
