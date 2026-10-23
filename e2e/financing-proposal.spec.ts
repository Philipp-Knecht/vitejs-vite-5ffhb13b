import { expect, test } from '@playwright/test';
import { PASTED_LISTING } from './helpers';

test('the check works out a loan for the asking price, with the Bundesbank average', async ({
  page,
}) => {
  // 8.450 € VB.
  await page.goto('/inserat-pruefen');
  await page.getByLabel('Inseratstext oder Link zum Auto-Inserat').fill(PASTED_LISTING);
  await page.getByRole('button', { name: 'Inserat prüfen' }).click();
  await expect(page).toHaveURL(/\/analyse\//);

  const proposal = page.locator('.financing-proposal');
  await expect(
    proposal.getByRole('heading', { level: 3, name: 'Finanzierung: ein Rechenbeispiel' }),
  ).toBeVisible();
  await expect(proposal.getByRole('heading', { level: 4, name: 'Monatsrate' })).toBeVisible();
  await expect(proposal.getByLabel('Laufzeit')).toHaveValue('48');
  await expect(proposal.getByLabel('Effektiver Jahreszins in %')).toHaveValue(/^\d+,\d{2}$/);
  await expect(proposal.getByText(/Gerechnet mit dem Durchschnitt/)).toBeVisible();
  await expect(proposal.getByText(/Verhandlungsbasis/).first()).toBeVisible();
  await expect(proposal.getByRole('link', { name: 'Deutscher Bundesbank' })).toHaveAttribute(
    'href',
    /^https:\/\/www\.bundesbank\.de\//,
  );

  // 6.450 € over 36 months at 6 % effective: 195,76 € a month.
  await proposal.getByLabel('Anzahlung in €').fill('2.000');
  await proposal.getByLabel('Laufzeit').selectOption('36');
  await proposal.getByLabel('Effektiver Jahreszins in %').fill('6');
  const rate = proposal.locator('.tax-result__amount');
  await expect(rate).toContainText(/^Monatsrate: 195,76\s€ im Monat$/);
  await expect(proposal.getByText(/^6\.450\s€$/)).toBeVisible();
  await expect(proposal.getByText(/Zum Vergleich: der Durchschnitt/)).toBeVisible();

  // Cents in the down payment stay cents.
  await proposal.getByLabel('Anzahlung in €').fill('2000,50');
  await expect(rate).toContainText(/^Monatsrate: 195,74\s€ im Monat$/);
  await expect(proposal.getByText(/^6\.449,50\s€$/)).toBeVisible();

  // Mistakes are marked at the field.
  await proposal.getByLabel('Anzahlung in €').fill('zweitausend');
  await expect(proposal.getByText('Bitte gib nur eine Zahl ein.')).toBeVisible();
  await expect(proposal.getByText('Bitte prüfe die markierten Angaben.')).toBeVisible();
  await proposal.getByLabel('Anzahlung in €').fill('8450');
  await expect(
    proposal.getByText('Die Anzahlung deckt den ganzen Preis, dafür brauchst du keinen Kredit.'),
  ).toBeVisible();
  await proposal.getByLabel('Anzahlung in €').fill('');
  await proposal.getByLabel('Effektiver Jahreszins in %').fill('');
  await expect(proposal.getByText('Für die Rate fehlt noch der Zins.')).toBeVisible();
});

test('a car given away gets no loan example', async ({ page }) => {
  await page.goto('/inserat-pruefen');
  await page
    .getByLabel('Inseratstext oder Link zum Auto-Inserat')
    .fill(PASTED_LISTING.replace('8.450 € VB', 'Zu verschenken'));
  await page.getByRole('button', { name: 'Inserat prüfen' }).click();
  await expect(page).toHaveURL(/\/analyse\//);
  await expect(page.getByRole('heading', { level: 2, name: 'Preis einordnen' })).toBeVisible();
  await expect(page.locator('.financing-proposal')).toHaveCount(0);
});
