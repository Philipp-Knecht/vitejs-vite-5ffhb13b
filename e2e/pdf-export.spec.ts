import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { analyzeFromHomepage, LISTINGS, makePro, uniqueEmail } from './helpers';

test('the PDF folder is part of Pro', async ({ page }) => {
  await analyzeFromHomepage(page, LISTINGS.audi);
  await page.getByRole('button', { name: /Als PDF herunterladen/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Prüfung als PDF-Mappe' });
  await expect(dialog.getByRole('link', { name: 'KaufCheck Pro ansehen' })).toBeVisible();
});

test('Pro members download an analysis as a PDF', async ({ page }) => {
  const email = uniqueEmail();
  await page.goto('/registrieren');
  await page.getByLabel('E-Mail-Adresse').fill(email);
  await page.getByLabel('Passwort').fill('ein-sicheres-passwort');
  await page.getByRole('button', { name: 'Konto erstellen' }).click();
  await expect(page).not.toHaveURL(/\/registrieren$/);
  await makePro(email);

  await analyzeFromHomepage(page, LISTINGS.audi);
  await page.getByRole('checkbox', { name: /Fahrzeugschein/ }).check();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: /Als PDF herunterladen/ }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^kaufcheck-audi-a7-[\w-]+-\d{4}-\d{2}-\d{2}\.pdf$/);
  const file = readFileSync(await download.path());
  expect(file.subarray(0, 5).toString()).toBe('%PDF-');
  expect(file.length).toBeGreaterThan(5_000);
});
