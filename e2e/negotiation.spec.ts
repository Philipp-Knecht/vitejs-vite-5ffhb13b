import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { analyzeFromHomepage, LISTINGS, makePro, uniqueEmail } from './helpers';

test('the negotiation help is part of Pro, the tips are for everyone', async ({ page }) => {
  await analyzeFromHomepage(page, LISTINGS.audi);
  const section = page.getByRole('region', { name: 'Verhandlung vorbereiten' });
  await expect(section.getByRole('link', { name: 'KaufCheck Pro ansehen' })).toBeVisible();
  await expect(section).toContainText('§ 442 BGB');
  await expect(section.getByLabel('Mangel oder Auffälligkeit')).toHaveCount(0);
});

test('Pro members turn their findings into a message to the seller', async ({ page, context }) => {
  const email = uniqueEmail();
  await page.goto('/registrieren');
  await page.getByLabel('E-Mail-Adresse').fill(email);
  await page.getByLabel('Passwort').fill('ein-sicheres-passwort');
  await page.getByRole('button', { name: 'Konto erstellen' }).click();
  await expect(page).not.toHaveURL(/\/registrieren$/);
  await makePro(email);

  await analyzeFromHomepage(page, LISTINGS.audi);
  const section = page.getByRole('region', { name: 'Verhandlung vorbereiten' });
  await expect(section).toContainText('Wähle oder ergänze mindestens einen Punkt');

  await section
    .getByLabel('Mangel oder Auffälligkeit')
    .fill('Bremsen quietschen bei der Probefahrt');
  await section.getByRole('button', { name: 'Hinzufügen' }).click();
  await expect(section.getByLabel('Mangel oder Auffälligkeit')).toHaveValue('');
  const message = section.locator('.negotiation__message');
  await expect(message).toContainText('1. Bremsen quietschen bei der Probefahrt');
  await expect(message).toContainText('Wie kommen Sie mir beim Preis entgegen?');

  // Points from the listing are only suggestions to pick.
  await section
    .getByRole('checkbox', { name: /^Wie im Inserat beschrieben/ })
    .first()
    .check();
  await expect(message).toContainText('1. Wie im Inserat beschrieben: „');

  // An offer that is not below the asking price gets a hint.
  await section.getByLabel('Dein Angebot in € (optional)').fill('1.000.000');
  await expect(section).toContainText('Dein Angebot liegt nicht unter dem Preis im Inserat');

  // The buyer's own offer – KaufCheck never suggests one.
  await section.getByLabel('Dein Angebot in € (optional)').fill('12,5');
  await expect(section.getByText('Bitte gib einen Betrag in vollen Euro ein.')).toBeVisible();
  await section.getByLabel('Dein Angebot in € (optional)').fill('12.500');
  await expect(message).toContainText(/Deshalb kann ich Ihnen 12\.500\s€ anbieten\./);
  const axe = await new AxeBuilder({ page })
    .include('#verhandlung')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(axe.violations.map((violation) => violation.id)).toEqual([]);

  // The form of address is shared with the seller questions.
  await section.getByRole('button', { name: 'du', exact: true }).click();
  await expect(message).toContainText(/Deshalb kann ich dir 12\.500\s€ anbieten\./);
  await expect(page.locator('.question-list')).not.toContainText('Können Sie');

  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await section.getByRole('button', { name: 'Nachricht kopieren' }).click();
  await expect(page.getByText('Nachricht kopiert')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(
    /^Hallo,\n\nvielen Dank, dass ich dein Auto/,
  );

  // Stored in this browser only; removable.
  await page.reload();
  await expect(section.locator('.negotiation__message')).toContainText('2. Bremsen quietschen');
  await section
    .getByRole('button', { name: '„Bremsen quietschen bei der Probefahrt“ entfernen' })
    .click();
  await expect(section.locator('.negotiation__message')).not.toContainText('Bremsen quietschen');
  await expect(
    section.getByRole('heading', { name: 'Deine Funde bei der Besichtigung' }),
  ).toBeFocused();
  await section
    .getByRole('checkbox', { name: /^Wie im Inserat beschrieben/ })
    .first()
    .uncheck();
  await expect(section).toContainText('Wähle oder ergänze mindestens einen Punkt');
});
