import { expect, test } from '@playwright/test';
import { expectNoHorizontalScroll } from './helpers';

test('pages fit the phone screen without horizontal scrolling', async ({ page }) => {
  for (const path of [
    '/',
    '/auto-finden?marke=vw&modell=vw-golf&preis_bis=15000&plz=79098',
    '/inserat-pruefen',
    '/inseratstext',
    '/pro',
    '/gebrauchtwagen-kaufen',
    '/meine-angebote',
  ]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoHorizontalScroll(page);
  }

  await page.goto('/inserat-pruefen');
  await page.getByRole('button', { name: 'Fiktives Beispiel ansehen' }).click();
  await expect(page).toHaveURL(/\/analyse\//);
  await expect(
    page.getByRole('heading', { level: 2, name: 'Fragen an den Verkäufer' }),
  ).toBeVisible();
  await expectNoHorizontalScroll(page);

  // Section chips jump to the section.
  await page
    .getByRole('navigation', { name: 'Abschnitte der Prüfung' })
    .getByRole('link', { name: 'Fragen' })
    .click();
  await expect(page).toHaveURL(/#fragen$/);
});

test('the mobile menu opens and navigates', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toBeHidden();
  await page.getByRole('button', { name: 'Menü öffnen' }).click();
  const menu = page.getByRole('navigation', { name: 'Menü' });
  await expect(menu).toBeVisible();
  await menu.getByRole('link', { name: 'Gebrauchtwagen kaufen' }).click();
  await expect(page).toHaveURL(/\/gebrauchtwagen-kaufen$/);
  await expect(menu).toBeHidden();
});

test('Escape closes the mobile menu and returns focus to its button', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Menü öffnen' }).click();
  const menu = page.getByRole('navigation', { name: 'Menü' });
  await expect(menu).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(page.getByRole('button', { name: 'Menü öffnen' })).toBeFocused();
});
