import { expect, test } from '@playwright/test';
import { expectNoHorizontalScroll, PASTED_LISTING } from './helpers';

/** The scripted development model answers (AI_PROVIDER=mock): fixed rules, no KI. */
test('the assistant computes a financing from its form and keeps the conversation on reload', async ({
  page,
}) => {
  await page.goto('/');
  const chat = page.getByRole('region', { name: 'KI-Assistent von KaufCheck' });
  await expect(
    chat.getByText('Willkommen bei KaufCheck, deinem KI-Assistenten für den Gebrauchtwagenkauf!'),
  ).toBeVisible();
  await expect(chat.getByText('Entwicklungsmodus: feste Regeln statt KI.')).toBeVisible();
  const input = chat.getByLabel('Nachricht an den KI-Assistenten von KaufCheck');

  // The form opens with the focus in its first field and gives it back to the input.
  await chat.getByRole('button', { name: 'Finanzierung rechnen' }).click();
  const form = chat.getByRole('form', { name: 'Finanzierung rechnen' });
  await expect(form.getByLabel('Kaufpreis in €')).toBeFocused();
  await form.getByLabel('Kaufpreis in €').fill('12000');
  await form.getByLabel('Anzahlung in €').fill('2000');
  await form.getByRole('button', { name: 'Absenden' }).click();
  await expect(input).toBeFocused();

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
  // Screen readers get the finished answer once, with what the cards show.
  await expect(chat.getByRole('status')).toContainText('Darunter: Finanzierung');
  // Not happy with the answer? The calculator is one tap away.
  await expect(
    chat.getByRole('link', { name: 'Im Finanzierungsrechner selbst rechnen' }),
  ).toHaveAttribute('href', '/kfz-steuer-rechner#finanzierung');

  // The conversation survives a reload in this tab; „Neuer Chat“ starts another one.
  await page.reload();
  await expect(chat.locator('.chat-card').filter({ hasText: 'Finanzierung' })).toBeVisible();
  await page.getByRole('button', { name: 'Neuer Chat' }).click();
  await expect(
    chat.getByText('Willkommen bei KaufCheck, deinem KI-Assistenten für den Gebrauchtwagenkauf!'),
  ).toBeVisible();
  await expect(input).toBeFocused();

  // Too long for one message: said, not cut off.
  await input.fill('x'.repeat(20_001));
  await expect(chat.getByText(/Der Text ist zu lang: höchstens 20\.000 Zeichen/)).toBeVisible();
  await expect(chat.getByRole('button', { name: 'Senden' })).toBeDisabled();
});

test('the start page is prerendered with the empty chat, so nothing jumps', async ({ request }) => {
  const html = await (await request.get('/')).text();
  expect(html).toContain('data-prerendered="true"');
  expect(html).toContain(
    'Willkommen bei KaufCheck, deinem KI-Assistenten für den Gebrauchtwagenkauf!',
  );
});

test('the assistant checks a pasted listing and links to the full check', async ({ page }) => {
  await page.goto('/');
  const chat = page.getByRole('region', { name: 'KI-Assistent von KaufCheck' });
  await chat.getByLabel('Nachricht an den KI-Assistenten von KaufCheck').fill(PASTED_LISTING);
  await chat.getByLabel('Nachricht an den KI-Assistenten von KaufCheck').press('Enter');

  const card = chat.locator('.chat-card--analysis');
  await expect(card.getByRole('heading', { name: 'VW Golf 1.4 TSI Highline' })).toBeVisible();
  await expect(card.getByText('8.450 € VB')).toBeVisible();
  // A pasted listing and its card fit a phone screen.
  await page.setViewportSize({ width: 360, height: 780 });
  await expectNoHorizontalScroll(page);
  await chat.getByRole('link', { name: 'Ganze Prüfung öffnen' }).click();
  await expect(page).toHaveURL(/\/analyse\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('VW Golf');
});

test('the assistant knows the researched models and builds marketplace searches', async ({
  page,
}) => {
  await page.goto('/');
  const chat = page.getByRole('region', { name: 'KI-Assistent von KaufCheck' });
  const input = chat.getByLabel('Nachricht an den KI-Assistenten von KaufCheck');
  await input.fill('Welche Schwachstellen hat der Golf?');
  await input.press('Enter');
  await expect(chat.locator('.chat-card').filter({ hasText: 'Modellwissen' })).toBeVisible();
  await expect(chat.getByRole('link', { name: 'Alle Schwachstellen mit Quellen' })).toHaveAttribute(
    'href',
    '/modelle/vw-golf',
  );

  await input.fill('Such mir einen Golf');
  await input.press('Enter');
  const search = chat.locator('.chat-card').filter({ hasText: 'Suche' });
  await expect(search.getByRole('link', { name: /mobile\.de/ })).toHaveAttribute(
    'href',
    /^https:\/\/suchen\.mobile\.de\//,
  );
  await expect(chat.getByRole('link', { name: 'Suche bei KaufCheck anpassen' })).toHaveAttribute(
    'href',
    /^\/auto-finden\?marke=vw&modell=vw-golf/,
  );
});

test('the start page is the assistant: a listing goes straight into the chat', async ({ page }) => {
  await page.goto('/');
  // Like a chat app: the assistant fills the screen, the page itself does not scroll.
  await expect(page.getByRole('tab')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 2, name: 'Häufige Fragen' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Upgraden' })).toHaveAttribute('href', '/pro');
  const { scrollHeight, innerHeight } = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    innerHeight: window.innerHeight,
  }));
  expect(scrollHeight).toBeLessThanOrEqual(innerHeight);
  // The required links and the contract buttons stay on the page (§§ 312k, 356a BGB).
  const legal = page.getByRole('navigation', { name: 'Rechtliches' });
  for (const name of ['Impressum', 'Datenschutz', 'Verträge hier kündigen', 'Vertrag widerrufen'])
    await expect(legal.getByRole('link', { name })).toBeVisible();
  const chat = page.getByRole('region', { name: 'KI-Assistent von KaufCheck' });
  // Three and a half suggestions show; the list scrolls in itself to the others.
  const starters = chat.getByRole('list', { name: 'Was möchtest du machen?' });
  await expect(starters.getByRole('listitem')).toHaveCount(10);
  const box = await starters.evaluate((element) => ({
    visible: element.clientHeight,
    content: element.scrollHeight,
    item: element.querySelector('li')?.getBoundingClientRect().height ?? 0,
  }));
  expect(box.content).toBeGreaterThan(box.visible);
  expect(box.visible / box.item).toBeGreaterThan(3.4);
  expect(box.visible / box.item).toBeLessThan(4.1);
  await starters
    .getByRole('button', { name: 'Auto ummelden: Was brauche ich?' })
    .scrollIntoViewIfNeeded();
  await expect(starters.getByRole('button', { name: 'Inserat prüfen' })).not.toBeInViewport();
  await starters.getByRole('button', { name: 'Inserat prüfen' }).scrollIntoViewIfNeeded();
  await chat.getByRole('button', { name: 'Inserat prüfen' }).click();
  await expect(
    chat
      .getByRole('region', { name: 'Gesprächsverlauf' })
      .getByText(/füg ihn unten ins Eingabefeld ein/),
  ).toBeVisible();
  // Screen readers hear the hint too.
  await expect(chat.getByRole('status')).toContainText('füg ihn unten ins Eingabefeld ein');
  await expect(chat.getByLabel('Nachricht an den KI-Assistenten von KaufCheck')).toBeFocused();
  await expect(chat.getByRole('form')).toHaveCount(0);
});

test('past chats stay on this device and open from the menu', async ({ page }) => {
  await page.goto('/');
  const chat = page.getByRole('region', { name: 'KI-Assistent von KaufCheck' });
  const input = chat.getByLabel('Nachricht an den KI-Assistenten von KaufCheck');
  await input.fill('Welche Schwachstellen hat der Golf?');
  await input.press('Enter');
  await expect(chat.locator('.chat-card').filter({ hasText: 'Modellwissen' })).toBeVisible();

  await page.getByRole('button', { name: 'Neuer Chat' }).click();
  await input.fill('Such mir einen Golf');
  await input.press('Enter');
  await expect(chat.locator('.chat-card').filter({ hasText: 'Suche' })).toBeVisible();

  // A new tab starts a new chat; the menu lists both, the newest first.
  const other = await page.context().newPage();
  await other.goto('/');
  const otherChat = other.getByRole('region', { name: 'KI-Assistent von KaufCheck' });
  await expect(otherChat.getByText('Was möchtest du machen?')).toBeVisible();
  await other.getByRole('button', { name: 'Menü öffnen' }).click();
  const menu = other.getByRole('dialog', { name: /Menü/ });
  const chats = menu.getByRole('region', { name: 'Chats' });
  await expect(chats.getByRole('button', { name: /^(Such mir|Welche Schwach)/ })).toHaveText([
    'Such mir einen Golf',
    'Welche Schwachstellen hat der Golf?',
  ]);
  await chats
    .getByRole('button', { name: 'Welche Schwachstellen hat der Golf?', exact: true })
    .click();
  await expect(menu).toBeHidden();
  await expect(otherChat.locator('.chat-card').filter({ hasText: 'Modellwissen' })).toBeVisible();
  // Opened again, it is not read out again.
  await expect(otherChat.getByRole('status')).toHaveText('');

  // Deleted in one tab, gone in the other.
  await other.getByRole('button', { name: 'Menü öffnen' }).click();
  await chats
    .getByRole('button', { name: 'Chat „Welche Schwachstellen hat der Golf?“ löschen' })
    .click();
  await expect(
    chats.getByRole('button', { name: 'Welche Schwachstellen hat der Golf?' }),
  ).toHaveCount(0);
  await other.keyboard.press('Escape');
  await expect(otherChat.getByText('Was möchtest du machen?')).toBeVisible();
  await page.getByRole('button', { name: 'Menü öffnen' }).click();
  const firstMenu = page.getByRole('dialog', { name: /Menü/ });
  await expect(firstMenu.locator('.drawer__chat')).toHaveText(['Such mir einen Golf']);

  // „Alle Chats löschen“ asks first.
  await firstMenu.getByRole('button', { name: 'Alle Chats löschen' }).click();
  await firstMenu.getByRole('button', { name: 'Ja, löschen' }).click();
  await expect(firstMenu.getByText(/Noch keine Chats/)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(chat.getByText('Was möchtest du machen?')).toBeVisible();
  expect(await page.evaluate(() => window.localStorage.getItem('kaufcheck:chats'))).toBeNull();
});

test('the frequent questions have their own page', async ({ page }) => {
  await page.goto('/haeufige-fragen');
  await expect(page.getByRole('heading', { level: 1, name: 'Häufige Fragen' })).toBeVisible();
  await page.getByText('Was passiert mit meinen Daten?').click();
  await expect(
    page.getByText(/deine Chats speichert nur dein Browser auf diesem Gerät/),
  ).toBeVisible();
});
