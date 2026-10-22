import { expect, test } from '@playwright/test';
import { PASTED_LISTING } from './helpers';

test('warning signs for scams are named with advice, not as an accusation', async ({ page }) => {
  const listing = PASTED_LISTING.replace(
    'Probefahrt nach Absprache.',
    'Ich bin beruflich in Spanien, das Auto wird Ihnen per Spedition geliefert. Bezahlung per Vorkasse über einen Treuhandservice.',
  );
  await page.goto('/inserat-pruefen');
  await page.getByLabel('Inseratstext oder Link zum Auto-Inserat').fill(listing);
  await page.getByRole('button', { name: 'Inserat prüfen' }).click();
  await expect(page).toHaveURL(/\/analyse\/[0-9a-f-]{36}$/);

  const section = page.locator('#darauf-achten');
  for (const title of [
    'Zahlung vor der Übergabe im Inserat',
    'Treuhanddienst im Inserat',
    'Verkäufer nach eigener Angabe im Ausland',
    'Lieferung über eine Spedition im Inserat',
  ])
    await expect(section.getByRole('heading', { name: title })).toBeVisible();
  await expect(
    section.getByRole('heading', { name: 'Bei Verdacht: Angebot melden' }),
  ).toBeVisible();
  await expect(
    section.getByRole('link', { name: /Polizei: Was tun bei einem verdächtigen Inserat\?/ }),
  ).toHaveAttribute('href', /polizei-beratung\.de/);
  await expect(section.getByRole('link', { name: 'Betrugsmaschen erkennen' })).toHaveAttribute(
    'href',
    '/gebrauchtwagen-kaufen#betrug',
  );
  await expect(
    page.getByText(/Kann ich das Fahrzeug vor dem Kauf vor Ort ansehen und bei der Übergabe/),
  ).toBeVisible();
});
