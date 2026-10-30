import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { ADVISOR_AVAILABLE, analyzeFromHomepage, LISTINGS, MODEL_IDS } from './helpers';

/** WCAG 2.1 A/AA checks with axe-core. */
async function expectAccessible(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const violations = results.violations.map(
    (violation) =>
      `${violation.id} (${violation.impact ?? 'n/a'}): ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`,
  );
  expect(violations, violations.join('\n')).toEqual([]);
}

test('static pages meet WCAG 2.1 AA checks', async ({ page }) => {
  for (const path of [
    '/',
    '/auto-finden',
    '/auto-finden?marke=vw&modell=vw-golf&preis_bis=15000&ez_ab=2016&plz=79098',
    '/inserat-pruefen',
    '/inseratstext',
    '/pro',
    '/haeufige-fragen',
    '/anmelden',
    '/registrieren',
    '/meine-angebote',
    '/pro/bestellen',
  ]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectAccessible(page);
  }
});

test('the guide and legal pages meet WCAG 2.1 AA checks', async ({ page }) => {
  for (const path of [
    '/gebrauchtwagen-kaufen',
    '/gebrauchtwagen-checkliste',
    '/auto-ummelden',
    '/auto-rueckruf-pruefen',
    '/auto-aus-den-niederlanden',
    '/autokosten-im-monat',
    '/datenschutz',
    '/agb',
    '/widerrufsbelehrung',
    '/vertrag-kuendigen',
    '/vertrag-widerrufen',
  ]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectAccessible(page);
  }
});

test('the advisor and model pages meet WCAG 2.1 AA checks', async ({ page }) => {
  const [model] = MODEL_IDS;
  for (const path of ['/auto-berater', '/modelle', ...(model ? [`/modelle/${model}`] : [])]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectAccessible(page);
  }
  if (ADVISOR_AVAILABLE) {
    await page.goto('/auto-berater?budget=20000&nutzung=familie&personen=4');
    await expect(
      page.getByRole('heading', { level: 2, name: 'Diese Modelle passen zu dir' }),
    ).toBeVisible();
    await expectAccessible(page);
  }
});

test('the assistant on the start page meets WCAG 2.1 AA checks with a form', async ({ page }) => {
  await page.goto('/');
  const chat = page.getByRole('region', { name: 'KI-Assistent von KaufCheck' });
  await chat.getByRole('button', { name: 'Finanzierung rechnen' }).click();
  await expect(chat.getByRole('form', { name: 'Finanzierung rechnen' })).toBeVisible();
  await expectAccessible(page);
  // The menu with a chat in it.
  await chat.getByLabel('Nachricht an den KI-Assistenten von KaufCheck').fill('Hallo');
  await chat.getByLabel('Nachricht an den KI-Assistenten von KaufCheck').press('Enter');
  await expect(page.getByRole('button', { name: 'Neuer Chat' })).toBeVisible();
  await page.getByRole('button', { name: 'Menü öffnen' }).click();
  await expect(page.getByRole('dialog', { name: /Menü/ }).locator('.drawer__chat')).toHaveCount(1);
  await expectAccessible(page);
});

test('the analysis result meets WCAG 2.1 AA checks', async ({ page }) => {
  await analyzeFromHomepage(page, LISTINGS.audi);
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Nachricht erstellen' }).click();
  await expect(page.getByRole('dialog', { name: 'Nachricht an den Verkäufer' })).toBeVisible();
  await expectAccessible(page);
});

test('the error state after a blocked listing meets WCAG 2.1 AA checks', async ({ page }) => {
  await page.goto('/inserat-pruefen');
  await page.getByLabel('Inseratstext oder Link zum Auto-Inserat').fill(LISTINGS.blocked);
  await page.getByRole('button', { name: 'Inserat prüfen' }).click();
  await expect(page.getByRole('button', { name: 'Inseratstext einfügen' })).toBeVisible();
  await expectAccessible(page);
});
