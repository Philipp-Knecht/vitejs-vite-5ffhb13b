import { expect, test } from '@playwright/test';
import { PASTED_LISTING } from './helpers';

// Synthetic RDW answers (apps/api/fixtures/rdw), not real vehicles.

test('a Dutch registration number shows the RDW data in German', async ({ page }) => {
  await page.goto('/auto-aus-den-niederlanden');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Auto aus den Niederlanden');
  const plate = page.getByLabel('Niederländisches Kennzeichen');

  await plate.fill('AB-12');
  await page.getByRole('button', { name: 'Bei der RDW abfragen' }).click();
  await expect(page.getByText('Bitte gib ein niederländisches Kennzeichen ein')).toBeVisible();

  await plate.fill('qq-999-q');
  await page.getByRole('button', { name: 'Bei der RDW abfragen' }).click();
  const result = page.locator('.rdw-result');
  await expect(result.getByRole('heading', { name: /VOLKSWAGEN GOLF/ })).toBeVisible();
  await expect(result).toContainText('QQ-999-Q');
  await expect(result).toContainText('Logisch (plausibel)');
  await expect(result).toContainText('Jeder gemeldete Kilometerstand ist höher als der davor.');
  await expect(result).toContainText('1 von 2 Rückrufen sind laut RDW noch offen.');
  await expect(result).toContainText('Band onvoldoende profieldiepte');
  await expect(result).toContainText('Ja, das Auto ist aus den Niederlanden ausgeführt');
  await expect(result.getByRole('link', { name: 'RDW Open Data' })).toHaveAttribute(
    'href',
    'https://opendata.rdw.nl/',
  );

  await plate.fill('QQ888Q');
  await page.getByRole('button', { name: 'Bei der RDW abfragen' }).click();
  await expect(result).toContainText('Unlogisch');
  await expect(result).toContainText('Der Tacho kann zurückgedreht oder ein Tippfehler gemacht');
  await expect(result).toContainText('(in die Niederlande eingeführt)');
  await expect(result).toContainText('Die RDW kennt für dieses Kennzeichen keine Rückrufe.');

  await plate.fill('QQ777Q');
  await page.getByRole('button', { name: 'Bei der RDW abfragen' }).click();
  await expect(
    page.getByText('Unter diesem Kennzeichen kennt die RDW kein Fahrzeug.'),
  ).toBeVisible();
});

test('the plate goes in the body, never in the URL', async ({ page }) => {
  await page.goto('/auto-aus-den-niederlanden');
  const request = page.waitForRequest((candidate) => candidate.url().includes('/api/rdw'));
  await page.getByLabel('Niederländisches Kennzeichen').fill('QQ999Q');
  await page.getByRole('button', { name: 'Bei der RDW abfragen' }).click();
  const sent = await request;
  expect(sent.method()).toBe('POST');
  expect(sent.url()).not.toContain('QQ999Q');
  expect(sent.postDataJSON()).toEqual({ plate: 'QQ999Q' });
});

test('a check of a listing from the Netherlands links to the RDW check', async ({ page }) => {
  await page.goto('/inserat-pruefen');
  await page
    .getByLabel('Inseratstext oder Link zum Auto-Inserat')
    .fill(
      PASTED_LISTING.replace('Gepflegter Golf', 'Import aus den Niederlanden. Gepflegter Golf'),
    );
  await page.getByRole('button', { name: 'Inserat prüfen' }).click();
  await expect(page).toHaveURL(/\/analyse\//);
  await page.getByRole('link', { name: 'Auto aus den Niederlanden prüfen' }).click();
  await expect(page).toHaveURL(/\/auto-aus-den-niederlanden$/);
});
