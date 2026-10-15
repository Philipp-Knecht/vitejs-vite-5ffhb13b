import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { makePro, uniqueEmail } from './helpers';

async function register(page: Page): Promise<string> {
  const email = uniqueEmail();
  await page.goto('/registrieren');
  await page.getByLabel('E-Mail-Adresse').fill(email);
  await page.getByLabel('Passwort').fill('ein-sicheres-passwort');
  await page.getByRole('button', { name: 'Konto erstellen' }).click();
  await expect(page).not.toHaveURL(/\/registrieren$/);
  return email;
}

test('the selling guide is prerendered, and the listing text is part of Pro', async ({
  page,
  request,
}) => {
  const html = await (await request.get('/auto-verkaufen')).text();
  expect(html).toContain('Auto privat verkaufen');
  expect(html).toContain('Nach dem Verkauf');

  await page.goto('/auto-verkaufen');
  await page.getByRole('button', { name: /Inseratstext erstellen/ }).click();
  await expect(page.getByLabel('Marke')).toBeFocused();
  await expect(page.getByText('Bitte gib die Marke an.')).toBeVisible();

  await page.getByLabel('Marke').fill('Opel');
  await page.getByLabel('Modell', { exact: true }).fill('Corsa');
  await page.getByRole('button', { name: /Inseratstext erstellen/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Inseratstext' });
  await expect(dialog.getByRole('link', { name: /KaufCheck Pro ansehen/ })).toHaveAttribute(
    'target',
    '_blank',
  );
  await expect(page.getByLabel('Beschreibung')).toHaveCount(0);
});

test('the filled form meets WCAG 2.1 AA checks', async ({ page }) => {
  await page.goto('/auto-verkaufen');
  await page.getByLabel('Kraftstoff oder Energiequelle').selectOption('electric');
  await expect(page.getByLabel('Antriebsbatterie')).toBeVisible();
  await page
    .getByRole('group', { name: /seit es dir gehört/ })
    .getByRole('radio', { name: 'Ja' })
    .check();
  await page.getByRole('button', { name: /Inseratstext erstellen/ }).click();
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations.map((violation) => violation.id)).toEqual([]);
});

test('from „Mein Auto“ to the listing text and on to the contract', async ({ page }) => {
  const email = await register(page);
  await makePro(email);

  await page.goto('/mein-auto');
  const add = page.getByRole('region', { name: 'Auto anlegen' });
  await add.getByLabel('Marke').selectOption('skoda');
  await add.getByLabel('Modell', { exact: true }).selectOption('other');
  await add.getByLabel('Modellbezeichnung').fill('Fabia');
  await add.getByRole('group', { name: 'Erstzulassung' }).getByLabel('Monat').selectOption('6');
  await add.getByRole('group', { name: 'Erstzulassung' }).getByLabel('Jahr').fill('2018');
  await add.getByLabel('Kilometerstand').fill('70.000');
  await add.getByRole('button', { name: 'Auto anlegen' }).click();

  await page.getByRole('link', { name: 'Inseratstext schreiben für Škoda Fabia' }).click();
  await expect(page).toHaveURL(/\/auto-verkaufen\?auto=.+#inserat$/);
  await expect(page.getByLabel('Marke')).toHaveValue('Škoda');
  await expect(page.getByLabel('Modell', { exact: true })).toHaveValue('Fabia');
  await expect(page.getByLabel('Erstzulassung')).toHaveValue('06/2018');
  // An old reading is no statement for a listing.
  await expect(page.getByLabel('Kilometerstand laut Tacho')).toHaveValue('');

  await page.getByLabel('Kilometerstand laut Tacho').fill('81500');
  await page.getByLabel('Leistung in kW').fill('70');
  await page
    .getByRole('group', { name: /seit es dir gehört/ })
    .getByRole('radio', { name: 'Nein' })
    .check();
  await page
    .getByRole('group', { name: /vor deiner Besitzzeit/ })
    .getByRole('radio', { name: 'Weiß ich nicht' })
    .check();
  await page
    .getByRole('group', { name: 'Bekannte Mängel' })
    .getByRole('radio', { name: 'Ja, diese:' })
    .check();
  await page.getByLabel('Welche Mängel?').fill('Kratzer an der Stoßstange hinten');
  await page.getByRole('button', { name: 'Inseratstext erstellen' }).click();

  await expect(page.getByRole('heading', { name: 'Dein Inseratstext' })).toBeFocused();
  await expect(page.getByLabel('Titel')).toHaveValue('Škoda Fabia, 81.500 km, EZ 06/2018');
  const description = page.getByLabel('Beschreibung');
  await expect(description).toHaveValue(/Leistung: 70 kW \(95 PS\)/);
  await expect(description).toHaveValue(/Ob es vor meiner Besitzzeit Schäden gab, weiß ich nicht/);
  await expect(description).toHaveValue(/Bekannte Mängel\n- Kratzer an der Stoßstange hinten/);

  // The text follows the input.
  await page.getByLabel('Farbe').fill('Blau');
  await expect(description).toHaveValue(/Farbe: Blau/);

  await page.getByRole('link', { name: /Kaufvertrag mit diesen Angaben vorbereiten/ }).click();
  await expect(page).toHaveURL(/\/kaufvertrag\?inserat=1#vertrag$/);
  await page
    .getByRole('group', { name: 'Wer verkauft?' })
    .getByRole('radio', { name: 'Eine Privatperson' })
    .check();
  await page
    .getByRole('group', { name: 'Wer kauft?' })
    .getByRole('radio', { name: 'Eine Privatperson' })
    .check();
  await expect(page.getByLabel('Hersteller')).toHaveValue('Škoda');
  await expect(page.getByLabel('Farbe')).toHaveValue('Blau');
  await expect(page.getByLabel('Tachostand in km')).toHaveValue('');
  await expect(page.getByLabel('Weitere bekannte Mängel und Schäden')).toHaveValue(
    'Kratzer an der Stoßstange hinten',
  );
  const before = page.getByRole('group', { name: /vor der Besitzzeit des Verkäufers/ });
  await expect(before.getByRole('radio', { name: 'Nicht bekannt' })).toBeChecked();
  await page.getByLabel('Name, Vorname').nth(1).fill('Käufer, Karl');

  // A change to the listing reaches the contract; what was typed there stays.
  await page.getByRole('link', { name: 'Zurück zum Inseratstext' }).click();
  await expect(page).toHaveURL(/\/auto-verkaufen\?auto=.+#inserat$/);
  await expect(page.getByLabel('Beschreibung')).toHaveValue(/Farbe: Blau/);
  await page.getByLabel('Welche Mängel?').fill('Delle in der Fahrertür');
  await page.getByRole('link', { name: /Kaufvertrag mit diesen Angaben vorbereiten/ }).click();
  await expect(page.getByLabel('Weitere bekannte Mängel und Schäden')).toHaveValue(
    'Delle in der Fahrertür',
  );
  await expect(page.getByLabel('Name, Vorname').nth(1)).toHaveValue('Käufer, Karl');

  await page.goBack();
  await expect(page.getByLabel('Farbe')).toHaveValue('Blau');
  const stored = await page.evaluate(() =>
    JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }),
  );
  expect(stored).not.toContain('Stoßstange');
});

test('a text created from „Mein Auto“ without typing reaches the contract', async ({ page }) => {
  const email = await register(page);
  await makePro(email);
  await page.goto('/mein-auto');
  const add = page.getByRole('region', { name: 'Auto anlegen' });
  await add.getByLabel('Marke').selectOption('skoda');
  await add.getByLabel('Modell', { exact: true }).selectOption('other');
  await add.getByLabel('Modellbezeichnung').fill('Fabia');
  await add.getByRole('group', { name: 'Erstzulassung' }).getByLabel('Jahr').fill('2018');
  await add.getByRole('button', { name: 'Auto anlegen' }).click();

  await page.getByRole('link', { name: 'Inseratstext schreiben für Škoda Fabia' }).click();
  // „Mein Auto“ knows the year alone.
  await expect(page.getByLabel('Erstzulassung')).toHaveValue('2018');
  await expect(
    page.getByText('Marke, Modell und Erstzulassung aus „Mein Auto“ übernommen.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Inseratstext erstellen' }).click();
  await expect(page.getByLabel('Titel')).toHaveValue('Škoda Fabia, EZ 2018');
  await page.getByRole('link', { name: /Kaufvertrag mit diesen Angaben vorbereiten/ }).click();
  await page
    .getByRole('group', { name: 'Wer verkauft?' })
    .getByRole('radio', { name: 'Eine Privatperson' })
    .check();
  await page
    .getByRole('group', { name: 'Wer kauft?' })
    .getByRole('radio', { name: 'Eine Privatperson' })
    .check();
  await expect(page.getByLabel('Hersteller')).toHaveValue('Škoda');
  await expect(page.getByLabel('Erstzulassung')).toHaveValue('2018');
});
