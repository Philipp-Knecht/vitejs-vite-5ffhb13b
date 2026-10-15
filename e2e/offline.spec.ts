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
  const worker = await request.get('/sw.js');
  expect(worker.headers()['cache-control']).toBe('no-cache');
});

test('an opened check is still there without reception', async ({ page, context }) => {
  await analyzeFromHomepage(page, LISTINGS.audi);
  const url = page.url();
  // The service worker takes over this page; the next load is kept for offline use.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Audi A7');
  await page.getByRole('checkbox', { name: /^Fahrzeugschein/ }).check();

  await context.setOffline(true);
  await page.goto(url);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Audi A7');
  await expect(page.getByRole('status').filter({ hasText: 'Du bist offline' })).toBeVisible();
  // The checklist works offline, too.
  await expect(page.getByRole('checkbox', { name: /^Fahrzeugschein/ })).toBeChecked();
  await page.getByRole('checkbox', { name: /^HU-Bericht/ }).check();

  await context.setOffline(false);
  await page.reload();
  await expect(page.getByRole('status').filter({ hasText: 'Du bist offline' })).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: /^HU-Bericht/ })).toBeChecked();
});
