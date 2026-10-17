import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import pg from 'pg';
import { makePro, uniqueEmail } from './helpers';

async function views(): Promise<number> {
  const client = new pg.Client({
    connectionString:
      process.env.E2E_DATABASE_URL ??
      'postgresql://kaufcheck:kaufcheck@localhost:5432/kaufcheck_e2e',
  });
  await client.connect();
  try {
    const result = await client.query<{ count: string }>(
      `SELECT count(*) FROM "AnalyticsEvent" WHERE "name" = 'sponsor_ad_viewed'
       AND "props"->>'campaign' = 'e2e-autohaus'`,
    );
    return Number(result.rows[0]!.count);
  } finally {
    await client.end();
  }
}

test('an ad sold directly comes from our own server, named and gone with Pro', async ({
  page,
  request,
}) => {
  const html = await (await request.get('/auto-ummelden')).text();
  expect(html).not.toContain('autohaus.example');

  const before = await views();
  const external: string[] = [];
  page.on('request', (sent) => {
    if (!sent.url().startsWith('http://127.0.0.1')) external.push(sent.url());
  });
  await page.goto('/auto-ummelden');
  const ad = page.getByRole('complementary', { name: 'Werbung von Autohaus Beispiel' });
  await ad.scrollIntoViewIfNeeded();
  await expect(ad.getByRole('img', { name: 'Logo von Autohaus Beispiel' })).toBeVisible();
  const link = ad.getByRole('link', { name: /Gebrauchtwagen mit Garantie/ });
  await expect(link).toHaveAttribute('href', 'https://autohaus.example/?ref=kaufcheck');
  await expect(link).toHaveAttribute('rel', 'sponsored noopener');
  await expect(ad.getByText('Über 100 geprüfte Fahrzeuge in Musterstadt.')).toBeVisible();
  // Counted once it was on screen, without anything loaded from the advertiser.
  await expect.poll(views).toBe(before + 1);
  expect(external).toEqual([]);
  const results = await new AxeBuilder({ page })
    .include('.ad-slot--sponsor')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations.map((violation) => violation.id)).toEqual([]);

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
