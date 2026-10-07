import { expect, test } from '@playwright/test';
import { analyzeFromHomepage, LISTINGS, uniqueEmail } from './helpers';

test('save listings with a new account, compare, rename and delete them', async ({ page }) => {
  await analyzeFromHomepage(page, LISTINGS.audi);
  const analysisUrl = page.url();

  // Saving needs an account; registering returns to the analysis.
  await page.getByRole('button', { name: 'Speichern' }).click();
  const dialog = page.getByRole('dialog', { name: 'Angebot speichern' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('link', { name: 'Kostenloses Konto erstellen' }).click();

  await expect(page).toHaveURL(/\/registrieren$/);
  await page.getByLabel('E-Mail-Adresse').fill(uniqueEmail());
  await page.getByLabel('Passwort').fill('ein-sicheres-passwort');
  await page.getByRole('button', { name: 'Konto erstellen' }).click();

  await expect(page).toHaveURL(analysisUrl);
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('In „Meine Angebote“ gespeichert')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Gespeichert' })).toBeVisible();

  await analyzeFromHomepage(page, LISTINGS.bmw);
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('link', { name: 'Gespeichert' })).toBeVisible();

  // Compare both.
  await page.goto('/meine-angebote');
  const selections = page.getByRole('checkbox', { name: /zum Vergleich auswählen/ });
  await expect(selections).toHaveCount(2);
  await selections.nth(0).check();
  await selections.nth(1).check();
  await page.getByRole('button', { name: 'Vergleichen' }).click();

  await expect(page).toHaveURL(/\/vergleich\?ids=/);
  const table = page.getByRole('region', { name: 'Vergleichstabelle' });
  await expect(table).toContainText('Audi A7');
  await expect(table).toContainText('BMW');
  await expect(table).toContainText('Kilometerstand');
  await expect(table).not.toContainText(/Sieger|Empfehlung|besser/i);

  // The buyer's priorities decide the order: only the price matters here.
  const decision = page.getByRole('region', { name: 'Deine Reihenfolge' });
  for (const criterion of [
    'Kilometerstand',
    'Alter',
    'Vollständige Angaben',
    'Auffälligkeiten im Inserat',
  ]) {
    await decision.getByRole('group', { name: criterion }).getByText('Egal').click();
  }
  await decision.getByRole('group', { name: 'Preis' }).getByText('Sehr wichtig').click();
  await expect(decision.getByText(/zuerst anfragen: Audi A7/)).toBeVisible();
  await expect(decision.getByRole('listitem').first()).toContainText('günstigster Preis');

  // Rename and delete.
  await page.goto('/meine-angebote');
  await page.getByRole('button', { name: 'Umbenennen' }).first().click();
  const rename = page.getByRole('dialog', { name: 'Angebot umbenennen' });
  await rename.getByLabel('Eigener Name').fill('Mein Favorit');
  await rename.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('link', { name: 'Mein Favorit' })).toBeVisible();

  await page.getByRole('button', { name: 'Löschen' }).first().click();
  const confirm = page.getByRole('dialog', { name: 'Angebot löschen?' });
  await confirm.getByRole('button', { name: 'Löschen' }).click();
  await expect(page.getByText('Angebot gelöscht')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /zum Vergleich auswählen/ })).toHaveCount(1);

  // The analysis history is a Pro feature.
  await page.goto('/verlauf');
  await expect(page.getByText('Der Verlauf ist Teil von KaufCheck Pro')).toBeVisible();

  // Sign out.
  await page.goto('/konto');
  await page.getByRole('button', { name: 'Abmelden' }).click();
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('link', { name: 'Anmelden' })).toBeVisible();
});

test('billing is honestly unavailable when no payment provider is configured', async ({ page }) => {
  await page.goto('/pro');
  await expect(page.getByRole('button', { name: 'Bald verfügbar' })).toBeDisabled();
  await expect(
    page.getByText('Die Bezahlung ist noch nicht freigeschaltet.').first(),
  ).toBeVisible();
});
