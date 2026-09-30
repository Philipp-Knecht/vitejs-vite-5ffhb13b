import { expect, test } from '@playwright/test';
import { analyzeFromHomepage, LISTINGS } from './helpers';

test('homepage → analysis result with all sections', async ({ page, context }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('KaufCheck – Gebrauchtwagen-Angebote prüfen');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Gebraucht kaufen.');

  await analyzeFromHomepage(page, LISTINGS.audi);

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Audi A7');
  for (const section of [
    'Das Wichtigste in Kürze',
    'Überblick',
    'Preis einordnen',
    'Was wissen wir?',
    'Darauf solltest du achten',
    'Fragen an den Verkäufer',
    'Checkliste für die Besichtigung',
    'Fotos',
  ]) {
    await expect(page.getByRole('heading', { level: 2, name: section })).toBeVisible();
  }
  // No invented market data.
  await expect(
    page.getByText(
      'Für eine belastbare Marktpreis-Einordnung liegen aktuell nicht genügend Vergleichsdaten vor.',
    ),
  ).toBeVisible();
  // Evidence labels and the mileage contradiction with its quote.
  await expect(page.getByText('Aus dem Inserat').first()).toBeVisible();
  await expect(page.getByText('Berechnet').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: /Kilometerstände/ }).first()).toBeVisible();
  // The development AI mock is labelled as simulated.
  await expect(
    page.getByText('Simulierte KI-Einschätzung (Entwicklungsmodus)', { exact: true }),
  ).toBeVisible();

  // Seller questions: copy, switch form of address, compose a message.
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: 'Alle Fragen kopieren' }).click();
  await expect(page.getByText('Alle Fragen kopiert')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/^1\. /);

  const questions = page.locator('.question-list');
  await expect(questions).toContainText('Können Sie');
  await page.getByRole('button', { name: 'du', exact: true }).click();
  await expect(questions).not.toContainText('Können Sie');

  await page.getByRole('button', { name: 'Nachricht erstellen' }).click();
  const composer = page.getByRole('dialog', { name: 'Nachricht an den Verkäufer' });
  await expect(composer.getByLabel('Nachricht')).toHaveValue(
    /^Hallo,\n\nich interessiere mich für dein Auto/,
  );
  await composer.getByRole('button', { name: 'Schließen' }).click();
  await expect(composer).toBeHidden();

  // The checklist progress survives a reload (stored in this browser only).
  const firstItem = page.getByRole('checkbox', { name: /Fahrzeugschein/ });
  await firstItem.check();
  await expect(page.getByText('1 von')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('checkbox', { name: /Fahrzeugschein/ })).toBeChecked();
});

test('the fictional example is clearly labelled', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Fiktives Beispiel ansehen' }).click();
  await expect(page).toHaveURL(/\/analyse\//);
  await expect(page.getByText('Fiktives Beispiel.', { exact: false })).toBeVisible();
});

test('invalid links get instant feedback without a request', async ({ page }) => {
  await page.goto('/');
  await page
    .getByLabel('Inseratstext oder Link zum Auto-Inserat')
    .fill('https://www.mobile.de/auto/123');
  await page.getByRole('button', { name: 'Inserat prüfen' }).click();
  await expect(page.getByText(/Auto-Inserate von kleinanzeigen\.de/)).toBeVisible();
  await expect(page).toHaveURL('/');
});
