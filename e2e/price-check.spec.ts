import { expect, request, test } from '@playwright/test';

/** A synthetic pasted Opel Astra offer – no other spec uses this model. */
const astra = (km: number, price: number, note: string) =>
  [
    'Opel Astra 1.4 Turbo',
    `${price.toLocaleString('de-DE')} €`,
    'Details',
    'Marke',
    'Opel',
    'Modell',
    'Astra',
    'Kilometerstand',
    `${km.toLocaleString('de-DE')} km`,
    'Erstzulassung',
    'Juni 2017',
    'Kraftstoffart',
    'Benzin',
    'Beschreibung',
    `Gepflegt, Scheckheft vorhanden. ${note}`,
  ].join('\n');

test('the price check rates the price against similar offers checked before', async ({
  page,
  baseURL,
}) => {
  // Nine similar offers from 11.000 to 11.800 €, three per visitor (the limit without an account).
  for (let visitor = 0; visitor < 3; visitor += 1) {
    const api = await request.newContext({ baseURL });
    for (let offer = 0; offer < 3; offer += 1) {
      const index = visitor * 3 + offer;
      const response = await api.post('/api/listings/analyze-text', {
        data: { text: astra(90_000 + index * 2_000, 11_000 + index * 100, `Angebot ${index}`) },
      });
      expect(response.status(), await response.text()).toBe(201);
    }
    await api.dispose();
  }

  await page.goto('/inserat-pruefen');
  await page
    .getByLabel('Inseratstext oder Link zum Auto-Inserat')
    .fill(astra(98_500, 13_500, 'Zu teuer'));
  await page.getByRole('button', { name: 'Inserat prüfen' }).click();
  await expect(page).toHaveURL(/\/analyse\/[0-9a-f-]{36}$/);

  // Median 11.400 €: 13.500 € is 18,4 % above – a high price, look further.
  const check = page.getByRole('region', { name: /Teurer als üblich – weitersuchen/ });
  await expect(check).toBeVisible();
  await expect(check.getByRole('listitem').filter({ hasText: 'Hoher Preis' })).toHaveAttribute(
    'aria-current',
    'true',
  );
  await expect(check.getByText(/Zielpreis für die Verhandlung: etwa 11\.400/)).toBeVisible();
  await expect(check.getByText(/Verglichen mit 9 ähnlichen Inseraten/)).toBeVisible();

  const price = page.locator('#preis .market');
  await expect(price.getByText(/18,4\s%\süber dem Median von 9 vergleichbaren/)).toBeVisible();
  await expect(price.getByText(/keine repräsentative Marktanalyse/)).toBeVisible();
});

test('without enough similar offers, the price check links to the marketplaces', async ({
  page,
}) => {
  await page.goto('/inserat-pruefen');
  await page
    .getByLabel('Inseratstext oder Link zum Auto-Inserat')
    .fill(astra(98_500, 13_500, 'Einzelstück').replace(/Astra/g, 'Insignia'));
  await page.getByRole('button', { name: 'Inserat prüfen' }).click();
  await expect(page).toHaveURL(/\/analyse\/[0-9a-f-]{36}$/);

  const check = page.getByRole('region', { name: /Noch zu wenige Vergleichsangebote/ });
  await expect(check).toBeVisible();
  await expect(
    check.getByRole('link', { name: 'Ähnliche Angebote auf den Börsen ansehen' }),
  ).toHaveAttribute(
    'href',
    /^\/auto-finden\?marke=opel&modell=opel-insignia&.*ez_ab=2015&ez_bis=2019/,
  );
});
