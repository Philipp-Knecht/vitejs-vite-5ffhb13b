import { expect, test, type Page } from '@playwright/test';

const picker = (page: Page) => page.getByRole('group', { name: 'Werte aus dem Modell übernehmen' });

test('picking make, model and engine fills the tax and running costs', async ({ page }) => {
  await page.goto('/kfz-steuer-rechner');
  await page.getByLabel('Erstzulassung').fill('2021-05-10');
  await picker(page).getByLabel('Marke').selectOption({ label: 'Volkswagen' });
  await picker(page).getByLabel('Modell').selectOption({ label: 'Golf' });
  await expect(
    picker(page).getByText(/Motoren der Neuzulassungen 2021 in Deutschland/),
  ).toBeVisible();
  await picker(page).getByLabel('Motor').selectOption({ label: '1,5 l Benzin, 110 kW (150 PS)' });

  await expect(page.getByLabel('Antrieb')).toHaveValue('petrol');
  await expect(page.getByLabel('Hubraum in cm³')).toHaveValue('1498');
  await expect(page.getByLabel('CO₂-Wert in g/km')).toHaveValue('130');
  await expect(picker(page).getByText(/verbindlich ist dein Fahrzeugschein/)).toBeVisible();
  await expect(picker(page).getByText(/GD CLIMA/)).toBeVisible();
  await expect(
    picker(page).getByRole('link', { name: /Europäische Umweltagentur/ }),
  ).toHaveAttribute('href', /^https:\/\/www\.eea\.europa\.eu\//);
  await expect(picker(page).getByRole('link', { name: 'CC BY 4.0' })).toHaveAttribute(
    'href',
    /creativecommons\.org\/licenses\/by\/4\.0/,
  );
  // 15 × 2 € for 1,498 cm³ plus 20 × 2.00 € and 15 × 2.20 € for 130 g/km = 103 €.
  await expect(page.getByRole('region', { name: 'Kfz-Steuer' })).toContainText('103 €');
  await expect(page.getByLabel('Verbrauch in Litern je 100 km')).toHaveValue('5,8');
  await expect(page.getByText(/Normverbrauch \(WLTP\) laut EU-Daten/)).toBeVisible();

  // An older diesel: the NEDC value for the tax, the consumption estimated from it.
  await page.getByLabel('Erstzulassung').fill('2015-06-01');
  await picker(page).getByLabel('Motor').selectOption({ label: '2,0 l Diesel, 110 kW (150 PS)' });
  await expect(page.getByLabel('CO₂-Wert in g/km')).toHaveValue('115');
  await expect(page.getByLabel('Verbrauch in Litern je 100 km')).toHaveValue('4,4');
  await expect(page.getByText(/Aus dem CO₂-Wert des Motors \(NEFZ\) geschätzt/)).toBeVisible();

  // A value typed in stays when the next pick has no consumption.
  await page.getByLabel('Verbrauch in Litern je 100 km').fill('5,5');
  await picker(page).getByLabel('Modell').selectOption({ label: 'Passat' });
  await expect(page.getByLabel('Verbrauch in Litern je 100 km')).toHaveValue('5,5');
  // The values of the previous engine go with it.
  await expect(page.getByLabel('CO₂-Wert in g/km')).toHaveValue('');
});

test('a changed first registration takes the values of that year and test', async ({ page }) => {
  await page.goto('/kfz-steuer-rechner');
  await page.getByLabel('Erstzulassung').fill('2018-08-15');
  await picker(page).getByLabel('Marke').selectOption({ label: 'Volkswagen' });
  await picker(page).getByLabel('Modell').selectOption({ label: 'Golf' });
  await picker(page).getByLabel('Motor').selectOption({ label: '2,0 l Diesel, 110 kW (150 PS)' });
  await expect(page.getByLabel('CO₂-Wert in g/km')).toHaveValue('113');

  // From September 2018 the WLTP value counts, which the EU data lacks for this engine.
  await page.getByLabel('Erstzulassung').fill('2018-09-15');
  await expect(page.getByLabel('CO₂-Wert in g/km')).toHaveValue('');
  await expect(picker(page).getByText(/fehlt der CO₂-Wert nach WLTP/)).toBeVisible();

  // A year without this engine: the pick goes, a value typed in stays.
  await page.getByLabel('CO₂-Wert in g/km').fill('120');
  await page.getByLabel('Erstzulassung').fill('2009-03-01');
  await expect(picker(page).getByLabel('Motor')).toHaveValue('');
  await expect(page.getByLabel('CO₂-Wert in g/km')).toHaveValue('120');
  // Drive and displacement do not change with the year.
  await expect(page.getByLabel('Hubraum in cm³')).toHaveValue('1968');
  await expect(
    picker(page).getByText(/hat dieses Modell keine Daten; vorhanden sind 2011/),
  ).toBeVisible();
});

test('a link from a check preselects model and engine, without overwriting typed values', async ({
  page,
}) => {
  await page.goto('/kfz-steuer-rechner?ez=2015-06&antrieb=diesel&marke=vw&modell=vw-golf&kw=110');
  await expect(picker(page).getByLabel('Modell')).toHaveValue('vw-golf');
  await expect(picker(page).getByText(/Trag oben die Erstzulassung ein/)).toBeVisible();
  await page.getByLabel('CO₂-Wert in g/km').fill('119');
  // The day is not in the listing: once it is typed in, the engine with the listed power is picked.
  await page.getByLabel('Erstzulassung').fill('2015-06-01');
  await expect(picker(page).getByLabel('Motor')).toHaveValue('diesel|1968|110');
  await expect(page.getByLabel('Hubraum in cm³')).toHaveValue('1968');
  await expect(page.getByLabel('CO₂-Wert in g/km')).toHaveValue('119');
});

test('the preselection from a check can be changed, and unknown models are ignored', async ({
  page,
}) => {
  await page.goto('/kfz-steuer-rechner?ez=2015-06&marke=vw&modell=vw-golf&kw=110');
  await expect(picker(page).getByLabel('Modell')).toHaveValue('vw-golf');
  await picker(page).getByLabel('Marke').selectOption({ label: 'Škoda' });
  await expect(picker(page).getByLabel('Marke')).toHaveValue('skoda');
  await expect(picker(page).getByLabel('Modell')).toHaveValue('');

  await page.goto('/kfz-steuer-rechner?marke=vw&modell=%3Cscript%3E&kw=99999');
  await expect(picker(page).getByLabel('Marke')).toHaveValue('');
  await expect(page.getByLabel('Hubraum in cm³')).toHaveValue('');
});
