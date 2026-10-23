import { expect, test } from '@playwright/test';
import { analyzeFromHomepage, LISTINGS } from './helpers';

test('the check suggests a loan for the asking price with the Bundesbank average', async ({
  page,
}) => {
  await page.goto('/');
  await analyzeFromHomepage(page, LISTINGS.audi);

  const proposal = page.locator('.financing-proposal');
  await expect(
    proposal.getByRole('heading', { name: 'Finanzierung: ein Rechenbeispiel' }),
  ).toBeVisible();
  await expect(proposal.getByLabel('Laufzeit')).toHaveValue('48');
  await expect(proposal.getByLabel('Effektiver Jahreszins in %')).toHaveValue(/^\d+,\d{2}$/);
  const rate = proposal.locator('.tax-result__amount');
  await expect(rate).toContainText(/€ im Monat/);
  await expect(proposal.getByText(/Gerechnet mit dem Durchschnitt/)).toBeVisible();
  await expect(proposal.getByRole('link', { name: 'Deutscher Bundesbank' })).toHaveAttribute(
    'href',
    /bundesbank\.de/,
  );

  // A down payment and a shorter term change the rate.
  const before = await rate.textContent();
  await proposal.getByLabel('Anzahlung in €').fill('2000');
  await proposal.getByLabel('Laufzeit').selectOption('24');
  await expect(rate).not.toHaveText(before ?? '');

  // An own rate replaces the average, which stays for comparison.
  await proposal.getByLabel('Effektiver Jahreszins in %').fill('3,9');
  await expect(proposal.getByText(/Zum Vergleich: der Durchschnitt/)).toBeVisible();
  await proposal.getByLabel('Effektiver Jahreszins in %').fill('');
  await expect(proposal.getByText('Für die Rate fehlt noch der Zins.')).toBeVisible();

  // Paid in full: no loan.
  await proposal.getByLabel('Anzahlung in €').fill('10000000');
  await expect(proposal.getByText('Mit dieser Anzahlung brauchst du keinen Kredit.')).toBeVisible();
});
