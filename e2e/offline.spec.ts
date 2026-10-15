import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { analyzeFromHomepage, LISTINGS, uniqueEmail } from './helpers';

test('the app is installable', async ({ request }) => {
  const manifest = await request.get('/manifest.webmanifest');
  expect(manifest.ok()).toBe(true);
  const data = (await manifest.json()) as { start_url: string; display: string; icons: unknown[] };
  expect(data).toMatchObject({ start_url: '/', display: 'standalone' });
  expect(data.icons).toHaveLength(3);
  for (const path of ['/icons/icon-192.png', '/icons/icon-512.png', '/icons/maskable-512.png']) {
    expect((await request.get(path)).ok(), path).toBe(true);
  }
  expect((await request.get('/sw.js')).headers()['cache-control']).toBe('no-cache');
  expect(await (await request.get('/')).text()).toContain(
    '<link rel="manifest" href="/manifest.webmanifest" />',
  );
});

test('nothing is stored for offline use unless the user asks', async ({ page }) => {
  await analyzeFromHomepage(page, LISTINGS.audi);
  await expect(page.getByRole('button', { name: 'Offline verfügbar machen' })).toBeVisible();
  expect(await page.evaluate(() => caches.keys())).toEqual([]);
  expect(await page.evaluate(() => navigator.serviceWorker.getRegistration())).toBeUndefined();
});

/** The request id the server gave a stored response – a fresh response has a new one. */
function storedRequestId(page: Page, key: string): Promise<string | null> {
  return page.evaluate(async (path) => {
    for (const name of await caches.keys()) {
      const response = await (await caches.open(name)).match(path);
      if (response) return response.headers.get('x-request-id');
    }
    return null;
  }, key);
}

async function goOffline(context: BrowserContext) {
  // No network at all – also not for the service worker (see playwright.config.ts).
  await context.route('**/*', (route) => route.abort('internetdisconnected'));
  await context.setOffline(true);
}

async function goOnline(context: BrowserContext) {
  await context.unrouteAll();
  await context.setOffline(false);
}

async function saveOffline(page: Page) {
  await page.getByRole('button', { name: 'Offline verfügbar machen' }).click();
  await expect(
    page.getByText('öffnet sich in diesem Browser jetzt auch ohne Empfang'),
  ).toBeVisible();
}

test('a saved check opens without reception', async ({ page, context }) => {
  await analyzeFromHomepage(page, LISTINGS.audi);
  const url = page.url();
  const analysisPath = new URL(url).pathname.replace('/analyse/', '/api/analyses/');
  await page.getByRole('checkbox', { name: /^Fahrzeugschein/ }).check();
  await saveOffline(page);
  const shellId = await storedRequestId(page, '/__kaufcheck-shell');
  const analysisId = await storedRequestId(page, analysisPath);
  expect(shellId).toBeTruthy();
  expect(analysisId).toBeTruthy();

  await goOffline(context);
  const analysis = page.waitForResponse((response) => response.url().endsWith(analysisPath));
  const response = await page.goto(url);
  // Served from the stored copies, not by the server.
  expect(response?.headers()['x-request-id']).toBe(shellId);
  expect((await analysis).headers()['x-request-id']).toBe(analysisId);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Audi A7');
  await expect(page.getByRole('status').filter({ hasText: 'Du bist offline' })).toBeVisible();
  // The checklist works offline, too.
  await expect(page.getByRole('checkbox', { name: /^Fahrzeugschein/ })).toBeChecked();
  await page.getByRole('checkbox', { name: /^HU-Bericht/ }).check();

  // The installed app starts on the homepage; the saved check is linked from there.
  await page.goto('/');
  await page
    .getByRole('navigation', { name: 'Offline gespeicherte Prüfungen' })
    .getByRole('link', { name: /Audi A7/ })
    .click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Audi A7');

  await goOnline(context);
  await page.reload();
  await expect(page.getByRole('status').filter({ hasText: 'Du bist offline' })).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: /^HU-Bericht/ })).toBeChecked();

  // Removing the last copy removes everything, including the service worker.
  await page.getByRole('button', { name: 'Offline-Kopie löschen' }).click();
  await expect(page.getByRole('button', { name: 'Offline verfügbar machen' })).toBeVisible();
  expect(await page.evaluate(() => caches.keys())).toEqual([]);
  expect(await page.evaluate(() => navigator.serviceWorker.getRegistration())).toBeUndefined();
});

test('logging out deletes the offline copy', async ({ page }) => {
  await page.goto('/registrieren');
  await page.getByLabel('E-Mail-Adresse').fill(uniqueEmail());
  await page.getByLabel('Passwort').fill('ein-sicheres-passwort');
  await page.getByRole('button', { name: 'Konto erstellen' }).click();
  await expect(page).not.toHaveURL(/\/registrieren$/);

  await analyzeFromHomepage(page, LISTINGS.audi);
  await saveOffline(page);
  expect(await page.evaluate(() => caches.keys())).toContain('kc-saved-v1');

  await page.goto('/konto');
  await page.getByRole('button', { name: 'Abmelden' }).click();
  await expect(page.getByRole('link', { name: 'Anmelden' }).first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => caches.keys())).toEqual([]);
});

test('signing up after saving keeps the copy, which then lists on the homepage', async ({
  page,
}) => {
  await analyzeFromHomepage(page, LISTINGS.audi);
  await saveOffline(page);

  await page.goto('/registrieren');
  await page.getByLabel('E-Mail-Adresse').fill(uniqueEmail());
  await page.getByLabel('Passwort').fill('ein-sicheres-passwort');
  await page.getByRole('button', { name: 'Konto erstellen' }).click();
  await expect(page).not.toHaveURL(/\/registrieren$/);
  expect(await page.evaluate(() => caches.keys())).toContain('kc-saved-v1');

  await page.goto('/');
  await expect(
    page
      .getByRole('navigation', { name: 'Offline gespeicherte Prüfungen' })
      .getByRole('link', { name: /Audi A7/ }),
  ).toBeVisible();
});
