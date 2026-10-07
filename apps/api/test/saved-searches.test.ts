import type { SavedSearchDto, SavedSearchesResponse } from '@kaufcheck/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { BuiltApp } from '../src/app';
import { createTestApp, errorOf, resetDatabase, TestClient } from './helpers';

describe('saved car searches', () => {
  let built: BuiltApp;

  beforeAll(async () => {
    built = await createTestApp();
  });
  beforeEach(() => resetDatabase(built.services.db));
  afterAll(() => built.app.close());

  const GOLF = 'marke=vw&modell=vw-golf&preis_bis=15000&plz=79098&umkreis=50';

  async function proClient(): Promise<TestClient> {
    const client = new TestClient(built.app);
    const account = await client.register();
    await built.services.db.user.update({ where: { id: account.id }, data: { plan: 'PRO' } });
    return client;
  }

  it('needs an account and Pro', async () => {
    const anonymous = new TestClient(built.app);
    const unauthenticated = await anonymous.post('/api/saved-searches', {
      name: 'Golf',
      query: GOLF,
    });
    expect(unauthenticated.statusCode).toBe(401);

    const free = new TestClient(built.app);
    await free.register();
    const blocked = await free.post('/api/saved-searches', { name: 'Golf', query: GOLF });
    expect(blocked.statusCode).toBe(403);
    expect(errorOf(blocked).code).toBe('PLAN_LIMIT_REACHED');
    const list = await free.get('/api/saved-searches');
    expect(list.json<SavedSearchesResponse>()).toEqual({ items: [], limit: 0 });
  });

  it('saves only KaufCheck’s own search parameters, lists and deletes', async () => {
    const client = await proClient();
    const response = await client.post('/api/saved-searches', {
      name: 'Golf für die Familie',
      query: `umkreis=50&plz=79098&preis_bis=15000&modell=vw-golf&marke=vw&utm_source=mail&x=<script>`,
    });
    expect(response.statusCode, response.body).toBe(201);
    const saved = response.json<SavedSearchDto>();
    expect(saved).toMatchObject({ name: 'Golf für die Familie', query: GOLF });

    const list = await client.get('/api/saved-searches');
    expect(list.json<SavedSearchesResponse>()).toMatchObject({ items: [saved], limit: 50 });

    // Another account sees and deletes nothing of it.
    const other = await proClient();
    expect((await other.get('/api/saved-searches')).json<SavedSearchesResponse>().items).toEqual(
      [],
    );
    expect((await other.delete(`/api/saved-searches/${saved.id}`)).statusCode).toBe(404);

    expect((await client.delete(`/api/saved-searches/${saved.id}`)).statusCode).toBe(204);
    expect((await client.get('/api/saved-searches')).json<SavedSearchesResponse>().items).toEqual(
      [],
    );
    expect((await client.delete('/api/saved-searches/kein-uuid')).statusCode).toBe(404);
  });

  it('rejects empty searches and keeps to the limit', async () => {
    const client = await proClient();
    const empty = await client.post('/api/saved-searches', { name: 'Leer', query: 'foo=bar' });
    expect(empty.statusCode).toBe(400);
    expect(errorOf(empty).code).toBe('VALIDATION_ERROR');

    const limit = built.services.plans.pro.savedSearchesMax;
    const user = await built.services.db.user.findFirstOrThrow({ where: { plan: 'PRO' } });
    await built.services.db.savedSearch.createMany({
      data: Array.from({ length: limit }, (_, index) => ({
        userId: user.id,
        name: `Suche ${index}`,
        query: GOLF,
      })),
    });
    const full = await client.post('/api/saved-searches', { name: 'Zu viel', query: GOLF });
    expect(full.statusCode).toBe(403);
    expect(errorOf(full)).toMatchObject({ code: 'PLAN_LIMIT_REACHED', details: { limit } });
  });
});
