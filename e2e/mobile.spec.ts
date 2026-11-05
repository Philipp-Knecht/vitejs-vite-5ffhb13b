import { expect, test } from '@playwright/test';
import { ADVISOR_AVAILABLE, expectNoHorizontalScroll, MODEL_IDS } from './helpers';

test('pages fit the phone screen without horizontal scrolling', async ({ page }) => {
  for (const path of [
    '/',
    '/auto-finden?marke=vw&modell=vw-golf&preis_bis=15000&plz=79098',
    '/inserat-pruefen',
    '/inseratstext',
    '/pro',
    '/gebrauchtwagen-kaufen',
    '/meine-angebote',
    '/auto-berater',
    '/modelle',
    ...MODEL_IDS.slice(0, 1).map((id) => `/modelle/${id}`),
    ...(ADVISOR_AVAILABLE ? ['/auto-berater?budget=20000&nutzung=familie&personen=4'] : []),
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

test('every page has the bar and menu of the start page, and the menu navigates', async ({
  page,
}) => {
  await page.goto('/auto-finden');
  await page.getByRole('button', { name: 'Menü öffnen' }).click();
  const menu = page.getByRole('dialog', { name: /Menü/ });
  await expect(menu).toBeVisible();
  await menu.getByText('Ratgeber').click();
  await menu.getByRole('link', { name: 'Gebrauchtwagen kaufen' }).click();
  await expect(page).toHaveURL(/\/gebrauchtwagen-kaufen$/);
  await expect(menu).toBeHidden();
  // The bar stays at the top while the page scrolls.
  await page.mouse.wheel(0, 1500);
  await expect(page.getByRole('button', { name: 'Menü öffnen' })).toBeInViewport();
});

test('a swipe right opens the menu, a swipe left closes it', async ({ page }) => {
  await page.goto('/');
  const menu = page.getByRole('dialog', { name: /Menü/ });
  await expect(page.getByRole('button', { name: 'Menü öffnen' })).toBeVisible();
  const cdp = await page.context().newCDPSession(page);
  const touch = (
    type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel',
    points: { x: number; y: number }[],
  ) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  /** Puts a finger down at `from` and moves it to `to`, without letting go. */
  const pull = async (from: number, to: number, y: number) => {
    await touch('touchStart', [{ x: from, y }]);
    for (let step = 1; step <= 10; step += 1)
      await touch('touchMove', [{ x: from + ((to - from) * step) / 10, y }]);
  };
  const swipe = async (from: number, to: number, y = 300) => {
    await pull(from, to, y);
    await touch('touchEnd', []);
  };
  const dialogState = () =>
    page.evaluate(() => {
      const dialog = document.querySelector<HTMLDialogElement>('dialog.drawer');
      return {
        visible: dialog ? getComputedStyle(dialog).display !== 'none' : false,
        modal: dialog?.matches(':modal') ?? false,
        x: dialog?.getBoundingClientRect().x ?? 0,
        focus: document.activeElement?.tagName ?? '',
      };
    });

  // While pulled, the menu follows the finger, seen but not yet a dialog over the page: the
  // focus (and the keyboard) stay in the input. A short pull slides back.
  await page.getByLabel('Nachricht an den KI-Assistenten von KaufCheck').focus();
  await pull(60, 100, 300);
  await expect.poll(dialogState).toMatchObject({ visible: true, modal: false, focus: 'TEXTAREA' });
  expect((await dialogState()).x).toBeLessThan(0);
  await touch('touchEnd', []);
  await expect(menu).toBeHidden();
  expect((await dialogState()).focus).toBe('TEXTAREA');
  // A second finger, or the system taking the touch over, lets it slide back, too.
  await pull(60, 250, 300);
  await touch('touchStart', [
    { x: 250, y: 300 },
    { x: 200, y: 500 },
  ]);
  await touch('touchEnd', []);
  await expect(menu).toBeHidden();
  await pull(60, 250, 300);
  await touch('touchCancel', []);
  await expect(menu).toBeHidden();

  await swipe(60, 320);
  await expect(menu).toBeVisible();
  await expect.poll(async () => (await menu.boundingBox())?.x).toBe(0);
  // Let go, it is a dialog over the page like after a tap on the button.
  expect((await dialogState()).modal).toBe(true);
  await expect(page.getByRole('button', { name: 'Menü öffnen' })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  await swipe(300, 40);
  await expect(menu).toBeHidden();
  // The button opens it as before, also after a swipe.
  await page.getByRole('button', { name: 'Menü öffnen' }).click();
  await expect.poll(async () => (await menu.boundingBox())?.x).toBe(0);
  await page.keyboard.press('Escape');

  // On another page, too, but not from a form field: there the finger chooses a value.
  await page.goto('/auto-finden');
  await expect(page.getByRole('button', { name: 'Menü öffnen' })).toBeVisible();
  const field = await page.getByLabel('Marke').boundingBox();
  await swipe((field?.x ?? 0) + 10, 320, (field?.y ?? 0) + 10);
  await expect(menu).toBeHidden();
  await swipe(60, 320, 250);
  await expect(menu).toBeVisible();
});

test('Escape closes the menu and returns focus to its button', async ({ page }) => {
  await page.goto('/auto-finden');
  await page.getByRole('button', { name: 'Menü öffnen' }).click();
  const menu = page.getByRole('dialog', { name: /Menü/ });
  await expect(menu).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(page.getByRole('button', { name: 'Menü öffnen' })).toBeFocused();
});

test('the start page menu opens from the left with the functions and the chats', async ({
  page,
}) => {
  await page.goto('/');
  // The page itself does not scroll or bounce, and its edges are as white as the page.
  expect(
    await page.evaluate(() => {
      const root = document.documentElement;
      return {
        fits: root.scrollHeight <= window.innerHeight,
        overscroll: getComputedStyle(root).overscrollBehaviorY,
        edge: getComputedStyle(root).backgroundColor,
      };
    }),
  ).toEqual({ fits: true, overscroll: 'none', edge: 'rgb(255, 255, 255)' });
  const button = page.getByRole('button', { name: 'Menü öffnen' });
  await button.click();
  const menu = page.getByRole('dialog', { name: /Menü/ });
  await expect(menu).toBeVisible();
  // It slides in from the left edge, from the top: white under the status bar, too.
  await expect.poll(async () => (await menu.boundingBox())?.x).toBe(0);
  expect((await menu.boundingBox())?.y).toBe(0);
  expect(
    await menu.evaluate((dialog) => getComputedStyle(dialog, '::backdrop').backgroundImage),
  ).toContain('rgb(255, 255, 255)');
  await expect(menu.getByRole('heading', { name: 'Chats' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(button).toBeFocused();

  await button.click();
  await menu.getByText('Ratgeber').click();
  await menu.getByRole('link', { name: 'Auto ummelden' }).click();
  await expect(page).toHaveURL(/\/auto-ummelden$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Auto ummelden');
});
