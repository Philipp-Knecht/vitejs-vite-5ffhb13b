import type { FastifyBaseLogger } from 'fastify';
import Stripe from 'stripe';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { BuiltApp } from '../src/app';
import { runMaintenance } from '../src/application/maintenance';
import { StripeBillingService } from '../src/infrastructure/billing/stripe-billing-service';
import { createDb, type Db } from '../src/infrastructure/db/client';
import {
  createTestApp,
  errorOf,
  ORIGIN,
  resetDatabase,
  TestClient,
  testConfig,
  URLS,
} from './helpers';

const WEBHOOK_SECRET = 'whsec_test_integration_secret';

describe('billing without a payment provider', () => {
  let built: BuiltApp;

  beforeAll(async () => {
    built = await createTestApp();
  });
  beforeEach(() => resetDatabase(built.services.db));
  afterAll(() => built.app.close());

  it('says honestly that payments are not configured', async () => {
    const config = (await new TestClient(built.app).get('/api/config')).json<{
      features: { billing: boolean };
    }>();
    expect(config.features.billing).toBe(false);

    const anonymous = await new TestClient(built.app).post('/api/billing/checkout');
    expect(anonymous.statusCode).toBe(401);

    const client = new TestClient(built.app);
    await client.register();
    const checkout = await client.post('/api/billing/checkout');
    expect(checkout.statusCode).toBe(501);
    expect(errorOf(checkout).code).toBe('PAYMENT_NOT_CONFIGURED');

    const webhook = await built.app.inject({
      method: 'POST',
      url: '/api/billing/webhook',
      headers: { 'content-type': 'application/json', 'stripe-signature': 't=1,v1=abc' },
      payload: '{}',
    });
    expect(webhook.statusCode).toBe(501);
  });
});

describe('Stripe webhooks', () => {
  let built: BuiltApp;
  let db: Db;
  const stripe = new Stripe('sk_test_integration_dummy');

  beforeAll(async () => {
    const config = testConfig();
    db = createDb(config.databaseUrl);
    const logger = {
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    } as unknown as FastifyBaseLogger;
    const billing = new StripeBillingService(
      db,
      {
        secretKey: 'sk_test_integration_dummy',
        webhookSecret: WEBHOOK_SECRET,
        priceIdPro: 'price_test',
        client: stripe,
      },
      logger,
    );
    built = await createTestApp({}, { db, billing });
  });
  beforeEach(() => resetDatabase(db));
  afterAll(() => built.app.close());

  function subscriptionEvent(
    id: string,
    type: string,
    userId: string,
    status: Stripe.Subscription.Status,
  ) {
    return {
      id,
      object: 'event',
      type,
      data: {
        object: {
          id: 'sub_test_1',
          object: 'subscription',
          customer: 'cus_test_1',
          status,
          cancel_at_period_end: false,
          metadata: { userId },
          items: { object: 'list', data: [{ id: 'si_1', current_period_end: 1_793_000_000 }] },
        },
      },
    };
  }

  function sendWebhook(event: unknown, secret = WEBHOOK_SECRET) {
    const payload = JSON.stringify(event);
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret });
    // Stripe calls the webhook from its servers: no Origin header, CSRF check does not apply.
    return built.app.inject({
      method: 'POST',
      url: '/api/billing/webhook',
      headers: { 'content-type': 'application/json', 'stripe-signature': signature },
      payload,
    });
  }

  it('upgrades and downgrades plans only from verified events, once per event', async () => {
    const client = new TestClient(built.app);
    const account = await client.register();

    const forged = await sendWebhook(
      subscriptionEvent('evt_forged', 'customer.subscription.updated', account.id, 'active'),
      'whsec_wrong',
    );
    expect(forged.statusCode).toBe(400);
    expect((await db.user.findUniqueOrThrow({ where: { id: account.id } })).plan).toBe('FREE');

    const activated = await sendWebhook(
      subscriptionEvent('evt_1', 'customer.subscription.created', account.id, 'active'),
    );
    expect(activated.statusCode, activated.body).toBe(200);
    const me = (await client.get('/api/me')).json<{
      plan: string;
      subscription: { status: string; currentPeriodEnd: string };
    }>();
    expect(me.plan).toBe('pro');
    expect(me.subscription).toMatchObject({
      status: 'active',
      currentPeriodEnd: new Date(1_793_000_000 * 1000).toISOString(),
    });

    const canceled = subscriptionEvent(
      'evt_2',
      'customer.subscription.deleted',
      account.id,
      'canceled',
    );
    expect((await sendWebhook(canceled)).statusCode).toBe(200);
    expect((await db.user.findUniqueOrThrow({ where: { id: account.id } })).plan).toBe('FREE');

    // Replaying an already processed event changes nothing.
    expect(
      (
        await sendWebhook(
          subscriptionEvent('evt_1', 'customer.subscription.created', account.id, 'active'),
        )
      ).statusCode,
    ).toBe(200);
    expect((await db.user.findUniqueOrThrow({ where: { id: account.id } })).plan).toBe('FREE');
    expect(await db.billingEvent.count()).toBe(2);
  });

  it('rejects webhooks without a signature', async () => {
    const response = await built.app.inject({
      method: 'POST',
      url: '/api/billing/webhook',
      headers: { 'content-type': 'application/json', origin: ORIGIN },
      payload: '{}',
    });
    expect(response.statusCode).toBe(400);
  });
});

describe('data retention', () => {
  let built: BuiltApp;

  beforeAll(async () => {
    built = await createTestApp();
  });
  beforeEach(() => resetDatabase(built.services.db));
  afterAll(() => built.app.close());

  it('removes expired sessions and old anonymous analyses but keeps account data', async () => {
    const db = built.services.db;
    const anonymous = new TestClient(built.app);
    const oldAnalysis = await anonymous.analyzeUrl(URLS.audi);
    const member = new TestClient(built.app);
    const account = await member.register();
    const kept = await member.analyzeUrl(URLS.bmw);

    const past = new Date('2020-01-01T00:00:00Z');
    await db.analysis.update({ where: { id: oldAnalysis.id }, data: { createdAt: past } });
    await db.analysis.update({ where: { id: kept.id }, data: { createdAt: past } });
    await db.session.create({
      data: { tokenHash: 'expired', userId: account.id, expiresAt: past },
    });

    const report = await runMaintenance(db, { now: new Date(), anonRetentionDays: 90 });
    expect(report).toMatchObject({ expiredSessions: 1, anonymousAnalyses: 1 });
    expect(report.orphanedListings).toBeGreaterThanOrEqual(1);
    expect(await db.analysis.count({ where: { id: oldAnalysis.id } })).toBe(0);
    expect(await db.analysis.count({ where: { id: kept.id } })).toBe(1);
    // The member's current session survives.
    expect((await member.get('/api/me')).json<{ user: unknown }>().user).not.toBeNull();
  });
});
