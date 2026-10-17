import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { makePro, uniqueEmail } from './helpers';

test('the insurance comparison link is labelled, plain and gone with Pro', async ({
  page,
  request,
}) => {
  // Not part of the prerendered page: the plan is unknown there.
  const html = await (await request.get('/autokosten-im-monat')).text();
  expect(html).not.toContain('partner.example');

  await page.goto('/autokosten-im-monat');
  const ad = page.getByRole('complementary', { name: 'Anzeige' });
  await expect(ad).toHaveCount(1);
  const link = ad.getByRole('link', {
    name: /Kfz-Versicherungen vergleichen bei Beispielportal \(Beispiel GmbH\)\*/,
  });
  await expect(link).toHaveAttribute('href', 'https://partner.example/kfz-vergleich?pid=e2e');
  await expect(link).toHaveAttribute('rel', 'sponsored noopener');
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(ad.getByText(/^\*Affiliate-Link: Kommt über diesen Link ein Vertrag/)).toBeVisible();
  const results = await new AxeBuilder({ page })
    .include('.affiliate')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations.map((violation) => violation.id)).toEqual([]);

  for (const path of ['/auto-ummelden', '/gebrauchtwagen-kaufen']) {
    await page.goto(path);
    await expect(page.getByRole('complementary', { name: 'Anzeige' })).toHaveCount(1);
  }

  await page.goto('/datenschutz');
  await expect(page.getByRole('heading', { name: 'Affiliate-Links' })).toBeVisible();

  const email = uniqueEmail();
  await page.goto('/registrieren');
  await page.getByLabel('E-Mail-Adresse').fill(email);
  await page.getByLabel('Passwort').fill('ein-sicheres-passwort');
  await page.getByRole('button', { name: 'Konto erstellen' }).click();
  await expect(page).not.toHaveURL(/\/registrieren$/);
  await page.goto('/autokosten-im-monat');
  await expect(page.getByRole('complementary', { name: 'Anzeige' })).toHaveCount(1);
  await makePro(email);
  await Promise.all([
    page.waitForResponse((response) => new URL(response.url()).pathname === '/api/me'),
    page.reload(),
  ]);
  await expect(page.getByRole('heading', { name: 'So sparst du' })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Anzeige' })).toHaveCount(0);
});
