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
  // The tax alone is no estimate yet.
  await expect(costs).toContainText('Trag deine Werte ein.');
  await page.getByLabel('Fahrleistung in km pro Jahr').fill('12.000');
  await page.getByLabel('Verbrauch in Litern je 100 km').fill('6,5');
  // A point is a decimal point here, not a thousands separator.
  await page.getByLabel('Kraftstoffpreis in € je Liter').fill('1.80');
  // 247 € tax + 120 × 6.5 × 1.80 = 1,404 € fuel = 1,651 € a year
  await expect(costs).toContainText('1.651 € im Jahr');
  await expect(costs).toContainText(
    'Noch nicht eingerechnet: Versicherung, Werkstatt und Wartung.',
  );

  await page.getByLabel('Versicherung in € pro Jahr').fill('1e5');
  await expect(page.getByText('Bitte gib nur eine Zahl ein.')).toBeVisible();

  // Electric cars are exempt for ten years.
  await page.getByLabel('Antrieb').selectOption('electric');
  await page.getByLabel('Erstzulassung').fill('2022-03-01');
  await expect(result).toContainText('steuerfrei bis 29.02.2032');
  // Consumption and price change their unit, so they start empty again.
  await expect(page.getByLabel('Verbrauch in kWh je 100 km')).toHaveValue('');
  await expect(page.getByLabel('Fahrleistung in km pro Jahr')).toHaveValue('12.000');
  await page.getByLabel('Versicherung in € pro Jahr').fill('');
  await page.getByLabel('Verbrauch in kWh je 100 km').fill('17');
  await page.getByLabel('Strompreis in € je kWh').fill('35');
  await expect(page.getByText('Bitte prüfe den Preis, z. B. 0,35 je kWh.')).toBeVisible();
  // No error while a decimal is being typed.
  await page.getByLabel('Strompreis in € je kWh').fill('0,');
  await expect(page.getByText('Bitte gib nur eine Zahl ein.')).toHaveCount(0);
  await page.getByLabel('Strompreis in € je kWh').fill('0,35');
  // 120 × 17 × 0.35 = 714 € a year
  await expect(costs).toContainText('714 € im Jahr');
  await expect(costs).toContainText(
    'Kfz-Steuer: steuerfrei bis 29.02.2032, danach richtet sie sich nach dem zulässigen Gesamtgewicht',
  );

  // An exemption that ends within a year: the tax afterwards is included.
  const soon = new Date();
  soon.setFullYear(soon.getFullYear() - 10);
  soon.setDate(soon.getDate() + 30);
  const pad = (value: number) => String(value).padStart(2, '0');
  await page
    .getByLabel('Erstzulassung')
    .fill(`${soon.getFullYear()}-${pad(soon.getMonth() + 1)}-${pad(soon.getDate())}`);
  await page.getByLabel('Zulässiges Gesamtgewicht in kg').fill('2232');
  await expect(costs).toContainText('eingerechnet sind schon die 68 € im Jahr danach.');
  await expect(costs).toContainText('782 € im Jahr'); // 714 € + 68 € tax
});

test('a link from a check prefills first registration and drive', async ({ page }) => {
  await page.goto('/kfz-steuer-rechner?ez=2016-09&antrieb=diesel');
  await expect(page.getByLabel('Erstzulassung')).toHaveValue('');
  await expect(page.getByText('Laut Inserat 09/2016')).toBeVisible();
  await expect(page.getByLabel('Antrieb')).toHaveValue('diesel');
});

test('the insurance class is explained and looked up at the GDV, without class values', async ({
  page,
}) => {
  await page.goto('/kfz-steuer-rechner');
  await page.getByRole('link', { name: 'Typklasse', exact: true }).click();
  await expect(page).toHaveURL(/#typklasse$/);
  await expect(page.getByRole('heading', { name: 'Versicherung und Typklasse' })).toBeVisible();
  await expect(page.getByText('Feld 2.1, vier Ziffern', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: /Typklasse beim GDV abfragen/ })).toHaveAttribute(
    'href',
    'https://www.dieversicherer.de/versicherer/auto/typklassenabfrage',
  );
  // KaufCheck shows no class values itself (GDV terms, § 87b UrhG).
  await expect(page.getByText(/Typklasse\s*\d{2}/)).toHaveCount(0);
});

test('the buying guide links to the insurance class section', async ({ page }) => {
  await page.goto('/gebrauchtwagen-kaufen');
  await page.getByRole('link', { name: 'So findest du die Typklasse heraus.' }).click();
  await expect(page).toHaveURL(/\/kfz-steuer-rechner#typklasse$/);
  const heading = page.getByRole('heading', { name: 'Versicherung und Typklasse' });
  await expect(heading).toBeInViewport();
  await expect(heading).toBeFocused();
});

test('typing a malformed fragment does not break the page', async ({ page }) => {
  await page.goto('/kfz-steuer-rechner');
  const errors: Error[] = [];
  page.on('pageerror', (error) => errors.push(error));
  await page.evaluate(() => {
    window.location.hash = '100%';
  });
  await expect(page).toHaveURL(/#100%$/);
  await page.getByRole('link', { name: 'Gebrauchtwagen privat kaufen' }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(errors).toEqual([]);
});

test('the financing calculator works with the figures of an offer', async ({ page }) => {
  await page.goto('/kfz-steuer-rechner#finanzierung');
  const section = page
    .locator('.tax-calculator')
    .filter({ has: page.getByLabel('Kreditbetrag in €') });
  // The page is prerendered: a value typed before hydration is lost.
  await expect(async () => {
    await section.getByLabel('Kreditbetrag in €').fill('15.000');
    await expect(section.getByLabel('Kreditbetrag in €')).toHaveValue('15.000', { timeout: 1_000 });
  }).toPass();
  await section.getByLabel('Effektiver Jahreszins in %').fill('5,9');
  await section.getByLabel('Laufzeit in Monaten').fill('48');
  // (1 + 5.9 %)^(1/12) − 1 per month: about 350.60 € a month.
  await expect(section.getByText(/350,\d\d\s€\s*im Monat/)).toBeVisible();
  await expect(section.getByText(/Kreditkosten insgesamt/)).toBeVisible();

  await section.getByLabel('Schlussrate in €').fill('20.000');
  await expect(
    section.getByText('Die Schlussrate muss kleiner als der Kreditbetrag sein.'),
  ).toBeVisible();
  // A field that is not a number means no result, not a result without it.
  await section.getByLabel('Schlussrate in €').fill('5.000 €');
  await expect(section.getByText('Bitte gib nur eine Zahl ein.')).toBeVisible();
  await expect(section.getByText(/im Monat/)).toHaveCount(0);
  await section.getByLabel('Schlussrate in €').fill('5.000');
  await expect(
    section.getByText(/Darin ist die Schlussrate von 5\.000\s€ enthalten/),
  ).toBeVisible();
});
