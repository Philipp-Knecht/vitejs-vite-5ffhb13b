import { expect, test } from '@playwright/test';
import { analyzeFromHomepage, LISTINGS } from './helpers';

test('visitors without an account reach the free monthly limit', async ({ page }) => {
  for (let index = 0; index < 3; index += 1) await analyzeFromHomepage(page, LISTINGS.mercedes);

  await page.goto('/');
  await page.getByLabel('Inseratstext oder Link zum Auto-Inserat').fill(LISTINGS.mercedes);
  await page.getByRole('button', { name: 'Inserat prüfen' }).click();

  await expect(page.getByText('Monatliches Kontingent aufgebraucht')).toBeVisible();
  await expect(page.getByText(/3 kostenlosen Analysen für diesen Monat/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Kostenloses Konto erstellen' })).toBeVisible();

  // The fictional example stays available.
  await page.goto('/');
  await page.getByRole('button', { name: 'Fiktives Beispiel ansehen' }).click();
  await expect(page).toHaveURL(/\/analyse\//);
});
