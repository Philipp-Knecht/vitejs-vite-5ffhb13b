import { readdirSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';

/** Researched models (packages/catalog/data/models): model pages and the advisor depend on them. */
export const MODELS_DIR = new URL('../packages/catalog/data/models/', import.meta.url);
export const MODEL_IDS = readdirSync(MODELS_DIR)
  .filter((file) => file.endsWith('.json'))
  .map((file) => file.slice(0, -'.json'.length))
  .sort();
// As in apps/web/src/features/advisor/availability.ts (which needs Vite to load).
export const ADVISOR_MIN_MODELS = 40;
export const ADVISOR_AVAILABLE = MODEL_IDS.length >= ADVISOR_MIN_MODELS;

/** Synthetic fixture listings (apps/api/fixtures/listings) – not real offers. */
export const LISTINGS = {
  audi: 'https://www.kleinanzeigen.de/s-anzeige/audi-a7/2912345678-216-3331',
  bmw: 'https://www.kleinanzeigen.de/s-anzeige/bmw-530d/2911111111-216-3331',
  mercedes: 'https://www.kleinanzeigen.de/s-anzeige/mercedes-e350/2913333333-216-3331',
  blocked: 'https://www.kleinanzeigen.de/s-anzeige/auto/2919999999-216-3331',
};

export const PASTED_LISTING = [
  'VW Golf 1.4 TSI Highline',
  '8.450 € VB',
  '10115 Berlin - Mitte',
  'Details',
  'Marke',
  'Volkswagen',
  'Modell',
  'Golf',
  'Kilometerstand',
  '142.000 km',
  'Erstzulassung',
  'März 2014',
  'Kraftstoffart',
  'Benzin',
  'Getriebe',
  'Manuell',
  'Beschreibung',
  'Gepflegter Golf aus zweiter Hand. Scheckheft vorhanden, neue Bremsen vorne. Probefahrt nach Absprache.',
].join('\n');

export const uniqueEmail = () =>
  `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

/** Enters a listing link on the homepage and waits for the result page. */
export async function analyzeFromHomepage(page: Page, url: string): Promise<void> {
  await page.goto('/inserat-pruefen');
  await page.getByLabel('Inseratstext oder Link zum Auto-Inserat').fill(url);
  await page.getByRole('button', { name: 'Inserat prüfen' }).click();
  await expect(page).toHaveURL(/\/analyse\/[0-9a-f-]{36}$/);
  await expect(page.locator('.vehicle-header h1')).toBeVisible();
}

export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth, 'page must not scroll horizontally').toBeLessThanOrEqual(innerWidth);
}
