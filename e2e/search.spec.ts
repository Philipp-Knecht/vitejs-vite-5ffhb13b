import { expect, test } from '@playwright/test';

test('the homepage search opens the platform links with the filters', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('tab', { name: 'Auto finden' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  const search = page.getByRole('search', { name: 'Gebrauchtwagen suchen' });
  await search.getByLabel('Marke').selectOption('vw');
  await search.getByLabel('Modell').fill('Golf');
  await search.getByLabel('Preis bis').selectOption('15000');
  await search.getByLabel('PLZ').fill('79098');
  await search.getByRole('button', { name: 'Angebote finden' }).click();

  await expect(page).toHaveURL(
    '/auto-finden?marke=vw&modell=vw-golf&preis_bis=15000&plz=79098&umkreis=50',
  );
  await expect(
    page.getByRole('heading', { level: 2, name: /Deine Suche auf 7 Plattformen/ }),
  ).toBeVisible();
  await expect(page.getByText('Volkswagen Golf · bis 15.000 € · 50 km um 79098')).toBeVisible();

  const autoscout = page.getByRole('link', { name: /Angebote bei AutoScout24/ });
  await expect(autoscout).toHaveAttribute('target', '_blank');
  const href = await autoscout.getAttribute('href');
  expect(href).toContain('https://www.autoscout24.de/lst/volkswagen/golf?');
  expect(href).toContain('priceto=15000');
  expect(href).toContain('zip=79098');
  await expect(page.getByRole('link', { name: /Angebote bei/ })).toHaveCount(7);

  // The form keeps the search for refining it.
  await expect(page.getByRole('search').getByLabel('Modell')).toHaveValue('Golf');
});

test('a model typed without make is recognized', async ({ page }) => {
  await page.goto('/auto-finden');
  const search = page.getByRole('search', { name: 'Gebrauchtwagen suchen' });
  await search.getByLabel('Modell').fill('Octavia Combi');
  await search.getByRole('button', { name: 'Angebote finden' }).click();
  await expect(page).toHaveURL('/auto-finden?marke=skoda&modell=skoda-octavia');
  await expect(page.getByText('Škoda Octavia', { exact: true })).toBeVisible();
});

test('the check tab is remembered and reachable with the keyboard', async ({ page }) => {
  await page.goto('/');
  const findTab = page.getByRole('tab', { name: 'Auto finden' });
  await findTab.focus();
  await page.keyboard.press('ArrowRight');
  const checkTab = page.getByRole('tab', { name: 'Inserat prüfen' });
  await expect(checkTab).toBeFocused();
  await expect(checkTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByLabel('Inseratstext oder Link zum Auto-Inserat')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Inserat prüfen' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});

test('the search page is prerendered for search engines', async ({ request }) => {
  const response = await request.get('/auto-finden');
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(html).toContain('<h1 class="page-hero__title">Gebrauchtwagen finden</h1>');
  expect(html).toContain('data-prerendered="true"');
});
