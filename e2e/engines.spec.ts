import { expect, test } from '@playwright/test';

test('picking make, model and engine fills the tax and running costs', async ({ page }) => {
  await page.goto('/kfz-steuer-rechner');
  const picker = page.getByRole('group', { name: 'Werte aus dem Modell übernehmen' });
  await page.getByLabel('Erstzulassung').fill('2021-05-10');
  await picker.getByLabel('Marke').selectOption({ label: 'Volkswagen' });
  await picker.getByLabel('Modell').selectOption({ label: 'Golf' });
  await expect(picker.getByText(/Motoren der Neuzulassungen 2021 in Deutschland/)).toBeVisible();
  await picker.getByLabel('Motor').selectOption({ label: '1,5 l Benzin, 110 kW (150 PS)' });

  await expect(page.getByLabel('Antrieb')).toHaveValue('petrol');
  await expect(page.getByLabel('Hubraum in cm³')).toHaveValue('1498');
  await expect(page.getByLabel('CO₂-Wert in g/km')).toHaveValue('130');
  await expect(picker.getByText(/verbindlich ist dein Fahrzeugschein/)).toBeVisible();
  await expect(picker.getByRole('link', { name: /Europäische Umweltagentur/ })).toHaveAttribute(
    'href',
    /^https:\/\/www\.eea\.europa\.eu\//,
  );
  // 15 × 2 € for 1,498 cm³ plus 20 × 2.00 € and 15 × 2.20 € for 130 g/km = 103 €.
  await expect(page.getByRole('region', { name: 'Kfz-Steuer' })).toContainText('103 €');
  await expect(page.getByLabel('Verbrauch in Litern je 100 km')).toHaveValue('5,8');
  await expect(page.getByText(/Normverbrauch \(WLTP\) laut EU-Daten/)).toBeVisible();

  // An older diesel: NEDC value for the tax, consumption estimated from it.
  await page.getByLabel('Erstzulassung').fill('2015-06-01');
  await picker.getByLabel('Motor').selectOption({ label: '2,0 l Diesel, 110 kW (150 PS)' });
  await expect(page.getByLabel('CO₂-Wert in g/km')).toHaveValue('115');
  await expect(page.getByLabel('Verbrauch in Litern je 100 km')).toHaveValue('4,4');
  await expect(page.getByText(/Aus dem CO₂-Wert des Motors geschätzt/)).toBeVisible();

  // A value typed in stays when the next pick has no consumption.
  await page.getByLabel('Verbrauch in Litern je 100 km').fill('5,5');
  await picker.getByLabel('Modell').selectOption({ label: 'Passat' });
  await expect(page.getByLabel('Verbrauch in Litern je 100 km')).toHaveValue('5,5');
});

test('a link from a check preselects the model and the engine', async ({ page }) => {
  await page.goto('/kfz-steuer-rechner?ez=2015-06&antrieb=diesel&marke=vw&modell=vw-golf&kw=110');
  const picker = page.getByRole('group', { name: 'Werte aus dem Modell übernehmen' });
  await expect(picker.getByLabel('Modell')).toHaveValue('vw-golf');
  await expect(picker.getByText(/Trag oben die Erstzulassung ein/)).toBeVisible();
  // The day is not in the listing: once it is typed in, the engine with the listed power is picked.
  await page.getByLabel('Erstzulassung').fill('2015-06-01');
  await expect(page.getByLabel('Hubraum in cm³')).toHaveValue('1968');
  await expect(picker.getByLabel('Motor')).toHaveValue('diesel|1968|110');
});
