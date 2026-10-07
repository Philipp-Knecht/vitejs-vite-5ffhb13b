import { expect, test } from '@playwright/test';
import { makePro, uniqueEmail } from './helpers';

const GOLF = '/auto-finden?marke=vw&modell=vw-golf&preis_bis=15000&plz=79098&umkreis=50';

test('saving searches is part of Pro', async ({ page }) => {
  await page.goto(GOLF);
  await expect(page.getByRole('link', { name: 'Das geht mit KaufCheck Pro.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Suche speichern' })).toHaveCount(0);
});

test('Pro members save a search and open it again', async ({ page }) => {
  const email = uniqueEmail();
  await page.goto('/registrieren');
  await page.getByLabel('E-Mail-Adresse').fill(email);
  await page.getByLabel('Passwort').fill('ein-sicheres-passwort');
  await page.getByRole('button', { name: 'Konto erstellen' }).click();
  await expect(page).not.toHaveURL(/\/registrieren$/);
  await makePro(email);

  await page.goto(GOLF);
  await page.getByRole('button', { name: 'Suche speichern' }).click();
  await page.getByLabel('Name der Suche').fill('Golf für die Familie');
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Gespeichert' })).toBeVisible();

  await page.getByRole('link', { name: 'Meine Angebote' }).last().click();
  const searches = page.getByRole('region', { name: 'Gespeicherte Suchen' });
  await expect(searches.getByText('Golf für die Familie')).toBeVisible();
  await expect(searches.getByText('Volkswagen Golf · bis 15.000 € · 50 km um 79098')).toBeVisible();

  await searches.getByRole('link', { name: 'Suche öffnen' }).click();
  await expect(page).toHaveURL(GOLF);
  await expect(page.getByRole('heading', { level: 2, name: /Deine Suche auf/ })).toBeVisible();

  await page.goto('/meine-angebote');
  await page.getByRole('button', { name: 'Suche „Golf für die Familie“ löschen' }).click();
  await expect(page.getByText('Noch keine Suche gespeichert.')).toBeVisible();
});
