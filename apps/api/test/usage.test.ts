import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { BuiltApp } from '../src/app';
import { createTestApp, errorOf, resetDatabase, TestClient, URLS } from './helpers';

interface Me {
  plan: string;
  usage: { used: number; limit: number; period: string; resetsAt: string };
}

describe('usage limits', () => {
  let built: BuiltApp;
  let now = new Date('2026-09-15T12:00:00Z');

  beforeAll(async () => {
    built = await createTestApp({}, { now: () => now });
  });
  beforeEach(async () => {
    await resetDatabase(built.services.db);
    now = new Date('2026-09-15T12:00:00Z');
  });
  afterAll(() => built.app.close());

  it('limits anonymous visitors to three analyses per month', async () => {
    const client = new TestClient(built.app);
    for (let index = 0; index < 3; index += 1) await client.analyzeUrl(URLS.audi);
    const blocked = await client.post('/api/listings/analyze', { url: URLS.audi });
    expect(blocked.statusCode).toBe(429);
    const error = errorOf(blocked);
    expect(error.code).toBe('USAGE_LIMIT_REACHED');
    expect(error.message).toContain('kostenlosen Konto');
    expect(error.details).toMatchObject({
      limit: 3,
      used: 3,
      resetsAt: '2026-10-01T00:00:00.000Z',
    });

    // The fictional example stays available.
    expect((await client.post('/api/listings/analyze-example', {})).statusCode).toBe(201);

    // A new month resets the quota.
    now = new Date('2026-10-01T00:00:01Z');
    expect((await client.post('/api/listings/analyze', { url: URLS.audi })).statusCode).toBe(201);
    expect((await client.get('/api/me')).json<Me>().usage).toMatchObject({
      period: '2026-10',
      used: 1,
      limit: 3,
    });
  });

  it('never exceeds the limit under concurrent requests', async () => {
    const client = new TestClient(built.app);
    // Establish the anonymous id first so all parallel requests share it.
    await client.post('/api/listings/analyze-example', {});
    const responses = await Promise.all(
      Array.from({ length: 8 }, () => client.post('/api/listings/analyze', { url: URLS.bmw })),
    );
    const statuses = responses.map((response) => response.statusCode).sort();
    expect(statuses.filter((status) => status === 201)).toHaveLength(3);
    expect(statuses.filter((status) => status === 429)).toHaveLength(5);
    const usage = await built.services.db.usage.findMany();
    expect(usage).toHaveLength(1);
    expect(usage[0]?.analysesCount).toBe(3);
  });

  it('does not count failed analyses', async () => {
    const client = new TestClient(built.app);
    for (let index = 0; index < 5; index += 1) {
      const response = await client.post('/api/listings/analyze', { url: URLS.blocked });
      expect(errorOf(response).code).toBe('FETCH_BLOCKED');
    }
    await client.analyzeUrl(URLS.audi);
    expect((await client.get('/api/me')).json<Me>().usage.used).toBe(1);
  });

  it('gives accounts a higher limit and Pro the highest', async () => {
    const client = new TestClient(built.app);
    const account = await client.register();
    expect((await client.get('/api/me')).json<Me>().usage.limit).toBe(10);
    for (let index = 0; index < 10; index += 1) await client.analyzeUrl(URLS.mercedes);
    const blocked = await client.post('/api/listings/analyze', { url: URLS.mercedes });
    expect(errorOf(blocked).code).toBe('USAGE_LIMIT_REACHED');
    expect(errorOf(blocked).message).toContain('Pro');

    await built.services.db.user.update({ where: { id: account.id }, data: { plan: 'PRO' } });
    const me = (await client.get('/api/me')).json<Me>();
    expect(me.plan).toBe('pro');
    expect(me.usage).toMatchObject({ used: 10, limit: 300 });
    expect((await client.post('/api/listings/analyze', { url: URLS.mercedes })).statusCode).toBe(
      201,
    );
  });

  it('counts per account, not per browser', async () => {
    const first = new TestClient(built.app);
    const account = await first.register();
    await first.analyzeUrl(URLS.audi);
    const second = new TestClient(built.app);
    await second.post('/api/auth/login', { email: account.email, password: account.password });
    await second.analyzeUrl(URLS.audi);
    expect((await first.get('/api/me')).json<Me>().usage.used).toBe(2);
  });
});
