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

  // Electric cars are exempt for ten years.
  await page.getByLabel('Antrieb').selectOption('electric');
  await page.getByLabel('Erstzulassung').fill('2022-03-01');
  await expect(result).toContainText('steuerfrei bis 29.02.2032');
});

test('a link from a check prefills first registration and drive', async ({ page }) => {
  await page.goto('/kfz-steuer-rechner?ez=2016-09&antrieb=diesel');
  await expect(page.getByLabel('Erstzulassung')).toHaveValue('2016-09-01');
  await expect(page.getByLabel('Antrieb')).toHaveValue('diesel');
});
