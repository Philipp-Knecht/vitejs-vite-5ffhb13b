import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { makePro, PASTED_LISTING, uniqueEmail } from './helpers';

test('the insurance comparison link is labelled, plain and gone with Pro', async ({
  page,
  request,
}) => {
  // Not part of the prerendered page: the plan is unknown there.
  const html = await (await request.get('/autokosten-im-monat')).text();
  expect(html).not.toContain('partner.example');

  await page.goto('/autokosten-im-monat');
  const ad = page.getByRole('complementary', { name: 'Werbung: Affiliate-Link' });
  await expect(ad).toHaveCount(1);
  const link = ad.getByRole('link', {
    name: /^Kfz-Versicherungen bei Beispielportal vergleichen\*/,
  });
  await expect(link).toHaveAttribute('href', 'https://partner.example/kfz-vergleich?pid=e2e');
  await expect(link).toHaveAttribute('rel', 'sponsored noopener');
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAccessibleDescription(/^\*Affiliate-Link: Kommt über diesen Link/);
  const results = await new AxeBuilder({ page })
    .include('.affiliate')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations.map((violation) => violation.id)).toEqual([]);

  for (const path of ['/auto-ummelden', '/gebrauchtwagen-kaufen']) {
    await page.goto(path);
    await expect(page.getByRole('complementary', { name: 'Werbung: Affiliate-Link' })).toHaveCount(
      1,
    );
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
  await expect(page.getByRole('complementary', { name: 'Werbung: Affiliate-Link' })).toHaveCount(1);
  await makePro(email);
  await page.reload();
  // Plan and configuration are loaded once the account link shows and /api/config was fetched.
  await expect(page.getByRole('link', { name: 'Konto' }).first()).toBeVisible();
  await page.waitForFunction(() =>
    performance.getEntriesByType('resource').some((entry) => entry.name.includes('/api/config')),
  );
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
  await expect(page.getByRole('complementary', { name: 'Werbung: Affiliate-Link' })).toHaveCount(0);
});

test('a configuration cached before affiliate links and own ads existed still renders', async ({
  page,
}) => {
  // The browser or the offline copy may still hold /api/config from before the field.
  await page.route('**/api/config', async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as Record<string, unknown>;
    delete body.affiliates;
    delete body.sponsors;
    await route.fulfill({ response, json: body });
  });
  await page.goto('/datenschutz');
  await expect(page.getByRole('heading', { name: 'Grundsatz' })).toBeVisible();
  await page.goto('/autokosten-im-monat');
  await expect(page.getByRole('heading', { name: 'So sparst du' })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Werbung: Affiliate-Link' })).toHaveCount(0);
});

test('the vehicle history link is labelled, plain, apart from the recall check, and gone with Pro', async ({
  page,
  request,
}) => {
  // Not part of the prerendered page: the plan is unknown there.
  expect(await (await request.get('/gebrauchtwagen-checkliste')).text()).not.toContain(
    'history.example',
  );
  await page.goto('/gebrauchtwagen-checkliste');
  const ad = page.getByRole('complementary', { name: 'Werbung: Affiliate-Link' });
  await expect(ad).toHaveCount(1);
  const link = ad.getByRole('link', {
    name: /^Kostenpflichtigen Bericht zur Fahrzeughistorie bei Beispielhistorie abrufen\*/,
  });
  await expect(link).toHaveAttribute('href', 'https://history.example/check?aff=e2e');
  await expect(link).toHaveAttribute('rel', 'sponsored noopener');
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAccessibleDescription(
    /Ein solcher Bericht enthält nur, was in den Datenquellen des Anbieters erfasst ist/,
  );
  const results = await new AxeBuilder({ page })
    .include('.affiliate')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations.map((violation) => violation.id)).toEqual([]);

  await page.goto('/inserat-pruefen');
  await page.getByLabel('Inseratstext oder Link zum Auto-Inserat').fill(PASTED_LISTING);
  await page.getByRole('button', { name: 'Inserat prüfen' }).click();
  await expect(page).toHaveURL(/\/analyse\//);
  const check = page.url();
  await expect(page.getByRole('complementary', { name: 'Werbung: Affiliate-Link' })).toHaveCount(1);
  // Not inside the recall check with its official steps and warnings.
  await expect(
    page.getByRole('region', { name: 'Rückrufe prüfen' }).locator('.affiliate'),
  ).toHaveCount(0);

  await page.goto('/datenschutz');
  await expect(
    page.getByText(/kostenpflichtigen Berichten über die Fahrzeughistorie bei Beispielhistorie/),
  ).toBeVisible();

  const email = uniqueEmail();
  await page.goto('/registrieren');
  await page.getByLabel('E-Mail-Adresse').fill(email);
  await page.getByLabel('Passwort').fill('ein-sicheres-passwort');
  await page.getByRole('button', { name: 'Konto erstellen' }).click();
  await expect(page).not.toHaveURL(/\/registrieren$/);
  await makePro(email);
  for (const path of ['/gebrauchtwagen-checkliste', new URL(check).pathname]) {
    await page.goto(path);
    await expect(page.getByRole('link', { name: 'Konto' }).first()).toBeVisible();
    await page.waitForFunction(() =>
      performance.getEntriesByType('resource').some((entry) => entry.name.includes('/api/config')),
    );
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    await expect(page.getByRole('complementary', { name: 'Werbung: Affiliate-Link' })).toHaveCount(
      0,
    );
  }
});

test('a configuration cached before the vehicle history link still shows the insurance link', async ({
  page,
}) => {
  await page.route('**/api/config', async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as { affiliates: Record<string, unknown> };
    delete body.affiliates.vehicleHistory;
    await route.fulfill({ response, json: body });
  });
  await page.goto('/gebrauchtwagen-checkliste');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.waitForFunction(() =>
    performance.getEntriesByType('resource').some((entry) => entry.name.includes('/api/config')),
  );
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
  await expect(page.getByRole('complementary', { name: 'Werbung: Affiliate-Link' })).toHaveCount(0);
  await page.goto('/autokosten-im-monat');
  await expect(page.getByRole('complementary', { name: 'Werbung: Affiliate-Link' })).toHaveCount(1);
  await page.goto('/datenschutz');
  await expect(page.getByText(/Vergleich von Kfz-Versicherungen bei Beispielportal/)).toBeVisible();
  await expect(page.getByText(/Fahrzeughistorie bei/)).toHaveCount(0);
});
