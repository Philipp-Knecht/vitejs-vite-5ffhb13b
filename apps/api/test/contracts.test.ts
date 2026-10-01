import type { FastifyBaseLogger } from 'fastify';
import Stripe from 'stripe';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MeDto, ContractNoticeReceipt, OrderDto, PublicConfig } from '@kaufcheck/shared';
import type { BuiltApp } from '../src/app';
import { StripeBillingService } from '../src/infrastructure/billing/stripe-billing-service';
import { createDb, type Db } from '../src/infrastructure/db/client';
import type { EmailMessage } from '../src/infrastructure/email/email-service';
import {
  CapturingEmailService,
  createTestApp,
  errorOf,
  resetDatabase,
  TestClient,
  testConfig,
} from './helpers';

const WEBHOOK_SECRET = 'whsec_test_contracts_secret';
const OPERATOR = {
  VITE_IMPRINT_NAME: 'Erika Musterfrau',
  VITE_IMPRINT_ADDRESS: 'Musterstraße 1|12345 Musterstadt',
  VITE_CONTACT_EMAIL: 'kontakt@kaufcheck.example',
  VITE_CONTACT_PHONE: '+49 30 1234567',
};
const PERIOD_END = Math.floor(Date.UTC(2031, 0, 15, 10) / 1000);
const CONSENTS = { acceptTerms: true, requestImmediateStart: true };

const silentLogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
} as unknown as FastifyBaseLogger;

/** E-mail that can be switched to fail, like an SMTP server that is down. */
class SwitchableEmailService extends CapturingEmailService {
  failing = false;
  override send(message: EmailMessage): Promise<void> {
    if (this.failing) return Promise.reject(new Error('SMTP unavailable'));
    return super.send(message);
  }
}

function price(overrides: Partial<Stripe.Price> = {}): Stripe.Price {
  return {
    id: 'price_pro',
    object: 'price',
    active: true,
    currency: 'eur',
    type: 'recurring',
    billing_scheme: 'per_unit',
    unit_amount: 499,
    tax_behavior: 'unspecified',
    recurring: {
      interval: 'month',
      interval_count: 1,
      usage_type: 'licensed',
      trial_period_days: null,
      meter: null,
    },
    ...overrides,
  } as Stripe.Price;
}

function subscription(
  userId: string,
  overrides: { status?: Stripe.Subscription.Status; cancel_at_period_end?: boolean } = {},
) {
  return {
    id: 'sub_test_1',
    object: 'subscription',
    customer: 'cus_test_1',
    status: overrides.status ?? 'active',
    cancel_at_period_end: overrides.cancel_at_period_end ?? false,
    metadata: { userId },
    items: { object: 'list', data: [{ id: 'si_1', current_period_end: PERIOD_END }] },
  } as unknown as Stripe.Subscription;
}

describe('KaufCheck Pro contracts', () => {
  let built: BuiltApp;
  let db: Db;
  const email = new SwitchableEmailService();
  const stripe = new Stripe('sk_test_contracts_dummy');
  const checkoutCreate = vi.spyOn(stripe.checkout.sessions, 'create');
  const subscriptionUpdate = vi.spyOn(stripe.subscriptions, 'update');
  const subscriptionCancel = vi.spyOn(stripe.subscriptions, 'cancel');
  const subscriptionRetrieve = vi.spyOn(stripe.subscriptions, 'retrieve');

  beforeAll(async () => {
    vi.spyOn(stripe.prices, 'retrieve').mockResolvedValue(price() as never);
    vi.spyOn(stripe.customers, 'create').mockResolvedValue({ id: 'cus_test_1' } as never);
    db = createDb(testConfig().databaseUrl);
    const billing = new StripeBillingService(
      db,
      {
        secretKey: 'sk_test_contracts_dummy',
        webhookSecret: WEBHOOK_SECRET,
        priceIdPro: 'price_pro',
        paymentMethods: ['card'],
        vatMode: 'small_business',
        client: stripe,
      },
      silentLogger,
    );
    built = await createTestApp(OPERATOR, { db, billing, email });
  });
  beforeEach(async () => {
    await resetDatabase(db);
    email.sent.length = 0;
    email.failing = false;
    checkoutCreate.mockReset();
    checkoutCreate.mockResolvedValue({
      id: 'cs_test_1',
      url: 'https://checkout.stripe.com/c/pay/cs_test_1',
    } as never);
    subscriptionUpdate.mockReset();
    subscriptionCancel.mockReset();
    subscriptionRetrieve.mockReset();
  });
  afterAll(() => built.app.close());

  function sendWebhook(event: unknown) {
    const payload = JSON.stringify(event);
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
    return built.app.inject({
      method: 'POST',
      url: '/api/billing/webhook',
      headers: { 'content-type': 'application/json', 'stripe-signature': signature },
      payload,
    });
  }

  function checkoutCompleted(id: string, userId: string, orderId: string) {
    return {
      id,
      object: 'event',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_1',
          object: 'checkout.session',
          subscription: 'sub_test_1',
          client_reference_id: userId,
          metadata: { orderId, userId },
        },
      },
    };
  }

  /** Registers, orders and pays: returns the client with a concluded contract. */
  async function subscribe() {
    const client = new TestClient(built.app);
    const account = await client.register();
    const ordered = await client.post('/api/billing/orders', CONSENTS);
    expect(ordered.statusCode, ordered.body).toBe(201);
    const { number } = ordered.json<{ number: string }>();
    const order = await db.order.findUniqueOrThrow({ where: { number } });
    subscriptionRetrieve.mockResolvedValue(subscription(account.id) as never);
    const paid = await sendWebhook(checkoutCompleted(`evt_${number}`, account.id, order.id));
    expect(paid.statusCode, paid.body).toBe(200);
    email.sent.length = 0;
    return { client, account, number };
  }

  it('offers Pro with the price Stripe charges', async () => {
    const config = (await new TestClient(built.app).get('/api/config')).json<PublicConfig>();
    expect(config.features.billing).toBe(true);
    expect(config.pro.offer).toEqual({
      priceCents: 499,
      currency: 'eur',
      interval: 'month',
      vatMode: 'small_business',
      paymentMethods: ['card'],
    });
  });

  it('takes an order only with both consents and confirms that it arrived', async () => {
    const anonymous = await new TestClient(built.app).post('/api/billing/orders', CONSENTS);
    expect(anonymous.statusCode).toBe(401);

    const client = new TestClient(built.app);
    const account = await client.register();
    const withoutConsent = await client.post('/api/billing/orders', {
      acceptTerms: true,
      requestImmediateStart: false,
    });
    expect(withoutConsent.statusCode).toBe(400);
    expect(errorOf(withoutConsent).message).toContain('sofort');

    const ordered = await client.post('/api/billing/orders', CONSENTS);
    expect(ordered.statusCode, ordered.body).toBe(201);
    const { number, url } = ordered.json<{ number: string; url: string }>();
    expect(number).toMatch(/^KC-[0-9A-Z]{8}$/);
    expect(url).toBe('https://checkout.stripe.com/c/pay/cs_test_1');

    const order = await db.order.findUniqueOrThrow({ where: { number } });
    expect(order).toMatchObject({
      status: 'PENDING',
      userId: account.id,
      priceCents: 499,
      termsVersion: '2026-10-01',
      checkoutSessionId: 'cs_test_1',
    });
    expect(order.termsAcceptedAt).toBeInstanceOf(Date);
    expect(order.immediateStartRequestedAt).toBeInstanceOf(Date);
    expect(JSON.stringify(order.consentTexts)).toContain('Ich verlange ausdrücklich');

    const params = checkoutCreate.mock.calls[0]?.[0];
    expect(params).toMatchObject({
      mode: 'subscription',
      payment_method_types: ['card'],
      metadata: { orderId: order.id, orderNumber: number },
      subscription_data: { metadata: { orderId: order.id, userId: account.id } },
    });
    expect(params?.success_url).toContain(`/pro/bestellt?bestellung=${number}`);
    const submit = params?.custom_text?.submit;
    expect(submit && typeof submit === 'object' ? submit.message : '').toContain(
      `${number} hast du bei KaufCheck bereits zahlungspflichtig`,
    );
    expect(params).not.toHaveProperty('allow_promotion_codes');

    expect(email.sent).toHaveLength(1);
    expect(email.sent[0]).toMatchObject({
      to: account.email,
      subject: `Deine Bestellung ${number} ist eingegangen`,
      replyTo: OPERATOR.VITE_CONTACT_EMAIL,
    });
    expect(email.sent[0]?.text).toContain('Das ist eine Eingangsbestätigung');

    const status = (await client.get(`/api/billing/orders/${number}`)).json<OrderDto>();
    expect(status).toMatchObject({ number, status: 'pending', concludedAt: null });
    const stranger = new TestClient(built.app);
    await stranger.register();
    expect((await stranger.get(`/api/billing/orders/${number}`)).statusCode).toBe(404);
  });

  it('concludes the contract after payment and confirms it with terms and withdrawal notice', async () => {
    const client = new TestClient(built.app);
    const account = await client.register();
    const { number } = (await client.post('/api/billing/orders', CONSENTS)).json<{
      number: string;
    }>();
    const order = await db.order.findUniqueOrThrow({ where: { number } });
    email.sent.length = 0;
    subscriptionRetrieve.mockResolvedValue(subscription(account.id) as never);

    // An SMTP outage: Pro is active, the event is retried until the confirmation is out.
    email.failing = true;
    const failed = await sendWebhook(checkoutCompleted('evt_paid', account.id, order.id));
    expect(failed.statusCode).toBe(500);
    expect((await db.user.findUniqueOrThrow({ where: { id: account.id } })).plan).toBe('PRO');
    email.failing = false;
    const retried = await sendWebhook(checkoutCompleted('evt_paid', account.id, order.id));
    expect(retried.statusCode, retried.body).toBe(200);

    const concluded = await db.order.findUniqueOrThrow({ where: { number } });
    expect(concluded.status).toBe('CONCLUDED');
    expect(concluded.subscriptionId).toBe('sub_test_1');
    expect(concluded.confirmationSentAt).toBeInstanceOf(Date);

    expect(email.sent).toHaveLength(1);
    const confirmation = email.sent[0];
    expect(confirmation?.to).toBe(account.email);
    expect(confirmation?.subject).toBe(`Vertragsbestätigung KaufCheck Pro – Bestellung ${number}`);
    for (const text of [
      'Dein Vertrag über KaufCheck Pro ist geschlossen',
      'Telefon: +49 30 1234567',
      '4,99',
      'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.',
      'Ich verlange ausdrücklich, dass KaufCheck Pro sofort nach Vertragsschluss bereitgestellt wird',
      'ALLGEMEINE GESCHÄFTSBEDINGUNGEN FÜR KAUFCHECK PRO',
      'WIDERRUFSBELEHRUNG',
      'Sie können Ihr Widerrufsrecht auch online unter http://localhost:5173/vertrag-widerrufen',
      'Haben Sie verlangt, dass die Dienstleistungen während der Widerrufsfrist beginnen soll',
      'MUSTER-WIDERRUFSFORMULAR',
      'die Erbringung der folgenden Dienstleistung (*)',
    ]) {
      expect(confirmation?.text).toContain(text);
    }

    // A replayed event does not send a second confirmation.
    expect(
      (await sendWebhook(checkoutCompleted('evt_paid', account.id, order.id))).statusCode,
    ).toBe(200);
    expect(email.sent).toHaveLength(1);

    const me = (await client.get('/api/me')).json<MeDto>();
    expect(me.plan).toBe('pro');
    expect(me.contract).toMatchObject({ orderNumber: number });
    expect(me.contract?.withdrawalEndsAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const status = (await client.get(`/api/billing/orders/${number}`)).json<OrderDto>();
    expect(status.status).toBe('concluded');
  });

  it('marks an order as abandoned when its payment page expires', async () => {
    const client = new TestClient(built.app);
    await client.register();
    const { number } = (await client.post('/api/billing/orders', CONSENTS)).json<{
      number: string;
    }>();
    const order = await db.order.findUniqueOrThrow({ where: { number } });
    const expired = await sendWebhook({
      id: 'evt_expired',
      object: 'event',
      type: 'checkout.session.expired',
      data: {
        object: { id: 'cs_test_1', object: 'checkout.session', metadata: { orderId: order.id } },
      },
    });
    expect(expired.statusCode).toBe(200);
    expect((await db.order.findUniqueOrThrow({ where: { number } })).status).toBe('ABANDONED');
  });

  it('refuses a second subscription', async () => {
    const { client } = await subscribe();
    const again = await client.post('/api/billing/orders', CONSENTS);
    expect(again.statusCode).toBe(400);
    expect(errorOf(again).message).toBe('Du hast bereits KaufCheck Pro.');
  });

  describe('cancellation button (§ 312k BGB)', () => {
    it('cancels without signing in and confirms content, time and end of the contract', async () => {
      const { account, number } = await subscribe();
      subscriptionUpdate.mockResolvedValue(
        subscription(account.id, { cancel_at_period_end: true }) as never,
      );
      const visitor = new TestClient(built.app);
      const response = await visitor.post('/api/contracts/cancellations', {
        kind: 'ordinary',
        name: 'Max Mustermann',
        email: account.email,
        orderNumber: '',
        endDate: '',
      });
      expect(response.statusCode, response.body).toBe(201);
      const receipt = response.json<ContractNoticeReceipt>();
      expect(receipt).toMatchObject({
        type: 'cancellation',
        kind: 'ordinary',
        outcome: 'scheduled',
        effectiveEnd: new Date(PERIOD_END * 1000).toISOString(),
        confirmationSent: true,
        contract: 'KaufCheck Pro (Monatsabo)',
      });
      expect(receipt.number).toMatch(/^KC-K-[0-9A-Z]{6}$/);
      expect(subscriptionUpdate).toHaveBeenCalledWith('sub_test_1', {
        cancel_at_period_end: true,
        cancellation_details: { comment: `Kündigung ${receipt.number} über die Website` },
      });

      expect(email.sent).toHaveLength(1);
      expect(email.sent[0]?.to).toBe(account.email);
      expect(email.sent[0]?.subject).toBe(`Bestätigung deiner Kündigung ${receipt.number}`);
      for (const text of [
        'abgegeben über die Schaltfläche „jetzt kündigen“',
        'Eingegangen am:',
        ' Uhr',
        'Art der Kündigung: ordentliche Kündigung',
        'Name: Max Mustermann',
        'Gewünschtes Vertragsende: zum nächstmöglichen Zeitpunkt',
        'Dein Vertrag endet zum 15. Januar 2031.',
      ]) {
        expect(email.sent[0]?.text).toContain(text);
      }
      const me = (await new TestClient(built.app).get('/api/me')).json<MeDto>();
      expect(me.user).toBeNull();
      const stored = await db.contractNotice.findUniqueOrThrow({
        where: { number: receipt.number },
      });
      expect(stored).toMatchObject({
        type: 'CANCELLATION',
        userId: account.id,
        outcome: 'scheduled',
      });
      expect(number).toMatch(/^KC-/);
    });

    it('needs a reason for an extraordinary cancellation and hands it to the operator', async () => {
      const { client, account } = await subscribe();
      subscriptionUpdate.mockResolvedValue(
        subscription(account.id, { cancel_at_period_end: true }) as never,
      );
      const withoutReason = await client.post('/api/contracts/cancellations', {
        kind: 'extraordinary',
        name: 'Max Mustermann',
        email: account.email,
      });
      expect(withoutReason.statusCode).toBe(400);

      const response = await client.post('/api/contracts/cancellations', {
        kind: 'extraordinary',
        reason: 'Der Dienst war zwei Wochen nicht erreichbar.',
        name: 'Max Mustermann',
        email: account.email,
      });
      const receipt = response.json<ContractNoticeReceipt>();
      expect(receipt).toMatchObject({ outcome: 'review', kind: 'extraordinary' });
      // The ordinary cancellation applies in any case.
      expect(receipt.effectiveEnd).toBe(new Date(PERIOD_END * 1000).toISOString());
      const recipients = email.sent.map((message) => message.to);
      expect(recipients).toEqual([account.email, OPERATOR.VITE_CONTACT_EMAIL]);
      expect(email.sent[1]?.text).toContain('Grund: Der Dienst war zwei Wochen nicht erreichbar.');
    });

    it('confirms a cancellation it cannot match and asks the operator to check it', async () => {
      const response = await new TestClient(built.app).post('/api/contracts/cancellations', {
        kind: 'ordinary',
        name: 'Unbekannt',
        email: 'jemand@example.com',
      });
      const receipt = response.json<ContractNoticeReceipt>();
      expect(receipt).toMatchObject({
        outcome: 'review',
        effectiveEnd: null,
        confirmationSent: true,
      });
      expect(email.sent.map((message) => message.to)).toEqual([
        'jemand@example.com',
        OPERATOR.VITE_CONTACT_EMAIL,
      ]);
      expect(email.sent[0]?.text).toContain('noch keinen laufenden Vertrag zuordnen');
      expect(subscriptionUpdate).not.toHaveBeenCalled();
    });

    it('passes a later end date on once its billing month has begun', async () => {
      const { client, account } = await subscribe();
      const response = await client.post('/api/contracts/cancellations', {
        kind: 'ordinary',
        name: 'Max Mustermann',
        email: account.email,
        endDate: '2031-03-20',
      });
      const receipt = response.json<ContractNoticeReceipt>();
      expect(receipt).toMatchObject({ outcome: 'scheduled_later', requestedEndDate: '2031-03-20' });
      expect(email.sent[0]?.text).toContain('in den der 20. März 2031 fällt');
      expect(subscriptionUpdate).not.toHaveBeenCalled();

      await built.services.contracts.runMaintenance();
      expect(subscriptionUpdate).not.toHaveBeenCalled();

      // The billing month that contains 20 March has begun.
      await db.subscription.update({
        where: { userId: account.id },
        data: { currentPeriodEnd: new Date('2031-04-15T10:00:00Z') },
      });
      subscriptionUpdate.mockResolvedValue(
        subscription(account.id, { cancel_at_period_end: true }) as never,
      );
      const report = await built.services.contracts.runMaintenance();
      expect(report.laterCancellations).toBe(1);
      expect(subscriptionUpdate).toHaveBeenCalledTimes(1);
      const stored = await db.contractNotice.findUniqueOrThrow({
        where: { number: receipt.number },
      });
      expect(stored.appliedAt).toBeInstanceOf(Date);
    });
  });

  describe('withdrawal function (§ 356a BGB)', () => {
    it('ends the subscription of a signed-in customer and tells the operator what to refund', async () => {
      const { client, account, number } = await subscribe();
      subscriptionCancel.mockResolvedValue(
        subscription(account.id, { status: 'canceled' }) as never,
      );
      const response = await client.post('/api/contracts/withdrawals', {
        name: 'Max Mustermann',
        email: account.email,
        orderNumber: number,
      });
      expect(response.statusCode, response.body).toBe(201);
      const receipt = response.json<ContractNoticeReceipt>();
      expect(receipt).toMatchObject({
        type: 'withdrawal',
        outcome: 'withdrawn',
        contract: `KaufCheck Pro (Monatsabo), Bestellnummer ${number}`,
        confirmationSent: true,
      });
      expect(subscriptionCancel).toHaveBeenCalledWith('sub_test_1', {
        cancellation_details: { comment: `Widerruf ${receipt.number} über die Website` },
      });
      expect((await db.user.findUniqueOrThrow({ where: { id: account.id } })).plan).toBe('FREE');

      const [toCustomer, toOperator] = email.sent;
      expect(toCustomer?.subject).toBe(`Eingangsbestätigung deines Widerrufs ${receipt.number}`);
      expect(toCustomer?.text).toContain('übermittelt über die Schaltfläche „Widerruf bestätigen“');
      expect(toCustomer?.text).toContain(
        'Hiermit widerrufe ich den von mir abgeschlossenen Vertrag über die Erbringung der folgenden Dienstleistung',
      );
      expect(toOperator?.to).toBe(OPERATOR.VITE_CONTACT_EMAIL);
      expect(toOperator?.text).toContain('Erstatte innerhalb von 14 Tagen');
    });

    it('confirms a withdrawal without signing in and leaves it to the operator', async () => {
      const { account, number } = await subscribe();
      const response = await new TestClient(built.app).post('/api/contracts/withdrawals', {
        name: 'Max Mustermann',
        email: account.email,
        orderNumber: number,
      });
      const receipt = response.json<ContractNoticeReceipt>();
      expect(receipt).toMatchObject({ outcome: 'review', confirmationSent: true });
      expect(subscriptionCancel).not.toHaveBeenCalled();
      expect(email.sent.map((message) => message.to)).toEqual([
        account.email,
        OPERATOR.VITE_CONTACT_EMAIL,
      ]);
      expect(email.sent[1]?.text).toContain(`Bestellung: ${number}`);
    });

    it('validates the declaration', async () => {
      const response = await new TestClient(built.app).post('/api/contracts/withdrawals', {
        name: 'M',
        email: 'keine-adresse',
      });
      expect(response.statusCode).toBe(400);
    });
  });
});

describe('Pro without a valid Stripe price', () => {
  it('stays unavailable when the price would add taxes on top', async () => {
    const stripe = new Stripe('sk_test_contracts_dummy');
    vi.spyOn(stripe.prices, 'retrieve').mockResolvedValue(
      price({ tax_behavior: 'exclusive' }) as never,
    );
    const db = createDb(testConfig().databaseUrl);
    const billing = new StripeBillingService(
      db,
      {
        secretKey: 'sk_test_contracts_dummy',
        webhookSecret: WEBHOOK_SECRET,
        priceIdPro: 'price_pro',
        paymentMethods: ['card'],
        vatMode: 'standard',
        client: stripe,
      },
      silentLogger,
    );
    const built = await createTestApp(OPERATOR, {
      db,
      billing,
      email: new CapturingEmailService(),
    });
    try {
      const config = (await new TestClient(built.app).get('/api/config')).json<PublicConfig>();
      expect(config.features.billing).toBe(false);
      expect(config.pro.offer).toBeNull();
    } finally {
      await built.app.close();
    }
  });
});
