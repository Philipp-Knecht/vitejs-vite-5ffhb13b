import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { BuiltApp } from '../src/app';
import { sha256 } from '../src/lib/crypto';
import {
  CapturingEmailService,
  createTestApp,
  errorOf,
  PASSWORD,
  resetDatabase,
  TestClient,
  uniqueEmail,
  URLS,
} from './helpers';

interface Me {
  user: { id: string; email: string } | null;
  plan: string;
  usage: { used: number; limit: number };
}

describe('accounts and sessions', () => {
  let built: BuiltApp;
  let email: CapturingEmailService;

  beforeAll(async () => {
    email = new CapturingEmailService();
    built = await createTestApp({}, { email });
  });
  beforeEach(async () => {
    await resetDatabase(built.services.db);
    email.sent.length = 0;
  });
  afterAll(() => built.app.close());

  it('registers with a secure session cookie and signs out', async () => {
    const client = new TestClient(built.app);
    const response = await client.post('/api/auth/register', {
      email: '  Neu@Example.COM ',
      password: PASSWORD,
    });
    expect(response.statusCode, response.body).toBe(201);
    const cookie = response.cookies.find((item) => item.name === 'kc_session');
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/' });

    const me = (await client.get('/api/me')).json<Me>();
    expect(me.user?.email).toBe('neu@example.com');
    expect(me.plan).toBe('free');

    // Only the hash of the session token is stored.
    const token = client.cookie('kc_session') ?? '';
    const sessions = await built.services.db.session.findMany();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.tokenHash).toBe(sha256(token));
    expect(JSON.stringify(sessions)).not.toContain(token);

    const logout = await client.post('/api/auth/logout');
    expect(logout.statusCode).toBe(204);
    expect((await client.get('/api/me')).json<Me>().user).toBeNull();
    expect(await built.services.db.session.count()).toBe(0);
  });

  it('rejects duplicate e-mails, weak passwords and invalid addresses', async () => {
    const client = new TestClient(built.app);
    const { email: address } = await client.register();
    const duplicate = await new TestClient(built.app).post('/api/auth/register', {
      email: address.toUpperCase(),
      password: PASSWORD,
    });
    expect(duplicate.statusCode).toBe(409);
    expect(errorOf(duplicate).code).toBe('EMAIL_TAKEN');

    const weak = await new TestClient(built.app).post('/api/auth/register', {
      email: uniqueEmail(),
      password: 'kurz',
    });
    expect(weak.statusCode).toBe(400);
    expect(errorOf(weak).code).toBe('VALIDATION_ERROR');

    const invalid = await new TestClient(built.app).post('/api/auth/register', {
      email: 'keine-adresse',
      password: PASSWORD,
    });
    expect(invalid.statusCode).toBe(400);
  });

  it('gives the same answer for unknown e-mails and wrong passwords', async () => {
    const { email: address } = await new TestClient(built.app).register();
    const wrong = await new TestClient(built.app).post('/api/auth/login', {
      email: address,
      password: 'falsches-passwort',
    });
    const unknown = await new TestClient(built.app).post('/api/auth/login', {
      email: uniqueEmail(),
      password: PASSWORD,
    });
    expect(wrong.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    expect(errorOf(wrong).code).toBe('INVALID_CREDENTIALS');
    expect(errorOf(wrong).message).toBe(errorOf(unknown).message);

    const ok = await new TestClient(built.app).post('/api/auth/login', {
      email: address,
      password: PASSWORD,
    });
    expect(ok.statusCode).toBe(200);
  });

  it('attaches anonymous analyses to the account on registration and login', async () => {
    const client = new TestClient(built.app);
    const first = await client.analyzeUrl(URLS.audi);
    const account = await client.register();
    expect(
      (await built.services.db.analysis.findUniqueOrThrow({ where: { id: first.id } })).userId,
    ).toBe(account.id);

    // A second browser analyses anonymously, then logs in.
    const other = new TestClient(built.app);
    const second = await other.analyzeUrl(URLS.bmw);
    const login = await other.post('/api/auth/login', {
      email: account.email,
      password: account.password,
    });
    expect(login.statusCode).toBe(200);
    const row = await built.services.db.analysis.findUniqueOrThrow({ where: { id: second.id } });
    expect(row).toMatchObject({ userId: account.id, anonymousId: null });
  });

  it('ignores tampered anonymous and session cookies', async () => {
    const client = new TestClient(built.app);
    await client.analyzeUrl(URLS.audi);
    const tampered = await built.app.inject({
      method: 'GET',
      url: '/api/me',
      headers: {
        cookie: 'kc_anon=AAAAAAAAAAAAAAAAAAAAAA.forged; kc_session=not-a-real-session-token-000000',
      },
    });
    const me = tampered.json<Me>();
    expect(me.user).toBeNull();
    expect(me.usage.used).toBe(0);
    // An unknown session cookie is cleared.
    expect(tampered.cookies.find((item) => item.name === 'kc_session')?.value).toBe('');
  });

  it('resets passwords via a single-use e-mail link and signs out everywhere', async () => {
    const client = new TestClient(built.app);
    const account = await client.register();

    const unknown = await new TestClient(built.app).post('/api/auth/password-reset/request', {
      email: uniqueEmail(),
    });
    expect(unknown.statusCode).toBe(202);
    expect(email.sent).toHaveLength(0);

    const request = await new TestClient(built.app).post('/api/auth/password-reset/request', {
      email: account.email,
    });
    expect(request.statusCode).toBe(202);
    expect(email.sent).toHaveLength(1);
    const token = /passwort-zuruecksetzen\?token=([^\s]+)/.exec(email.sent[0]?.text ?? '')?.[1];
    expect(token).toBeDefined();
    // The token itself is never stored.
    expect(JSON.stringify(await built.services.db.passwordResetToken.findMany())).not.toContain(
      decodeURIComponent(token ?? ''),
    );

    const newPassword = 'ein-neues-sicheres-passwort';
    const confirm = await new TestClient(built.app).post('/api/auth/password-reset/confirm', {
      token: decodeURIComponent(token ?? ''),
      password: newPassword,
    });
    expect(confirm.statusCode, confirm.body).toBe(204);
    expect((await client.get('/api/me')).json<Me>().user).toBeNull();

    const reuse = await new TestClient(built.app).post('/api/auth/password-reset/confirm', {
      token: decodeURIComponent(token ?? ''),
      password: 'noch-ein-anderes-passwort',
    });
    expect(reuse.statusCode).toBe(400);

    const oldLogin = await new TestClient(built.app).post('/api/auth/login', {
      email: account.email,
      password: PASSWORD,
    });
    expect(oldLogin.statusCode).toBe(401);
    const newLogin = await new TestClient(built.app).post('/api/auth/login', {
      email: account.email,
      password: newPassword,
    });
    expect(newLogin.statusCode).toBe(200);
  });

  it('deletes the account and all its data after confirming the password', async () => {
    const client = new TestClient(built.app);
    const account = await client.register();
    const analysis = await client.analyzeUrl(URLS.audi);
    expect((await client.post('/api/saved-listings', { analysisId: analysis.id })).statusCode).toBe(
      201,
    );

    const wrong = await client.delete('/api/account', { password: 'falsches-passwort' });
    expect(wrong.statusCode).toBe(401);

    const deleted = await client.delete('/api/account', { password: account.password });
    expect(deleted.statusCode).toBe(204);
    const db = built.services.db;
    expect(await db.user.count()).toBe(0);
    expect(await db.session.count()).toBe(0);
    expect(await db.savedListing.count()).toBe(0);
    expect(await db.analysis.count({ where: { id: analysis.id } })).toBe(0);
    expect((await client.get('/api/me')).json<Me>().user).toBeNull();
  });
});

describe('password reset without e-mail', () => {
  it('is reported as unavailable instead of pretending to send', async () => {
    const built = await createTestApp({ EMAIL_TRANSPORT: 'none' });
    try {
      const response = await new TestClient(built.app).post('/api/auth/password-reset/request', {
        email: uniqueEmail(),
      });
      expect(response.statusCode).toBe(503);
      const config = (await new TestClient(built.app).get('/api/config')).json<{
        features: { passwordReset: boolean };
      }>();
      expect(config.features.passwordReset).toBe(false);
    } finally {
      await built.app.close();
    }
  });
});
