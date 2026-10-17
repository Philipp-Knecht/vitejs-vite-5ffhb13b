import type {
  CarLogEntryDto,
  CarLogEntryInput,
  CarLogResponse,
  OwnedCarDto,
  OwnedCarInput,
} from '@kaufcheck/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { BuiltApp } from '../src/app';
import { createTestApp, errorOf, resetDatabase, TestClient } from './helpers';

const CAR: OwnedCarInput = {
  nickname: null,
  makeId: 'vw',
  modelId: 'vw-golf',
  modelName: 'Golf',
  generationId: null,
  fuel: 'petrol',
  firstRegistration: { year: 2017, month: 3 },
  mileageKm: 98_000,
  huUntil: null,
};

const FILL: CarLogEntryInput = {
  date: '2026-09-01',
  kind: 'fuel',
  odometerKm: 98_500,
  amountCents: 7_245,
  quantity: 41.4,
  fullTank: true,
  missedBefore: false,
  workshop: null,
  note: null,
  invoice: false,
};

const SERVICE: CarLogEntryInput = {
  date: '2026-05-12',
  kind: 'service',
  odometerKm: 95_000,
  amountCents: 34_900,
  quantity: 12,
  fullTank: true,
  missedBefore: false,
  workshop: 'Autohaus Muster, Köln',
  note: 'Inspektion mit Ölwechsel\nBremsflüssigkeit gewechselt',
  invoice: true,
};

describe('Kostenbuch (car log)', () => {
  let built: BuiltApp;
  // A fixed clock: 15 October 2026, 10:00 in Berlin.
  const now = new Date('2026-10-15T08:00:00Z');

  beforeAll(async () => {
    built = await createTestApp({}, { now: () => now });
  });
  beforeEach(() => resetDatabase(built.services.db));
  afterAll(() => built.app.close());

  async function owner(plan: 'FREE' | 'PRO' = 'PRO') {
    const client = new TestClient(built.app, () => now);
    const account = await client.register();
    if (plan === 'PRO')
      await built.services.db.user.update({ where: { id: account.id }, data: { plan } });
    const car = (await client.post('/api/owned-cars', CAR)).json<OwnedCarDto>();
    return { client, car, account };
  }

  it('adds, lists, updates and deletes entries', async () => {
    const { client, car } = await owner();
    const added = await client.post(`/api/owned-cars/${car.id}/log`, FILL);
    expect(added.statusCode).toBe(201);
    const fill = added.json<CarLogEntryDto>();
    expect(fill).toMatchObject(FILL);

    const service = (
      await client.post(`/api/owned-cars/${car.id}/log`, SERVICE)
    ).json<CarLogEntryDto>();
    // A quantity and a full tank belong to fuel only.
    expect(service).toMatchObject({ quantity: null, fullTank: false, note: SERVICE.note });
    // A workshop belongs to service entries only.
    const fuelWithWorkshop = (
      await client.post(`/api/owned-cars/${car.id}/log`, { ...FILL, workshop: 'Tankstelle' })
    ).json<CarLogEntryDto>();
    expect(fuelWithWorkshop.workshop).toBeNull();
    await client.delete(`/api/owned-cars/${car.id}/log/${fuelWithWorkshop.id}`);

    const list = (await client.get(`/api/owned-cars/${car.id}/log`)).json<CarLogResponse>();
    expect(list.editable).toBe(true);
    expect(list.items.map((item) => item.date)).toEqual(['2026-09-01', '2026-05-12']);

    // The log does not change the mileage in „Mein Auto“.
    const cars = (await client.get('/api/owned-cars')).json<{ items: OwnedCarDto[] }>();
    expect(cars.items[0]?.mileageKm).toBe(98_000);

    const updated = await client.put(`/api/owned-cars/${car.id}/log/${fill.id}`, {
      ...FILL,
      amountCents: 7_000,
    });
    expect(updated.json<CarLogEntryDto>().amountCents).toBe(7_000);

    expect((await client.delete(`/api/owned-cars/${car.id}/log/${fill.id}`)).statusCode).toBe(204);
    expect((await client.delete(`/api/owned-cars/${car.id}/log/${fill.id}`)).statusCode).toBe(404);
  });

  it('rejects dates in the future and invalid values', async () => {
    const { client, car } = await owner();
    const future = await client.post(`/api/owned-cars/${car.id}/log`, {
      ...FILL,
      date: '2026-10-16',
    });
    expect(future.statusCode).toBe(400);
    expect(errorOf(future).details?.fieldErrors).toHaveProperty('date');
    // Today in Berlin is allowed.
    expect(
      (await client.post(`/api/owned-cars/${car.id}/log`, { ...FILL, date: '2026-10-15' }))
        .statusCode,
    ).toBe(201);
    for (const body of [
      { ...FILL, date: '2026-02-30' },
      { ...FILL, quantity: 41.456 },
      { ...FILL, amountCents: -1 },
      { ...FILL, kind: 'lottery' },
      { ...FILL, workshop: 'a\nb' },
      { ...FILL, note: 'x'.repeat(501) },
    ])
      expect((await client.post(`/api/owned-cars/${car.id}/log`, body)).statusCode).toBe(400);
  });

  it('keeps other people out', async () => {
    const { client, car } = await owner();
    const entry = (await client.post(`/api/owned-cars/${car.id}/log`, FILL)).json<CarLogEntryDto>();
    const { client: stranger } = await owner();
    expect((await stranger.get(`/api/owned-cars/${car.id}/log`)).statusCode).toBe(404);
    expect((await stranger.post(`/api/owned-cars/${car.id}/log`, FILL)).statusCode).toBe(404);
    expect((await stranger.put(`/api/owned-cars/${car.id}/log/${entry.id}`, FILL)).statusCode).toBe(
      404,
    );
    expect((await stranger.delete(`/api/owned-cars/${car.id}/log/${entry.id}`)).statusCode).toBe(
      404,
    );
    expect(
      (await new TestClient(built.app, () => now).get(`/api/owned-cars/${car.id}/log`)).statusCode,
    ).toBe(401);
    expect((await client.get('/api/owned-cars/not-a-uuid/log')).statusCode).toBe(404);
  });

  it('is part of Pro, but what was entered stays readable and deletable', async () => {
    const { client, car, account } = await owner();
    const entry = (await client.post(`/api/owned-cars/${car.id}/log`, FILL)).json<CarLogEntryDto>();
    await built.services.db.user.update({ where: { id: account.id }, data: { plan: 'FREE' } });

    const added = await client.post(`/api/owned-cars/${car.id}/log`, FILL);
    expect(added.statusCode).toBe(403);
    expect(errorOf(added).code).toBe('PLAN_LIMIT_REACHED');
    expect((await client.put(`/api/owned-cars/${car.id}/log/${entry.id}`, FILL)).statusCode).toBe(
      403,
    );
    const list = (await client.get(`/api/owned-cars/${car.id}/log`)).json<CarLogResponse>();
    expect(list).toMatchObject({ editable: false, items: [{ id: entry.id }] });
    expect((await client.delete(`/api/owned-cars/${car.id}/log/${entry.id}`)).statusCode).toBe(204);
  });

  it('deletes the entries with the car', async () => {
    const { client, car } = await owner();
    await client.post(`/api/owned-cars/${car.id}/log`, FILL);
    expect((await client.delete(`/api/owned-cars/${car.id}`)).statusCode).toBe(204);
    expect(await built.services.db.carLogEntry.count()).toBe(0);
  });
});
