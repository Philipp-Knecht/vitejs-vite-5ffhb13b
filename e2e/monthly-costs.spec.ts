import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { analyzeFromHomepage, LISTINGS, makePro, uniqueEmail } from './helpers';

test('monthly costs of the compared offers are part of Pro and come from own figures', async ({
  page,
}) => {
  const email = uniqueEmail();
  await page.goto('/registrieren');
  await page.getByLabel('E-Mail-Adresse').fill(email);
  await page.getByLabel('Passwort').fill('ein-sicheres-passwort');
  await page.getByRole('button', { name: 'Konto erstellen' }).click();
  await expect(page).not.toHaveURL(/\/registrieren$/);
  for (const listing of [LISTINGS.audi, LISTINGS.bmw]) {
    await analyzeFromHomepage(page, listing);
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByRole('link', { name: 'Gespeichert' })).toBeVisible();
  }
  await page.goto('/meine-angebote');
  const selections = page.getByRole('checkbox', { name: /zum Vergleich auswählen/ });
  await selections.nth(0).check();
  await selections.nth(1).check();
  await page.getByRole('button', { name: 'Vergleichen' }).click();

  const section = page.getByRole('region', { name: /Kosten pro Monat/ });
  await expect(section.getByRole('link', { name: 'KaufCheck Pro ansehen' })).toBeVisible();
  await expect(section.getByRole('textbox')).toHaveCount(0);

  await makePro(email);
  await page.reload();
  await section.getByLabel('Fahrleistung in km pro Jahr').fill('12.000');
  const groups = section.getByRole('group');
  const cars = groups.filter({ has: page.getByLabel('Kraftstoff oder Strom') });
  await expect(cars).toHaveCount(2);
  for (const index of [0, 1]) {
    const car = cars.nth(index);
    await car.getByLabel('Kraftstoff oder Strom').selectOption('diesel');
    await car.getByLabel('Verbrauch in l je 100 km').fill(index === 0 ? '6' : '5');
    await car.getByLabel('Kfz-Steuer in Euro pro Jahr').fill('240');
    await car.getByLabel('Versicherung in Euro pro Jahr').fill('600');
  }
  await section.getByLabel('Preis Diesel in Euro je l').fill('1,70');

  const table = section.getByRole('region', { name: 'Kosten pro Monat im Vergleich' });
  // 12,000 km × 6 l × 1.70 € / 12 = 102 €, plus 20 € tax and 50 € insurance.
  await expect(table).toContainText('rund 172 €');
  // 5 l: 85 € fuel.
  await expect(table).toContainText('rund 155 €');
  await expect(table.getByText('niedrigste Summe')).toHaveCount(1);
  await expect(table).toContainText('ohne Wertverlust, Werkstatt und Reifen, Sonstiges');

  // Different parts filled in: no cheapest offer.
  await cars.nth(0).getByLabel('Werkstatt und Reifen in Euro pro Jahr').fill('480');
  await expect(table.getByText('niedrigste Summe')).toHaveCount(0);
  await expect(section.getByText(/erst vergleichbar/)).toBeVisible();

  const results = await new AxeBuilder({ page })
    .include('section.monthly-costs')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations.map((violation) => violation.id)).toEqual([]);

  // Depreciation: price minus resale value over the holding period.
  await section.getByLabel('Haltedauer in Jahren').fill('4');
  await cars.nth(1).getByLabel('Kaufpreis in Euro').fill('20.000');
  await cars.nth(1).getByLabel('Erwarteter Wert beim Verkauf in Euro').fill('12.800');
  // 7,200 € over 48 months.
  await expect(table).toContainText('150 €');
  await cars.nth(1).getByLabel('Erwarteter Wert beim Verkauf in Euro').fill('25.000');
  await expect(cars.nth(1).getByText(/Höher als der Kaufpreis/)).toBeVisible();

  // The assumptions stay in this browser.
  await page.reload();
  await expect(cars.nth(1).getByLabel('Verbrauch in l je 100 km')).toHaveValue('5');
  const stored = await page.evaluate(() =>
    Object.keys(localStorage)
      .filter((key) => key.startsWith('kaufcheck:monatskosten:'))
      .map((key) => localStorage.getItem(key)),
  );
  // One entry for this account only.
  expect(stored).toHaveLength(1);
  expect(stored[0]).toContain('"consumption":"5"');

  // Logging out removes them from this browser.
  await page.goto('/konto');
  await page.getByRole('button', { name: 'Abmelden' }).click();
  await expect(page).toHaveURL('/');
  const left = await page.evaluate(() =>
    Object.keys(localStorage).filter((key) => key.startsWith('kaufcheck:monatskosten')),
  );
  expect(left).toEqual([]);
});
