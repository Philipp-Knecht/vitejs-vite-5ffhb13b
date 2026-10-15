import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { analyzeFromHomepage, LISTINGS, makePro, uniqueEmail } from './helpers';

async function choosePrivate(page: Page) {
  await page
    .getByRole('group', { name: 'Wer verkauft?' })
    .getByRole('radio', { name: 'Eine Privatperson' })
    .check();
  await page
    .getByRole('group', { name: 'Wer kauft?' })
    .getByRole('radio', { name: 'Eine Privatperson' })
    .check();
}

test('the contract page is prerendered and only for private sales', async ({ page, request }) => {
  const html = await (await request.get('/kaufvertrag')).text();
  expect(html).toContain('Kaufvertrag für den privaten Autokauf');
  expect(html).toContain('Ein Muster, keine Rechtsberatung');

  await page.goto('/kaufvertrag');
  await page
    .getByRole('group', { name: 'Wer verkauft?' })
    .getByRole('radio', { name: /Händler/ })
    .check();
  await page
    .getByRole('group', { name: 'Wer kauft?' })
    .getByRole('radio', { name: 'Eine Privatperson' })
    .check();
  await expect(page.getByText('Dieser Vertrag passt nur, wenn beide privat handeln')).toBeVisible();
  await expect(page.getByRole('button', { name: /Vertrag als PDF erstellen/ })).toHaveCount(0);

  await choosePrivate(page);
  await expect(page.getByRole('button', { name: /Vertrag als PDF erstellen/ })).toBeVisible();
  // Nothing about the condition is preselected: the question stays open for the paper.
  const checked = page
    .getByRole('group', { name: /während der Besitzzeit des Verkäufers/ })
    .getByRole('radio', { checked: true });
  await expect(checked).toHaveCount(1);
  await expect(checked).toHaveAccessibleName(/Offen lassen/);
});

test('the filled form meets WCAG 2.1 AA checks', async ({ page }) => {
  await page.goto('/kaufvertrag');
  await choosePrivate(page);
  await page
    .getByRole('group', { name: /während der Besitzzeit des Verkäufers/ })
    .getByRole('radio', { name: 'Ja' })
    .check();
  await page.getByLabel('Kraftstoff oder Energiequelle').selectOption('electric');
  await expect(page.getByRole('group', { name: 'Antriebsbatterie' })).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations.map((violation) => violation.id)).toEqual([]);
});

test('invalid entries are marked and focused', async ({ page }) => {
  await page.goto('/kaufvertrag');
  await choosePrivate(page);
  await page.getByLabel('Kaufpreis in Euro').fill('12,50');
  await page.getByRole('button', { name: /Vertrag als PDF erstellen/ }).click();
  await expect(page.getByLabel('Kaufpreis in Euro')).toBeFocused();
  await expect(page.getByText('Bitte gib den Preis in ganzen Euro an')).toBeVisible();
});

test('the contract PDF is part of Pro', async ({ page }) => {
  await page.goto('/kaufvertrag');
  await choosePrivate(page);
  await page.getByRole('button', { name: /Vertrag als PDF erstellen/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Kaufvertrag als PDF' });
  await expect(dialog.getByRole('link', { name: /KaufCheck Pro ansehen/ })).toHaveAttribute(
    'target',
    '_blank',
  );
});

test('a check prefills only the vehicle data, and Pro members download the contract', async ({
  page,
}) => {
  const email = uniqueEmail();
  await page.goto('/registrieren');
  await page.getByLabel('E-Mail-Adresse').fill(email);
  await page.getByLabel('Passwort').fill('ein-sicheres-passwort');
  await page.getByRole('button', { name: 'Konto erstellen' }).click();
  await expect(page).not.toHaveURL(/\/registrieren$/);
  await makePro(email);

  await analyzeFromHomepage(page, LISTINGS.audi);
  await page.getByRole('link', { name: 'Kaufvertrag vorbereiten' }).click();
  await expect(page).toHaveURL(/\/kaufvertrag\?analyse=/);
  await choosePrivate(page);
  await expect(page.getByLabel('Hersteller')).toHaveValue('Audi');
  await expect(page.getByLabel('Modell', { exact: true })).toHaveValue(/A7/);
  // The listing's mileage is no agreement: the odometer is read at the handover.
  await expect(page.getByLabel('Tachostand in km')).toHaveValue('');

  await page.getByLabel('Name, Vorname').first().fill('Muster, Erika');
  await page.getByLabel('Kaufpreis in Euro').fill('12.500');
  await page
    .getByRole('group', { name: /während der Besitzzeit des Verkäufers/ })
    .getByRole('radio', { name: 'Nein' })
    .check();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: /Vertrag als PDF erstellen/ }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(
    /^kaufvertrag-audi-a7[\w-]*-\d{4}-\d{2}-\d{2}\.pdf$/,
  );
  const file = readFileSync(await download.path());
  expect(file.subarray(0, 5).toString()).toBe('%PDF-');
  // The embedded font, so that names beyond Windows-1252 print.
  expect(file.toString('latin1')).toContain('LiberationSans');
  expect(file.length).toBeGreaterThan(5_000);
});

test('a late prefill does not replace what was typed', async ({ page }) => {
  await analyzeFromHomepage(page, LISTINGS.audi);
  const url = page.url().replace(/.*\/analyse\//, '/kaufvertrag?analyse=');
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/analyses/*', async (route) => {
    await held;
    await route.continue();
  });
  await page.goto(url);
  // While the check loads, there is no form to type into.
  await expect(page.getByText('Angaben aus der Prüfung …')).toBeVisible();
  await expect(page.getByRole('group', { name: 'Wer verkauft?' })).toHaveCount(0);
  release();
  await choosePrivate(page);
  await expect(page.getByLabel('Hersteller')).toHaveValue('Audi');
});

test('what was typed survives a link within the app, but nothing is stored', async ({ page }) => {
  await page.goto('/kaufvertrag');
  await choosePrivate(page);
  await page.getByLabel('Name, Vorname').first().fill('Musterfrau, Erika');
  await page.getByRole('link', { name: 'Gebrauchtwagen privat kaufen' }).first().click();
  await expect(page).toHaveURL(/\/gebrauchtwagen-kaufen$/);
  await page.goBack();
  await expect(page.getByLabel('Name, Vorname').first()).toHaveValue('Musterfrau, Erika');
  const stored = await page.evaluate(() =>
    JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }),
  );
  expect(stored).not.toContain('Musterfrau');
});
