import type { OwnedCarDto, OwnedCarInput, OwnedCarsResponse } from '@kaufcheck/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { BuiltApp } from '../src/app';
import { createTestApp, errorOf, resetDatabase, TestClient } from './helpers';

const GOLF: OwnedCarInput = {
  nickname: 'Familienauto',
  makeId: 'vw',
  modelId: 'vw-golf',
  modelName: 'Golf',
  generationId: 'vw-golf-7',
  fuel: 'diesel',
  firstRegistration: { year: 2017, month: 3 },
  mileageKm: 98_000,
  huUntil: { year: 2027, month: 3 },
};

describe('Mein Auto (owned cars)', () => {
  let built: BuiltApp;

  beforeAll(async () => {
    built = await createTestApp();
  });
  beforeEach(() => resetDatabase(built.services.db));
  afterAll(() => built.app.close());

  async function client(plan: 'FREE' | 'PRO' = 'FREE'): Promise<TestClient> {
    const result = new TestClient(built.app);
    const account = await result.register();
    if (plan === 'PRO')
      await built.services.db.user.update({ where: { id: account.id }, data: { plan } });
    return result;
  }

  it('needs an account', async () => {
    const anonymous = new TestClient(built.app);
    expect((await anonymous.post('/api/owned-cars', GOLF)).statusCode).toBe(401);
    expect((await anonymous.get('/api/owned-cars')).statusCode).toBe(401);
  });

  it('adds, lists, updates and deletes a car', async () => {
    const free = await client();
    const created = await free.post('/api/owned-cars', GOLF);
    expect(created.statusCode).toBe(201);
    const car = created.json<OwnedCarDto>();
    expect(car).toMatchObject(GOLF);

    expect((await free.get('/api/owned-cars')).json<OwnedCarsResponse>()).toMatchObject({
      items: [GOLF],
      limit: 1,
    });

    const updated = await free.patch(`/api/owned-cars/${car.id}`, {
      ...GOLF,
      nickname: null,
      mileageKm: 101_500,
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json<OwnedCarDto>()).toMatchObject({ nickname: null, mileageKm: 101_500 });

    expect((await free.delete(`/api/owned-cars/${car.id}`)).statusCode).toBe(204);
    expect((await free.get('/api/owned-cars')).json<OwnedCarsResponse>().items).toEqual([]);
  });

  it('allows one car for free accounts and more with Pro', async () => {
    const free = await client();
    expect((await free.post('/api/owned-cars', GOLF)).statusCode).toBe(201);
    const blocked = await free.post('/api/owned-cars', GOLF);
    expect(blocked.statusCode).toBe(403);
    expect(errorOf(blocked).code).toBe('PLAN_LIMIT_REACHED');

    const pro = await client('PRO');
    expect((await pro.post('/api/owned-cars', GOLF)).statusCode).toBe(201);
    expect((await pro.post('/api/owned-cars', GOLF)).statusCode).toBe(201);
    expect((await pro.get('/api/owned-cars')).json<OwnedCarsResponse>().limit).toBe(
      built.services.plans.pro.ownedCarsMax,
    );
  });

  it('checks catalog ids and dates', async () => {
    const free = await client();
    const cases: [Partial<OwnedCarInput>, string][] = [
      [{ makeId: 'tesla-x' }, 'makeId'],
      [{ modelId: 'audi-a3' }, 'modelId'],
      [{ generationId: 'audi-a3-8v' }, 'generationId'],
      [{ modelId: null, generationId: 'vw-golf-7' }, 'generationId'],
      [{ firstRegistration: { year: 2099, month: 1 } }, 'firstRegistration'],
      [{ huUntil: { year: 2016, month: 1 } }, 'huUntil'],
      [{ huUntil: { year: 2099, month: 1 } }, 'huUntil'],
      [{ mileageKm: -1 }, 'mileageKm'],
      [{ modelName: '' }, 'modelName'],
    ];
    for (const [change, field] of cases) {
      const response = await free.post('/api/owned-cars', { ...GOLF, ...change });
      expect(response.statusCode, field).toBe(400);
      expect(Object.keys(errorOf(response).details?.fieldErrors ?? {}).join(), field).toContain(
        field,
      );
    }
    // A model outside the catalog is fine; it just has no knowledge.
    const other = await free.post('/api/owned-cars', {
      ...GOLF,
      modelId: null,
      modelName: 'Golf Country',
      generationId: null,
    });
    expect(other.statusCode).toBe(201);
  });

  it('keeps cars private to their owner', async () => {
    const owner = await client();
    const car = (await owner.post('/api/owned-cars', GOLF)).json<OwnedCarDto>();
    const other = await client();
    expect((await other.patch(`/api/owned-cars/${car.id}`, GOLF)).statusCode).toBe(404);
    expect((await other.delete(`/api/owned-cars/${car.id}`)).statusCode).toBe(404);
    expect((await other.delete('/api/owned-cars/not-a-uuid')).statusCode).toBe(404);
    expect((await other.get('/api/owned-cars')).json<OwnedCarsResponse>().items).toEqual([]);
  });
});
