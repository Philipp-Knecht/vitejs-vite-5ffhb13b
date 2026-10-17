import type {
  CarRemindersResponse,
  OwnedCarDto,
  OwnedCarInput,
  PublicConfig,
  ReminderInput,
} from '@kaufcheck/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { BuiltApp } from '../src/app';
import { ReminderService } from '../src/application/reminder-service';
import type { EmailMessage } from '../src/infrastructure/email/email-service';
import {
  CapturingEmailService,
  createTestApp,
  errorOf,
  resetDatabase,
  TestClient,
} from './helpers';

const OPERATOR = {
  VITE_IMPRINT_NAME: 'Erika Musterfrau',
  VITE_IMPRINT_ADDRESS: 'Musterstraße 1|12345 Musterstadt',
  VITE_CONTACT_EMAIL: 'kontakt@kaufcheck.example',
};

const OPERATOR_INFO = {
  name: 'Erika Musterfrau',
  addressLines: ['Musterstraße 1', '12345 Musterstadt'],
  email: 'kontakt@kaufcheck.example',
  phone: '+49 30 1234567',
};

const CAR: OwnedCarInput = {
  nickname: null,
  makeId: 'vw',
  modelId: 'vw-golf',
  modelName: 'Golf',
  generationId: null,
  fuel: 'petrol',
  firstRegistration: { year: 2017, month: 3 },
  mileageKm: 98_000,
  huUntil: { year: 2026, month: 11 },
};

/** E-mail that can be switched to fail, like an SMTP server that is down. */
class SwitchableEmailService extends CapturingEmailService {
  failing = false;
  override send(message: EmailMessage): Promise<void> {
    if (this.failing) return Promise.reject(new Error('SMTP down'));
    return super.send(message);
  }
}

const on = (month: ReminderInput['month'] = null): ReminderInput => ({ email: true, month });

describe('Reminders', () => {
  let built: BuiltApp;
  const email = new SwitchableEmailService();
  // 15 October 2026, 10:00 in Berlin.
  let now = new Date('2026-10-15T08:00:00Z');

  beforeAll(async () => {
    built = await createTestApp(OPERATOR, { email, now: () => now });
  });
  beforeEach(async () => {
    await resetDatabase(built.services.db);
    email.sent.length = 0;
    email.failing = false;
    now = new Date('2026-10-15T08:00:00Z');
  });
  afterAll(() => built.app.close());

  async function owner(plan: 'FREE' | 'PRO' = 'PRO', car: OwnedCarInput = CAR) {
    const client = new TestClient(built.app, () => now);
    const account = await client.register();
    if (plan === 'PRO')
      await built.services.db.user.update({ where: { id: account.id }, data: { plan } });
    const created = (await client.post('/api/owned-cars', car)).json<OwnedCarDto>();
    return { client, car: created, account };
  }

  const path = (carId: string, kind = '') =>
    `/api/owned-cars/${carId}/reminders${kind ? `/${kind}` : ''}`;

  async function confirmed(client: TestClient, carId: string) {
    expect((await client.put(path(carId, 'hu'), on())).statusCode).toBe(200);
    const link = /https?:\/\/\S+erinnerungen-bestaetigen\?token=(\S+)/.exec(
      email.sent.at(-1)!.text,
    );
    const token = decodeURIComponent(link![1]!);
    expect((await client.post('/api/reminders/confirm', { token })).statusCode).toBe(204);
    email.sent.length = 0;
  }

  it('lists the reminders of a car, all off at first', async () => {
    const { client, car, account } = await owner();
    const response = await client.get(path(car.id));
    expect(response.statusCode).toBe(200);
    expect(response.json<CarRemindersResponse>()).toEqual({
      items: [
        { kind: 'hu', email: false, month: null, lastSentKey: null, editable: true },
        { kind: 'service', email: false, month: null, lastSentKey: null, editable: true },
        { kind: 'brakeFluid', email: false, month: null, lastSentKey: null, editable: true },
        { kind: 'tyres', email: false, month: null, lastSentKey: null, editable: true },
      ],
      emailAddress: account.email,
      emailConfirmed: false,
      confirmationPending: false,
      editable: true,
    });
    const config = (await client.get('/api/config')).json<PublicConfig>();
    expect(config.features.reminders).toBe(true);
  });

  it('confirms the address with a link before the first reminder', async () => {
    const { client, car, account } = await owner();
    const saved = await client.put(path(car.id, 'hu'), on());
    expect(saved.statusCode).toBe(200);
    expect(saved.json<CarRemindersResponse>()).toMatchObject({
      emailConfirmed: false,
      confirmationPending: true,
      confirmationSent: true,
    });
    expect(email.sent).toHaveLength(1);
    const mail = email.sent[0]!;
    expect(mail.to).toBe(account.email);
    expect(mail.subject).toBe('KaufCheck: E-Mail-Adresse für Erinnerungen bestätigen');
    expect(mail.text).toContain('Erika Musterfrau');

    // Switching on another reminder does not send a second link right away.
    await client.put(path(car.id, 'tyres'), on());
    expect(email.sent).toHaveLength(1);
    const again = await client.post('/api/reminders/confirmation');
    expect(again.statusCode).toBe(429);

    // Nothing is sent before the confirmation.
    expect(await built.services.reminders.sendDue()).toEqual({
      remindersSent: 0,
      remindersFailed: 0,
    });

    const token = decodeURIComponent(/token=(\S+)/.exec(mail.text)![1]!);
    // The link works without being signed in.
    const anonymous = new TestClient(built.app, () => now);
    expect((await anonymous.post('/api/reminders/confirm', { token })).statusCode).toBe(204);
    expect((await anonymous.post('/api/reminders/confirm', { token })).statusCode).toBe(400);
    const list = (await client.get(path(car.id))).json<CarRemindersResponse>();
    expect(list).toMatchObject({ emailConfirmed: true, confirmationPending: false });

    // A new link after ten minutes; it expires after 48 hours.
    const other = await owner();
    await other.client.put(path(other.car.id, 'hu'), on());
    now = new Date(now.getTime() + 11 * 60 * 1000);
    expect((await other.client.post('/api/reminders/confirmation')).statusCode).toBe(204);
    const late = decodeURIComponent(/token=(\S+)/.exec(email.sent.at(-1)!.text)![1]!);
    now = new Date(now.getTime() + 49 * 60 * 60 * 1000);
    const expired = await other.client.post('/api/reminders/confirm', { token: late });
    expect(expired.statusCode).toBe(400);
    expect(errorOf(expired).message).toContain('abgelaufen');
  });

  it('sends what is due once, with a one-click unsubscribe link and no advertising', async () => {
    const { client, car, account } = await owner();
    await confirmed(client, car.id);
    await client.put(path(car.id, 'service'), on({ year: 2026, month: 10 }));
    await client.put(path(car.id, 'brakeFluid'), on({ year: 2024, month: 11 }));
    await client.put(path(car.id, 'tyres'), on());

    const report = await built.services.reminders.sendDue();
    expect(report).toEqual({ remindersSent: 4, remindersFailed: 0 });
    const subjects = email.sent.map((mail) => mail.subject).sort();
    expect(subjects).toEqual([
      'Erinnerung: Bremsflüssigkeit für Volkswagen Golf im November 2026',
      'Erinnerung: HU für Volkswagen Golf bis Ende November 2026',
      'Erinnerung: Inspektion für Volkswagen Golf im Oktober 2026',
      'Erinnerung: Winterreifen für Volkswagen Golf',
    ]);
    for (const mail of email.sent) {
      expect(mail.to).toBe(account.email);
      expect(mail.text).not.toMatch(/Pro\b|Angebot|Rabatt/);
      expect(mail.text).toContain('Impressum: http://localhost:5173/impressum');
      expect(mail.headers?.['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
      expect(mail.headers?.['List-Unsubscribe']).toMatch(
        /^<http:\/\/localhost:5173\/api\/reminders\/unsubscribe\?r=[0-9a-f-]{36}&t=[\w-]+>$/,
      );
    }

    // Each due date once.
    expect(await built.services.reminders.sendDue()).toEqual({
      remindersSent: 0,
      remindersFailed: 0,
    });

    // The mail provider's one-click POST: form-encoded, no cookies, no Origin.
    const hu = email.sent.find((mail) => mail.subject.includes('HU'))!;
    const url = new URL(/^<(.+)>$/.exec(hu.headers!['List-Unsubscribe']!)![1]!);
    // The page behind the link names the reminder before asking.
    const info = await built.app.inject({ method: 'GET', url: `${url.pathname}${url.search}` });
    expect(info.json()).toEqual({
      kind: 'hu',
      carName: 'Volkswagen Golf',
      email: true,
    });
    const oneClick = await built.app.inject({
      method: 'POST',
      url: `${url.pathname}${url.search}`,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'List-Unsubscribe=One-Click',
    });
    expect(oneClick.statusCode).toBe(204);
    const list = (await client.get(path(car.id))).json<CarRemindersResponse>();
    expect(list.items.find((item) => item.kind === 'hu')!.email).toBe(false);
    expect(list.items.find((item) => item.kind === 'tyres')!.email).toBe(true);

    // RFC 8058 prefers multipart/form-data.
    const tyres = email.sent.find((mail) => mail.subject.includes('Winterreifen'))!;
    const tyresUrl = new URL(/^<(.+)>$/.exec(tyres.headers!['List-Unsubscribe']!)![1]!);
    const boundary = 'kaufcheck-boundary';
    const multipart = await built.app.inject({
      method: 'POST',
      url: `${tyresUrl.pathname}${tyresUrl.search}`,
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: `--${boundary}\r\nContent-Disposition: form-data; name="List-Unsubscribe"\r\n\r\nOne-Click\r\n--${boundary}--\r\n`,
    });
    expect(multipart.statusCode).toBe(204);

    // The page behind the link in the text posts JSON; repeating it does no harm.
    const reminder = url.searchParams.get('r')!;
    const token = url.searchParams.get('t')!;
    const anonymous = new TestClient(built.app, () => now);
    const again = await anonymous.post('/api/reminders/unsubscribe', { reminder, token });
    expect(again.statusCode).toBe(204);
    const forged = await anonymous.post('/api/reminders/unsubscribe', {
      reminder,
      token: `${token.slice(0, -2)}xx`,
    });
    expect(forged.statusCode).toBe(400);
  });

  it('waits for the next due date and tries again after a failure', async () => {
    const { client, car } = await owner();
    await confirmed(client, car.id);
    // October: the month before the HU month.
    email.failing = true;
    expect(await built.services.reminders.sendDue()).toEqual({
      remindersSent: 0,
      remindersFailed: 1,
    });
    email.failing = false;
    expect((await built.services.reminders.sendDue()).remindersSent).toBe(1);

    // After the HU the owner enters the new badge: a reminder for that date later.
    await client.put(`/api/owned-cars/${car.id}`, { ...CAR, huUntil: { year: 2028, month: 11 } });
    email.sent.length = 0;
    expect((await built.services.reminders.sendDue()).remindersSent).toBe(0);
    now = new Date('2028-10-02T08:00:00Z');
    expect((await built.services.reminders.sendDue()).remindersSent).toBe(1);
    expect(email.sent[0]!.subject).toBe(
      'Erinnerung: HU für Volkswagen Golf bis Ende November 2028',
    );
  });

  it('claims no further due dates once the server stops', async () => {
    const { client, car } = await owner();
    await confirmed(client, car.id);
    const service = new ReminderService(
      built.services.db,
      email,
      {
        siteUrl: 'http://localhost:5173',
        operator: OPERATOR_INFO,
        secret: 'x'.repeat(32),
        now: () => now,
      },
      built.app.log,
    );
    service.stop();
    expect(await service.sendDue()).toEqual({ remindersSent: 0, remindersFailed: 0 });
    expect((await built.services.reminders.sendDue()).remindersSent).toBe(1);
  });

  it('checks the months it needs', async () => {
    const { client, car } = await owner();
    const cases: [string, ReminderInput, string][] = [
      ['service', on({ year: 2026, month: 9 }), 'Vergangenheit'],
      ['service', on({ year: 2032, month: 1 }), 'fünf Jahre'],
      ['service', on(), 'nächste Inspektion'],
      ['brakeFluid', on({ year: 2026, month: 11 }), 'Zukunft'],
      ['brakeFluid', on(), 'zuletzt gewechselt'],
      ['hu', on({ year: 2026, month: 11 }), 'keinen Monat'],
    ];
    for (const [kind, input, message] of cases) {
      const response = await client.put(path(car.id, kind), input);
      expect(response.statusCode, kind).toBe(400);
      expect(errorOf(response).message).toContain(message);
    }
    expect((await client.put(path(car.id, 'oil'), on())).statusCode).toBe(404);
    // A month can be kept without the e-mail, e.g. for the calendar file.
    const saved = await client.put(path(car.id, 'service'), {
      email: false,
      month: { year: 2027, month: 4 },
    });
    expect(saved.statusCode).toBe(200);
    expect(email.sent).toHaveLength(0);

    const stranger = await owner();
    expect((await stranger.client.get(path(car.id))).statusCode).toBe(404);
    expect((await stranger.client.put(path(car.id, 'hu'), on())).statusCode).toBe(404);
    const anonymous = new TestClient(built.app, () => now);
    expect((await anonymous.get(path(car.id))).statusCode).toBe(401);
  });

  it('sends the HU reminder without Pro; the others need Pro and stop when it ends', async () => {
    const huSubject = 'Erinnerung: HU für Volkswagen Golf bis Ende November 2026';
    const free = await owner('FREE');
    const list = (await free.client.get(path(free.car.id))).json<CarRemindersResponse>();
    expect(list.editable).toBe(false);
    expect(list.items.map((item) => [item.kind, item.editable])).toEqual([
      ['hu', true],
      ['service', false],
      ['brakeFluid', false],
      ['tyres', false],
    ]);
    const denied = await free.client.put(path(free.car.id, 'tyres'), on());
    expect(denied.statusCode).toBe(403);
    expect(errorOf(denied).code).toBe('PLAN_LIMIT_REACHED');
    await confirmed(free.client, free.car.id);
    expect(await built.services.reminders.sendDue()).toEqual({
      remindersSent: 1,
      remindersFailed: 0,
    });
    expect(email.sent.map((mail) => mail.subject)).toEqual([huSubject]);
    email.sent.length = 0;

    const { client, car, account } = await owner();
    await confirmed(client, car.id);
    await client.put(path(car.id, 'service'), on({ year: 2026, month: 10 }));
    await built.services.db.user.update({ where: { id: account.id }, data: { plan: 'FREE' } });
    expect(await built.services.reminders.sendDue()).toEqual({
      remindersSent: 1,
      remindersFailed: 0,
    });
    expect(email.sent.map((mail) => mail.subject)).toEqual([huSubject]);
    // Changing the month needs Pro, switching off does not.
    const changed = await client.put(path(car.id, 'service'), {
      email: false,
      month: { year: 2027, month: 1 },
    });
    expect(changed.statusCode).toBe(403);
    const off = await client.put(path(car.id, 'service'), {
      email: false,
      month: { year: 2026, month: 10 },
    });
    expect(off.statusCode).toBe(200);
    const items = off.json<CarRemindersResponse>().items;
    expect(items.find((item) => item.kind === 'service')).toEqual({
      kind: 'service',
      email: false,
      month: { year: 2026, month: 10 },
      lastSentKey: null,
      editable: false,
    });
  });

  it('switches off whatever the month, but does not switch on what could never send', async () => {
    const { client, car } = await owner();
    await confirmed(client, car.id);
    await client.put(path(car.id, 'service'), on({ year: 2026, month: 10 }));
    // Months later the saved month lies in the past; switching off still works.
    await built.services.db.carReminder.updateMany({ data: { year: 2026, month: 7 } });
    const off = await client.put(path(car.id, 'service'), {
      email: false,
      month: { year: 2026, month: 7 },
    });
    expect(off.statusCode).toBe(200);

    // Brake fluid changed more than two years ago: the due month has passed.
    const late = await client.put(path(car.id, 'brakeFluid'), on({ year: 2024, month: 6 }));
    expect(late.statusCode).toBe(400);
    expect(errorOf(late).message).toContain('mehr als zwei Jahre zurück');
    // An HU that has expired already.
    const expired = await owner('PRO', { ...CAR, huUntil: { year: 2026, month: 8 } });
    const hu = await expired.client.put(path(expired.car.id, 'hu'), on());
    expect(hu.statusCode).toBe(400);
    expect(errorOf(hu).message).toContain('abgelaufen');

    const noHu = await owner('PRO', { ...CAR, huUntil: null });
    const missing = await noHu.client.put(path(noHu.car.id, 'hu'), on());
    expect(missing.statusCode).toBe(400);
    expect(errorOf(missing).message).toContain('Prüfplakette');
  });

  it('switches nothing on when the confirmation link cannot be sent, and limits links', async () => {
    const { client, car } = await owner();
    email.failing = true;
    const failed = await client.put(path(car.id, 'hu'), on());
    expect(failed.statusCode).toBe(503);
    const list = (await client.get(path(car.id))).json<CarRemindersResponse>();
    expect(list.items.every((item) => !item.email)).toBe(true);
    expect(list.confirmationPending).toBe(false);
    email.failing = false;

    // Three links a day at most, also on request.
    for (let round = 0; round < 3; round++) {
      expect((await client.post('/api/reminders/confirmation')).statusCode).toBe(204);
      now = new Date(now.getTime() + 11 * 60 * 1000);
    }
    expect(email.sent).toHaveLength(3);
    const fourth = await client.post('/api/reminders/confirmation');
    expect(fourth.statusCode).toBe(429);
    // Switching on still works; it just sends no further link today.
    const capped = await client.put(path(car.id, 'hu'), on());
    expect(capped.statusCode).toBe(200);
    expect(capped.json<CarRemindersResponse>().confirmationSent).toBe(false);
    expect(email.sent).toHaveLength(3);
  });

  it('is unavailable without e-mail or operator details', async () => {
    const plain = await createTestApp({}, { email, now: () => now });
    try {
      const client = new TestClient(plain.app, () => now);
      const account = await client.register();
      await plain.services.db.user.update({ where: { id: account.id }, data: { plan: 'PRO' } });
      const car = (await client.post('/api/owned-cars', CAR)).json<OwnedCarDto>();
      const response = await client.put(path(car.id, 'hu'), on());
      expect(response.statusCode).toBe(503);
      const config = (await client.get('/api/config')).json<PublicConfig>();
      expect(config.features.reminders).toBe(false);
    } finally {
      await plain.app.close();
    }
  });

  it('deletes reminders with the car and the account', async () => {
    const { client, car } = await owner();
    await confirmed(client, car.id);
    expect(await built.services.db.carReminder.count()).toBe(1);
    await client.delete(`/api/owned-cars/${car.id}`);
    expect(await built.services.db.carReminder.count()).toBe(0);

    const other = await owner();
    await other.client.put(path(other.car.id, 'hu'), on());
    expect(await built.services.db.carReminder.count()).toBe(1);
    expect(await built.services.db.reminderConfirmToken.count()).toBe(1);
    const deleted = await other.client.delete('/api/account', { password: other.account.password });
    expect(deleted.statusCode).toBe(204);
    expect(await built.services.db.carReminder.count()).toBe(0);
    expect(await built.services.db.reminderConfirmToken.count()).toBe(0);
  });
});
