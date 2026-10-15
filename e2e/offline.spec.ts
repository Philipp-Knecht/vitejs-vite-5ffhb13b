import { expect, test } from '@playwright/test';
import { analyzeFromHomepage, LISTINGS } from './helpers';

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

test('a saved check opens without reception', async ({ page, context }) => {
  await analyzeFromHomepage(page, LISTINGS.audi);
  const url = page.url();
  await page.getByRole('checkbox', { name: /^Fahrzeugschein/ }).check();
  await page.getByRole('button', { name: 'Offline verfügbar machen' }).click();
  await expect(page.getByText('diese Prüfung öffnet sich jetzt auch ohne Empfang')).toBeVisible();

  // No network at all – also not for the service worker.
  await context.route('**/*', (route) => route.abort('internetdisconnected'));
  await context.setOffline(true);
  const response = await page.goto(url);
  expect(response?.fromServiceWorker()).toBe(true);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Audi A7');
  await expect(page.getByRole('status').filter({ hasText: 'Du bist offline' })).toBeVisible();
  // The checklist works offline, too.
  await expect(page.getByRole('checkbox', { name: /^Fahrzeugschein/ })).toBeChecked();
  await page.getByRole('checkbox', { name: /^HU-Bericht/ }).check();

  await context.unrouteAll();
  await context.setOffline(false);
  await page.reload();
  await expect(page.getByRole('status').filter({ hasText: 'Du bist offline' })).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: /^HU-Bericht/ })).toBeChecked();

  // The copy can be removed again.
  await page.getByRole('button', { name: 'Offline-Kopie löschen' }).click();
  await expect(page.getByRole('button', { name: 'Offline verfügbar machen' })).toBeVisible();
  expect(await page.evaluate(() => caches.keys())).not.toContain('kc-saved-v1');
});
