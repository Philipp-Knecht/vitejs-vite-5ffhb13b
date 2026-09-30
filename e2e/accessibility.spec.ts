import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { analyzeFromHomepage, LISTINGS } from './helpers';

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
    '/inseratstext',
    '/pro',
    '/gebrauchtwagen-kaufen',
    '/gebrauchtwagen-checkliste',
    '/anmelden',
    '/registrieren',
    '/meine-angebote',
    '/datenschutz',
  ]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectAccessible(page);
  }
});

test('the analysis result meets WCAG 2.1 AA checks', async ({ page }) => {
  await analyzeFromHomepage(page, LISTINGS.audi);
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Nachricht erstellen' }).click();
  await expect(page.getByRole('dialog', { name: 'Nachricht an den Verkäufer' })).toBeVisible();
  await expectAccessible(page);
});

test('the error state after a blocked listing meets WCAG 2.1 AA checks', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Link zum Auto-Inserat auf Kleinanzeigen').fill(LISTINGS.blocked);
  await page.getByRole('button', { name: 'Inserat prüfen' }).click();
  await expect(page.getByRole('button', { name: 'Inseratstext einfügen' })).toBeVisible();
  await expectAccessible(page);
});
