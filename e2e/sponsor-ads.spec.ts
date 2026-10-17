import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import pg from 'pg';
import { makePro, uniqueEmail } from './helpers';

async function counts(): Promise<{ views: number; clicks: number }> {
  const client = new pg.Client({
    connectionString:
      process.env.E2E_DATABASE_URL ??
      'postgresql://kaufcheck:kaufcheck@localhost:5432/kaufcheck_e2e',
  });
  await client.connect();
  try {
    const result = await client.query<{ views: string | null; clicks: string | null }>(
      `SELECT sum("views") AS views, sum("clicks") AS clicks FROM "SponsorAdStat"
       WHERE "campaign" = 'e2e-autohaus'`,
    );
    const row = result.rows[0]!;
    return { views: Number(row.views ?? 0), clicks: Number(row.clicks ?? 0) };
  } finally {
    await client.end();
  }
}

test('an ad sold directly comes from our own server, is counted there and gone with Pro', async ({
  page,
  request,
}) => {
  const html = await (await request.get('/auto-ummelden')).text();
  expect(html).not.toContain('autohaus.example');
  expect(await (await request.get('/robots.txt')).text()).toContain('Disallow: /go/');

  const before = await counts();
  const external: string[] = [];
  page.on('request', (sent) => {
    if (!sent.url().startsWith('http://127.0.0.1')) external.push(sent.url());
  });
  await page.goto('/auto-ummelden');
  const ad = page.getByRole('complementary', { name: 'Werbung von Autohaus Beispiel' });
  await ad.scrollIntoViewIfNeeded();
  await expect(ad.getByRole('img', { name: 'Logo von Autohaus Beispiel' })).toBeVisible();
  const link = ad.getByRole('link', { name: /Gebrauchtwagen in Musterstadt/ });
  await expect(link).toHaveAttribute('href', '/go/e2e-autohaus');
  await expect(link).toHaveAttribute('rel', 'sponsored noopener');
  await expect(link).toHaveAccessibleDescription(
    /^Werbung von Autohaus Beispiel Die Anzeige ist keine Empfehlung von KaufCheck/,
  );
  // Counted once by the server when it delivered the ad; nothing loaded from the advertiser.
  await expect.poll(async () => (await counts()).views).toBe(before.views + 1);
  expect(external).toEqual([]);
  const results = await new AxeBuilder({ page })
    .include('.sponsor-ad')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations.map((violation) => violation.id)).toEqual([]);

  // The click goes through our redirect.
  const click = await request.get('/go/e2e-autohaus', { maxRedirects: 0 });
  expect(click.status()).toBe(302);
  expect(click.headers().location).toBe('https://autohaus.example/?ref=kaufcheck');
  expect((await counts()).clicks).toBe(before.clicks + 1);

  await page.goto('/datenschutz');
  await expect(page.getByRole('heading', { name: 'Anzeigen von Werbepartnern' })).toBeVisible();

  const email = uniqueEmail();
  await page.goto('/registrieren');
  await page.getByLabel('E-Mail-Adresse').fill(email);
  await page.getByLabel('Passwort').fill('ein-sicheres-passwort');
  await page.getByRole('button', { name: 'Konto erstellen' }).click();
  await expect(page).not.toHaveURL(/\/registrieren$/);
  await makePro(email);
  await page.goto('/auto-ummelden');
  await expect(page.getByRole('link', { name: 'Konto' }).first()).toBeVisible();
  await page.waitForFunction(() =>
    performance.getEntriesByType('resource').some((entry) => entry.name.includes('/api/config')),
  );
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
  await expect(page.getByRole('complementary', { name: /^Werbung/ })).toHaveCount(0);
});
