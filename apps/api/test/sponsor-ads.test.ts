import { PublicConfigSchema, SponsorAdResponseSchema } from '@kaufcheck/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, resetDatabase, TestClient } from './helpers';

type BuiltApp = Awaited<ReturnType<typeof createTestApp>>;

const AD = {
  advertiser: 'Autohaus Muster GmbH',
  title: 'Gebrauchtwagen in Musterstadt',
  url: 'https://autohaus-muster.example/?ref=kaufcheck',
  placements: ['guide_bottom'],
};

describe('ads sold directly', () => {
  let built: BuiltApp;
  let now = new Date('2026-10-31T22:30:00Z');

  beforeAll(async () => {
    built = await createTestApp(
      {
        SPONSOR_ADS: JSON.stringify([
          { ...AD, id: 'oktober', until: '2026-10-31' },
          {
            ...AD,
            id: 'november',
            from: '2026-11-01',
            image: '/sponsors/muster.webp',
            imageAlt: 'Logo von Autohaus Muster',
          },
        ]),
      },
      { now: () => now },
    );
  });
  beforeEach(async () => {
    await resetDatabase(built.services.db);
    now = new Date('2026-10-31T22:30:00Z');
  });
  afterAll(() => built.app.close());

  const stats = () =>
    built.services.db.sponsorAdStat.findMany({ orderBy: [{ campaign: 'asc' }, { day: 'asc' }] });

  it('picks a running ad by German day and counts it on the server', async () => {
    const client = new TestClient(built.app, () => now);
    const config = PublicConfigSchema.parse((await client.get('/api/config')).json());
    expect(config.sponsors).toEqual({ configured: true, placements: ['guide_bottom'] });
    expect(
      (await client.get('/api/config')).json<{ sponsors: unknown }>().sponsors,
    ).not.toHaveProperty('ads');

    // 23:30 in Germany: still 31 October.
    const first = await client.get('/api/sponsor-ads/guide_bottom');
    expect(first.headers['cache-control']).toBe('no-store');
    expect(SponsorAdResponseSchema.parse(first.json()).ad?.id).toBe('oktober');
    now = new Date('2026-10-31T23:30:00Z');
    const second = SponsorAdResponseSchema.parse(
      (await client.get('/api/sponsor-ads/guide_bottom')).json(),
    );
    expect(second.ad).toEqual({
      id: 'november',
      advertiser: 'Autohaus Muster GmbH',
      title: 'Gebrauchtwagen in Musterstadt',
      text: '',
      image: { src: '/sponsors/muster.webp', alt: 'Logo von Autohaus Muster' },
      href: '/go/november',
    });
    expect(
      SponsorAdResponseSchema.parse((await client.get('/api/sponsor-ads/result_bottom')).json()).ad,
    ).toBeNull();
    expect((await client.get('/api/sponsor-ads/header')).statusCode).toBe(404);

    // HEAD (link checkers) and a campaign outside its period are not counted.
    expect((await built.app.inject({ method: 'HEAD', url: '/go/november' })).statusCode).toBe(302);
    expect((await client.get('/go/oktober')).headers.location).toBe(
      'https://autohaus-muster.example/?ref=kaufcheck',
    );
    const click = await client.get('/go/november');
    expect(click.statusCode).toBe(302);
    expect(click.headers.location).toBe('https://autohaus-muster.example/?ref=kaufcheck');
    expect(click.headers['cache-control']).toBe('no-store');
    for (const path of ['/go/unbekannt', '/go/..%2Fapi']) {
      const unknown = await client.get(path);
      expect(unknown.statusCode).toBe(302);
      expect(unknown.headers.location).toBe('/');
    }

    expect(await stats()).toEqual([
      { campaign: 'november', day: '2026-11-01', deliveries: 1, clicks: 1 },
      { campaign: 'oktober', day: '2026-10-31', deliveries: 1, clicks: 0 },
    ]);
  });

  it('counts nothing with Do Not Track or Global Privacy Control and shows no ad with Pro', async () => {
    const client = new TestClient(built.app, () => now);
    for (const headers of [{ dnt: '1' }, { 'sec-gpc': '1' }] as Record<string, string>[]) {
      const response = await client.request('GET', '/api/sponsor-ads/guide_bottom', { headers });
      expect(SponsorAdResponseSchema.parse(response.json()).ad?.id).toBe('oktober');
      expect(
        (await client.request('GET', '/go/oktober', { headers })).headers.location,
      ).toBeDefined();
    }
    expect(await stats()).toEqual([]);

    const account = await client.register();
    await built.services.db.user.update({ where: { id: account.id }, data: { plan: 'PRO' } });
    expect(
      SponsorAdResponseSchema.parse((await client.get('/api/sponsor-ads/guide_bottom')).json()).ad,
    ).toBeNull();
    expect(await stats()).toEqual([]);
  });
});
