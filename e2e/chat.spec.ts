import { expect, test } from '@playwright/test';
import { expectNoHorizontalScroll, PASTED_LISTING } from './helpers';

/** The scripted development model answers (AI_PROVIDER=mock): fixed rules, no KI. */
test('the assistant computes a financing from its form and keeps the conversation in the tab', async ({
  page,
}) => {
  await page.goto('/');
  const chat = page.getByRole('region', { name: 'KaufCheck-Assistent' });
  await expect(chat.getByText('Was kann ich für dich tun?')).toBeVisible();
  await expect(chat.getByText('Entwicklungsmodus: feste Regeln statt KI.')).toBeVisible();

  await chat.getByRole('button', { name: 'Finanzierung rechnen' }).click();
  const form = chat.getByRole('form', { name: 'Finanzierung rechnen' });
  await form.getByLabel('Kaufpreis in €').fill('12000');
  await form.getByLabel('Anzahlung in €').fill('2000');
  await form.getByRole('button', { name: 'Absenden' }).click();

  await expect(
    chat.getByText(
      'Finanzierung berechnen: Kaufpreis 12.000 €, Anzahlung 2.000 €, Laufzeit 48 Monate',
    ),
  ).toBeVisible();
  const card = chat.locator('.chat-card').filter({ hasText: 'Finanzierung' });
  await expect(card.getByText(/im Monat$/)).toBeVisible();
  await expect(card.getByText('10.000 €')).toBeVisible();
  await expect(card.getByText(/Durchschnittszins der Bundesbank/)).toBeVisible();
  await expect(chat.getByText(/Heute noch 14 von 15 Nachrichten/)).toBeVisible();

  // The conversation survives a reload in this tab and goes with „Neues Gespräch“.
  await page.reload();
  await expect(chat.locator('.chat-card').filter({ hasText: 'Finanzierung' })).toBeVisible();
  await chat.getByRole('button', { name: 'Neues Gespräch' }).click();
  await expect(chat.getByText('Was kann ich für dich tun?')).toBeVisible();
});

test('the assistant checks a pasted listing and links to the full check', async ({ page }) => {
  await page.goto('/');
  const chat = page.getByRole('region', { name: 'KaufCheck-Assistent' });
  await chat.getByLabel('Nachricht an den KaufCheck-Assistenten').fill(PASTED_LISTING);
  await chat.getByLabel('Nachricht an den KaufCheck-Assistenten').press('Enter');

  const card = chat.locator('.chat-card--analysis');
  await expect(card.getByRole('heading', { name: 'VW Golf 1.4 TSI Highline' })).toBeVisible();
  await expect(card.getByText('8.450 € VB')).toBeVisible();
  // A pasted listing and its card fit a phone screen.
  await page.setViewportSize({ width: 360, height: 780 });
  await expectNoHorizontalScroll(page);
  await card.getByRole('link', { name: 'Ganze Prüfung öffnen' }).click();
  await expect(page).toHaveURL(/\/analyse\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('VW Golf');
});

test('the assistant knows the researched models and builds marketplace searches', async ({
  page,
}) => {
  await page.goto('/');
  const chat = page.getByRole('region', { name: 'KaufCheck-Assistent' });
  const input = chat.getByLabel('Nachricht an den KaufCheck-Assistenten');
  await input.fill('Welche Schwachstellen hat der Golf?');
  await input.press('Enter');
  const model = chat.locator('.chat-card').filter({ hasText: 'Modellwissen' });
  await expect(
    model.getByRole('link', { name: 'Alle Schwachstellen mit Quellen' }),
  ).toHaveAttribute('href', '/modelle/vw-golf');

  await input.fill('Such mir einen Golf');
  await input.press('Enter');
  const search = chat.locator('.chat-card').filter({ hasText: 'Suche' });
  await expect(search.getByRole('link', { name: /mobile\.de/ })).toHaveAttribute(
    'href',
    /^https:\/\/suchen\.mobile\.de\//,
  );
  await expect(search.getByRole('link', { name: 'Suche bei KaufCheck anpassen' })).toHaveAttribute(
    'href',
    /^\/auto-finden\?marke=vw&modell=vw-golf/,
  );
});
