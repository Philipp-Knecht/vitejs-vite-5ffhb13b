import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { makePro, uniqueEmail } from './helpers';

async function ownerWithCar(page: Page, pro: boolean): Promise<void> {
  const email = uniqueEmail();
  await page.goto('/registrieren');
  await page.getByLabel('E-Mail-Adresse').fill(email);
  await page.getByLabel('Passwort').fill('ein-sicheres-passwort');
  await page.getByRole('button', { name: 'Konto erstellen' }).click();
  await expect(page).not.toHaveURL(/\/registrieren$/);
  if (pro) await makePro(email);
  await page.goto('/mein-auto');
  const add = page.getByRole('region', { name: 'Auto anlegen' });
  await add.getByLabel('Marke').selectOption('skoda');
  await add.getByLabel('Modell', { exact: true }).selectOption('other');
  await add.getByLabel('Modellbezeichnung').fill('Fabia');
  await add.getByRole('group', { name: 'Erstzulassung' }).getByLabel('Jahr').fill('2018');
  await add.getByLabel('Kilometerstand').fill('80.000');
  await add.getByRole('button', { name: 'Auto anlegen' }).click();
  await page.getByRole('link', { name: 'Kostenbuch öffnen für Škoda Fabia' }).click();
  await expect(page).toHaveURL(/\/mein-auto\/[0-9a-f-]{36}\/kostenbuch$/);
}

const daysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

async function addEntry(
  page: Page,
  entry: {
    kind: string;
    date: string;
    km?: string;
    amount?: string;
    quantity?: string;
    note?: string;
  },
) {
  await page.getByRole('button', { name: 'Eintrag hinzufügen' }).click();
  const form = page.getByRole('region', { name: 'Eintrag hinzufügen' });
  await form.getByLabel('Art').selectOption({ label: entry.kind });
  await form.getByLabel('Datum').fill(entry.date);
  if (entry.km) await form.getByLabel('Kilometerstand').fill(entry.km);
  if (entry.amount) await form.getByLabel('Betrag in Euro').fill(entry.amount);
  if (entry.quantity) await form.getByLabel('Menge in Litern').fill(entry.quantity);
  if (entry.note) await form.getByLabel('Was wurde gemacht?').fill(entry.note);
  await form.getByRole('button', { name: 'Hinzufügen' }).click();
  await expect(form).toHaveCount(0);
}

test('without Pro the cost book explains itself', async ({ page }) => {
  await ownerWithCar(page, false);
  await expect(page.getByText('Das Kostenbuch gehört zu KaufCheck Pro')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Eintrag hinzufügen' })).toHaveCount(0);
});

test('entries, figures, exports and the service history', async ({ page }) => {
  await ownerWithCar(page, true);
  await addEntry(page, {
    kind: 'Tanken',
    date: daysAgo(40),
    km: '80.500',
    amount: '70,10',
    quantity: '40',
  });
  await addEntry(page, {
    kind: 'Tanken',
    date: daysAgo(20),
    km: '81.100',
    amount: '55,20',
    quantity: '36,6',
  });
  await addEntry(page, {
    kind: 'Inspektion und Wartung',
    date: daysAgo(10),
    km: '81.300',
    amount: '349,00',
    note: 'Inspektion mit Ölwechsel',
  });

  const summary = page.getByRole('region', { name: /Seit dem ersten Eintrag/ });
  await expect(summary).toContainText('474,30 €');
  // 36.6 l over 600 km.
  await expect(summary).toContainText('6,1 l/100 km');
  await expect(summary).toContainText('800 km');

  // The newest reading becomes the car's mileage.
  await page.getByRole('link', { name: 'Mein Auto' }).first().click();
  await expect(page.getByRole('article', { name: /Fabia/ })).toContainText('81.300 km');
  await page.goBack();

  await page.getByLabel('Anzeigen').selectOption('service');
  await expect(page.getByRole('heading', { level: 3 })).toHaveCount(1);
  await page.getByLabel('Anzeigen').selectOption('all');

  // A future date is refused at the field.
  await page.getByRole('button', { name: 'Eintrag hinzufügen' }).click();
  const form = page.getByRole('region', { name: 'Eintrag hinzufügen' });
  await form.getByLabel('Datum').fill(daysAgo(-2));
  await form.getByRole('button', { name: 'Hinzufügen' }).click();
  await expect(form.getByLabel('Datum')).toBeFocused();
  await expect(form.getByText('Das Datum liegt in der Zukunft.')).toBeVisible();
  await form.getByRole('button', { name: 'Abbrechen' }).click();

  const csv = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Als CSV exportieren' }).click();
  const csvText = readFileSync(await (await csv).path(), 'utf8');
  expect(csvText).toContain('Inspektion und Wartung');
  expect(csvText).toContain('349');

  const pdf = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Serviceheft als PDF' }).click();
  const file = await pdf;
  expect(file.suggestedFilename()).toMatch(/^serviceheft-\d{4}-\d{2}-\d{2}\.pdf$/);
  expect(
    readFileSync(await file.path())
      .subarray(0, 5)
      .toString(),
  ).toBe('%PDF-');

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations.map((violation) => violation.id)).toEqual([]);

  // Edit and delete.
  await page.getByRole('button', { name: /Bearbeiten.*Inspektion/ }).click();
  const edit = page.getByRole('region', { name: 'Eintrag bearbeiten' });
  await edit.getByLabel('Betrag in Euro').fill('359');
  await edit.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('359,00 €').first()).toBeVisible();
  await page.getByRole('button', { name: /Löschen.*Inspektion/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Löschen' }).click();
  await expect(page.getByRole('button', { name: /Löschen.*Inspektion/ })).toHaveCount(0);
});
