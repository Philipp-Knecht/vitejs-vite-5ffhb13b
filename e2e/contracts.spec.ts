import { expect, test } from '@playwright/test';

test('every page offers the cancellation and withdrawal buttons', async ({ page }) => {
  await page.goto('/gebrauchtwagen-kaufen');
  const footer = page.getByRole('contentinfo');
  await footer.getByRole('link', { name: 'Verträge hier kündigen' }).click();
  await expect(page).toHaveURL(/\/vertrag-kuendigen$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Vertrag kündigen' })).toBeVisible();

  await footer.getByRole('link', { name: 'Vertrag widerrufen' }).click();
  await expect(page).toHaveURL(/\/vertrag-widerrufen$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Vertrag widerrufen' })).toBeVisible();
});

test('a cancellation works without signing in and can be saved with date and time', async ({
  page,
}) => {
  await page.goto('/vertrag-kuendigen');
  await page.getByRole('button', { name: 'jetzt kündigen' }).click();
  await expect(page.getByText('Bitte gib deinen Namen an.')).toBeVisible();

  await page.getByRole('radio', { name: /^Außerordentliche Kündigung/ }).check();
  await page.getByRole('button', { name: 'jetzt kündigen' }).click();
  await expect(page.getByText('Bitte nenne den Grund')).toBeVisible();
  await page.getByRole('radio', { name: /^Ordentliche Kündigung/ }).check();

  await page.getByLabel('Dein Name').fill('Max Mustermann');
  await page.getByLabel('E-Mail-Adresse').fill('kuendigung@example.com');
  await page.getByRole('button', { name: 'jetzt kündigen' }).click();

  await expect(
    page.getByRole('heading', { name: 'Deine Kündigung ist eingegangen' }),
  ).toBeFocused();
  await expect(page.getByText(/abgegeben über die Schaltfläche „jetzt kündigen“/)).toBeVisible();
  await expect(page.getByText(/um \d{2}:\d{2}:\d{2} Uhr/)).toBeVisible();
  await expect(page.getByText('zum nächstmöglichen Zeitpunkt')).toBeVisible();
  await expect(page.getByText(/noch keinen laufenden Vertrag zuordnen/)).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Als Textdatei speichern' }).click();
  expect((await download).suggestedFilename()).toMatch(/^kaufcheck-kuendigung-KC-K-.+\.txt$/);
});

test('a withdrawal is confirmed with the declaration and the time of receipt', async ({ page }) => {
  await page.goto('/vertrag-widerrufen');
  await page.getByLabel('Dein Name').fill('Erika Mustermann');
  await page.getByLabel('E-Mail-Adresse').fill('widerruf@example.com');
  await page.getByLabel('Bestellnummer (falls zur Hand)').fill('KC-ABCDEFGH');
  await expect(
    page.getByText(
      '„Hiermit widerrufe ich den von mir abgeschlossenen Vertrag über die Erbringung der folgenden Dienstleistung: KaufCheck Pro (Monatsabo), Bestellnummer KC-ABCDEFGH.“',
    ),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Widerruf bestätigen' }).click();
  await expect(page.getByRole('heading', { name: 'Dein Widerruf ist eingegangen' })).toBeVisible();
  await expect(
    page.getByText(/übermittelt über die Schaltfläche „Widerruf bestätigen“/),
  ).toBeVisible();
});

test('terms and withdrawal notice are published with the official wording', async ({ page }) => {
  await page.goto('/agb');
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Allgemeine Geschäftsbedingungen für KaufCheck Pro',
    }),
  ).toBeVisible();
  await expect(page.getByText('§ 5 Laufzeit und Kündigung')).toBeVisible();

  await page.goto('/widerrufsbelehrung');
  await expect(page.getByRole('heading', { level: 1, name: 'Widerrufsbelehrung' })).toBeVisible();
  await expect(
    page.getByText('Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses.'),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Muster-Widerrufsformular' })).toBeVisible();
});

test('Pro cannot be ordered while payments are not configured', async ({ page }) => {
  await page.goto('/pro');
  await expect(page.getByRole('button', { name: 'Bald verfügbar' })).toBeDisabled();
  await page.goto('/pro/bestellen');
  await expect(page.getByRole('heading', { name: 'Melde dich zuerst an' })).toBeVisible();
});
