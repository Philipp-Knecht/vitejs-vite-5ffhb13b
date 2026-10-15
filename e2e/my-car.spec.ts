import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { analyzeFromHomepage, LISTINGS, uniqueEmail } from './helpers';

test('signed out, „Mein Auto“ explains itself and asks for an account', async ({ page }) => {
  await page.goto('/mein-auto');
  await expect(page.getByRole('heading', { level: 1, name: 'Mein Auto' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Kostenloses Konto erstellen' })).toBeVisible();
});

test('a bought car is taken over from its check and kept in view', async ({ page }) => {
  await page.goto('/registrieren');
  await page.getByLabel('E-Mail-Adresse').fill(uniqueEmail());
  await page.getByLabel('Passwort').fill('ein-sicheres-passwort');
  await page.getByRole('button', { name: 'Konto erstellen' }).click();
  await expect(page).not.toHaveURL(/\/registrieren$/);

  // From the check: the form is prefilled with the listing's data.
  await analyzeFromHomepage(page, LISTINGS.audi);
  await page.getByRole('link', { name: 'Leg das Auto unter „Mein Auto“ an' }).click();
  await expect(page).toHaveURL(/\/mein-auto\?analyse=/);
  const form = page.getByRole('region', { name: 'Auto anlegen' });
  await expect(form.getByLabel('Marke')).toHaveValue('audi');
  await expect(form.getByLabel('Modell', { exact: true })).toHaveValue('other');
  await expect(form.getByLabel('Modellbezeichnung')).not.toHaveValue('');

  // The HU is taken from the badge, not calculated.
  const hu = form.getByRole('group', { name: 'Nächste HU' });
  // 37 months ahead: within the year the form checks itself, so the server answers at the field.
  const tooLate = new Date();
  tooLate.setMonth(tooLate.getMonth() + 37, 1);
  await hu.getByLabel('Monat').selectOption(String(tooLate.getMonth() + 1));
  await hu.getByLabel('Jahr').fill(String(tooLate.getFullYear()));
  await form.getByRole('button', { name: 'Auto anlegen' }).click();
  await expect(
    form.getByText('Die HU kann höchstens drei Jahre im Voraus gültig sein.'),
  ).toBeVisible();
  await expect(hu.getByLabel('Jahr')).toBeFocused();
  const huYear = new Date().getFullYear() + 1;
  await hu.getByLabel('Monat').selectOption('3');
  await hu.getByLabel('Jahr').fill(String(huYear));
  await form.getByLabel('Kilometerstand').fill('123.000');
  await form.getByRole('button', { name: 'Auto anlegen' }).click();

  const card = page.getByRole('article', { name: /Audi/ });
  await expect(card).toContainText(`Die nächste HU ist bis Ende 03/${huYear} fällig.`);
  await expect(card).toContainText('123.000 km');
  await expect(card).toContainText(
    'Zu diesem Modell hat KaufCheck noch keine recherchierten Schwachstellen.',
  );
  await expect(card.getByRole('link', { name: /FIN-Abfrage von Audi/ })).toBeVisible();
  await expect(
    card.getByRole('link', { name: 'Typklasse für die Versicherung nachschlagen' }),
  ).toHaveAttribute('href', '/kfz-steuer-rechner#typklasse');
  await expect(page).toHaveURL(/\/mein-auto$/);

  // A calendar entry instead of e-mails.
  const downloading = page.waitForEvent('download');
  await card.getByRole('button', { name: 'HU-Frist in den Kalender' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe(`hu-${huYear}-03.ics`);
  const ics = readFileSync(await download.path(), 'utf8');
  expect(ics).toContain(`DTSTART;VALUE=DATE:${huYear}0301`);

  // One car with a free account.
  await expect(
    page.getByText('Mit dem kostenlosen Konto kannst du ein Auto anlegen.'),
  ).toBeVisible();

  const axe = await new AxeBuilder({ page })
    .include('.my-car')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(axe.violations.map((violation) => violation.id)).toEqual([]);

  // Replace it with a car from the catalog: its generation's weaknesses are shown.
  await card.getByRole('button', { name: 'Löschen' }).click();
  await page
    .getByRole('dialog', { name: 'Auto löschen?' })
    .getByRole('button', { name: 'Löschen' })
    .click();
  await expect(card).toBeHidden();
  await expect(page.getByRole('heading', { level: 1, name: 'Mein Auto' })).toBeFocused();
  const add = page.getByRole('region', { name: 'Auto anlegen' });
  await add.getByLabel('Marke').selectOption('vw');
  await add.getByLabel('Modell', { exact: true }).selectOption('vw-golf');
  await add.getByLabel('Generation').selectOption('vw-golf-7');
  await add.getByRole('group', { name: 'Erstzulassung' }).getByLabel('Jahr').fill('2016');
  await add.getByLabel('Name', { exact: true }).fill('Familienauto');
  await add.getByRole('button', { name: 'Auto anlegen' }).click();
  const golf = page.getByRole('article', { name: 'Familienauto' });
  await expect(golf).toContainText('Volkswagen Golf');
  await expect(golf.getByRole('heading', { name: /Golf VII/ })).toBeVisible();

  // Edit: the mileage changes.
  await golf.getByRole('button', { name: 'Bearbeiten' }).click();
  const edit = page.getByRole('region', { name: 'Familienauto bearbeiten' });
  await expect(edit.getByRole('heading', { name: 'Familienauto bearbeiten' })).toBeFocused();
  await edit.getByLabel('Kilometerstand').fill('88000');
  await edit.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('article', { name: 'Familienauto' })).toContainText('88.000 km');
  await expect(page.getByRole('heading', { level: 2, name: 'Familienauto' })).toBeFocused();

  // A wrong year is reported at its field.
  await page.getByRole('button', { name: /^Bearbeiten.*Familienauto/ }).click();
  await edit.getByRole('group', { name: 'Erstzulassung' }).getByLabel('Jahr').fill('2005');
  await edit.getByRole('button', { name: 'Speichern' }).click();
  await expect(edit.getByLabel('Generation')).toBeFocused();
  await expect(edit.getByText('Diese Generation passt nicht zur Erstzulassung.')).toBeVisible();
});
