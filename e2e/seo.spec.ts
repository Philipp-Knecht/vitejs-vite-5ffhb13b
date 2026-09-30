import { expect, test } from '@playwright/test';

test('the homepage is prerendered with the required title and description', async ({ request }) => {
  const response = await request.get('/');
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(html).toContain('<title>KaufCheck – Gebrauchtwagen-Angebote prüfen</title>');
  expect(html).toContain(
    '<meta name="description" content="Kleinanzeigen-Angebot einfügen und wichtige Informationen, fehlende Angaben und Fragen für den Verkäufer strukturiert prüfen." />',
  );
  expect(html).toContain('<link rel="canonical"');
  expect(html).toContain('data-prerendered="true"');
  expect(html).toContain('Gebraucht kaufen.');
});

test('guides are readable without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  for (const [path, heading] of [
    ['/gebrauchtwagen-kaufen', 'Gebrauchtwagen privat kaufen'],
    ['/gebrauchtwagen-checkliste', 'Gebrauchtwagen-Checkliste'],
    ['/auto-besichtigung-checkliste', 'Auto-Besichtigung'],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(heading);
    await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible();
  }
  await context.close();
});

test('sitemap, robots.txt, noindex and real 404 status codes', async ({ request }) => {
  const sitemap = await (await request.get('/sitemap.xml')).text();
  for (const path of [
    '/gebrauchtwagen-kaufen',
    '/gebrauchtwagen-checkliste',
    '/auto-besichtigung-checkliste',
    '/pro',
  ]) {
    expect(sitemap).toContain(`${path}</loc>`);
  }
  expect(sitemap).not.toContain('/impressum');

  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain('Disallow: /api/');
  expect(robots).toContain('Sitemap:');

  const result = await request.get('/analyse/00000000-0000-4000-8000-000000000000');
  expect(result.status()).toBe(200);
  expect(await result.text()).toContain('<meta name="robots" content="noindex" />');

  expect((await request.get('/gibt-es-nicht')).status()).toBe(404);
  expect((await request.get('/api/gibt-es-nicht')).status()).toBe(404);
});
