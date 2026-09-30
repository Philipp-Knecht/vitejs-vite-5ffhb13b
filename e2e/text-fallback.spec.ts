import { expect, test } from '@playwright/test';
import { LISTINGS, PASTED_LISTING } from './helpers';

test('a listing that cannot be retrieved offers the text fallback', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Link zum Auto-Inserat auf Kleinanzeigen').fill(LISTINGS.blocked);
  await page.getByRole('button', { name: 'Inserat prüfen' }).click();

  await expect(
    page.getByText('Dieses Inserat konnte nicht automatisch ausgelesen werden.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Inseratstext einfügen' }).click();

  await expect(page).toHaveURL(/\/inseratstext$/);
  await expect(page.getByLabel('Link zum Inserat (optional)')).toHaveValue(LISTINGS.blocked);
  await expect(page.getByRole('heading', { name: 'So kopierst du den Text' })).toBeVisible();

  await page.getByRole('textbox', { name: 'Inseratstext' }).fill(PASTED_LISTING);
  await page.getByRole('button', { name: 'Text prüfen' }).click();

  await expect(page).toHaveURL(/\/analyse\//);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Golf');
  await expect(page.getByText(/Aus eingefügtem Text/)).toBeVisible();
  await expect(page.getByText('Beim eingefügten Text sind keine Fotos enthalten.')).toBeVisible();
});

test('pasted text that is too short is rejected in the browser', async ({ page }) => {
  await page.goto('/inseratstext');
  await page.getByRole('textbox', { name: 'Inseratstext' }).fill('Golf, 8000 Euro');
  await page.getByRole('button', { name: 'Text prüfen' }).click();
  await expect(page.getByText(/mindestens Titel, Preis und Fahrzeugdetails/)).toBeVisible();
});
