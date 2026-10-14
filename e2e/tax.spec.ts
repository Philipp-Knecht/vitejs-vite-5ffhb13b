import { expect, test } from '@playwright/test';

test('the tax calculator computes the Kfz-Steuer from the registration values', async ({
  page,
}) => {
  await page.goto('/kfz-steuer-rechner');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Kfz-Steuer für einen Gebrauchtwagen berechnen' }),
  ).toBeVisible();
  const result = page.getByRole('region', { name: 'Kfz-Steuer' });
  await expect(result).toContainText('Gib Erstzulassung und Antrieb an.');

  await page.getByLabel('Erstzulassung').fill('2021-02-15');
  await page.getByLabel('Antrieb').selectOption('diesel');
  await expect(result).toContainText('Noch nötig: Hubraum, CO₂-Wert.');
  await page.getByLabel('Hubraum in cm³').fill('1.530');
  await page.getByLabel('CO₂-Wert in g/km').fill('165');
  await expect(result).toContainText('315 €');
  await expect(result).toContainText('§ 9 Abs. 1 Nr. 2 c KraftStG');

  // Before July 2009 the emission class decides.
  await page.getByLabel('Erstzulassung').fill('2005-06-01');
  await page.getByLabel('Schadstoffklasse').selectOption('euro3');
  await expect(result).toContainText('247 €'); // 16 × 15,44 € = 247,04 €

  // Running costs include the tax.
  const costs = page.getByRole('region', { name: 'Laufende Kosten' });
  await page.getByLabel('Fahrleistung in km pro Jahr').fill('12.000');
  await page.getByLabel('Verbrauch in Litern je 100 km').fill('6,5');
  await page.getByLabel('Kraftstoffpreis in € je Liter').fill('1,80');
  // 247 € tax + 120 × 6.5 × 1.80 = 1,404 € fuel = 1,651 € a year
  await expect(costs).toContainText('1.651 € im Jahr');
  await expect(costs).toContainText(
    'Noch nicht eingerechnet: Versicherung, Werkstatt und Wartung.',
  );

  // Electric cars are exempt for ten years.
  await page.getByLabel('Antrieb').selectOption('electric');
  await page.getByLabel('Erstzulassung').fill('2022-03-01');
  await expect(result).toContainText('steuerfrei bis 29.02.2032');
});

test('a link from a check prefills first registration and drive', async ({ page }) => {
  await page.goto('/kfz-steuer-rechner?ez=2016-09&antrieb=diesel');
  await expect(page.getByLabel('Erstzulassung')).toHaveValue('');
  await expect(page.getByText('Laut Inserat 09/2016')).toBeVisible();
  await expect(page.getByLabel('Antrieb')).toHaveValue('diesel');
});
