import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import {
  ADVISOR_AVAILABLE,
  ADVISOR_MIN_MODELS,
  MODEL_IDS,
  MODELS_DIR,
  PASTED_LISTING,
} from './helpers';

// Model pages and the advisor depend on the researched models; the tests adapt to how many there are.

interface ModelFile {
  make: string;
  model: string;
  generations: { name: string; issues: unknown[] }[];
}

const readModel = (id: string) =>
  JSON.parse(readFileSync(new URL(`${id}.json`, MODELS_DIR), 'utf8')) as ModelFile;

/** Collects console errors (e.g. hydration mismatches) while a page is used. */
function consoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

test('model pages are prerendered and hydrate without errors', async ({ page, request }) => {
  test.skip(MODEL_IDS.length === 0, 'no researched models yet');
  const id = MODEL_IDS.includes('vw-golf') ? 'vw-golf' : (MODEL_IDS[0] as string);
  const model = readModel(id);
  const name = `${model.make} ${model.model}`;

  const response = await request.get(`/modelle/${id}`);
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(html).toContain('data-prerendered="true"');
  expect(html).toContain('<script id="page-data" type="application/json">');
  expect(html).toContain(`<link rel="canonical" href="`);
  expect(html).toContain(`/modelle/${id}"`);
  expect(html).toContain('"@type":"BreadcrumbList"');

  const errors = consoleErrors(page);
  await page.goto(`/modelle/${id}`);
  await expect(
    page.getByRole('heading', { level: 1, name: `${name} gebraucht kaufen` }),
  ).toBeVisible();
  if (model.generations.length > 1) {
    const generation = model.generations[0] as ModelFile['generations'][number];
    // "Golf VI" must not match "Golf VII": the name is followed by the years.
    const escaped = generation.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    await page
      .getByRole('group', { name: 'Generation wählen' })
      .getByRole('button', { name: new RegExp(`^${escaped} (?:seit )?\\d`) })
      .click();
    await expect(
      page.getByRole('heading', { level: 2, name: new RegExp(`^${escaped}(?: \\(|,)`) }),
    ).toBeVisible();
  }
  await page.getByRole('link', { name: `${name} finden` }).click();
  await expect(page).toHaveURL(new RegExp(`/auto-finden\\?marke=[a-z-]+&modell=${id}$`));
  await expect(page.getByRole('heading', { level: 2, name: /Deine Suche auf/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('the search shows what to know about a researched model', async ({ page }) => {
  test.skip(!MODEL_IDS.includes('vw-golf'), 'no knowledge about the VW Golf yet');
  const { make, model } = readModel('vw-golf');
  await page.goto('/auto-finden?marke=vw&modell=vw-golf&ez_ab=2014&ez_bis=2018');
  await expect(
    page.getByRole('heading', { level: 2, name: `${make} ${model}: Das solltest du wissen` }),
  ).toBeVisible();
  await page.getByRole('link', { name: `Alle Infos zu ${make} ${model}` }).click();
  await expect(page).toHaveURL('/modelle/vw-golf');
});

test('the model overview links every model page', async ({ page }) => {
  test.skip(MODEL_IDS.length === 0, 'no researched models yet');
  await page.goto('/modelle');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Gebrauchtwagen-Modelle im Überblick' }),
  ).toBeVisible();
  await expect(page.locator('a[href^="/modelle/"]')).toHaveCount(MODEL_IDS.length);
});

test('unknown model pages are not found', async ({ page, request }) => {
  expect((await request.get('/modelle/gibt-es-nicht')).status()).toBe(404);
  await page.goto('/modelle/gibt-es-nicht');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Diese Seite gibt es nicht' }),
  ).toBeVisible();
});

test('the advisor waits for enough researched models', async ({ page, request }) => {
  test.skip(ADVISOR_AVAILABLE, 'the advisor is available');
  const html = await (await request.get('/auto-berater')).text();
  expect(html).toContain('<meta name="robots" content="noindex" />');
  await page.goto('/');
  await expect(page.getByRole('link', { name: /Auto-Berater/ })).toHaveCount(0);
  await page.goto('/auto-berater');
  await expect(
    page.getByRole('heading', { level: 2, name: 'Der Auto-Berater startet in Kürze' }),
  ).toBeVisible();
});

test('the advisor suggests models and opens their search', async ({ page }) => {
  test.skip(!ADVISOR_AVAILABLE, `fewer than ${ADVISOR_MIN_MODELS} researched models`);
  const errors = consoleErrors(page);
  await page.goto('/');
  await page.getByRole('link', { name: 'Auto-Berater (2 Min.)' }).click();
  await expect(page).toHaveURL('/auto-berater');
  await expect(page.getByText('Frage 1 von 7')).toBeVisible();

  const next = page.getByRole('button', { name: 'Weiter' });
  await page.getByRole('radio', { name: 'bis 20.000 €' }).check();
  await next.click();
  await expect(page.getByText('Frage 2 von 7')).toBeVisible();
  await page.getByRole('radio', { name: 'Familie und Alltag' }).check();
  await next.click();
  await page.getByRole('radio', { name: '3–4 Personen' }).check();
  await next.click();
  // Optional questions can be skipped.
  await page.getByRole('button', { name: 'Überspringen' }).click();
  await page.getByRole('button', { name: 'Überspringen' }).click();
  await page.getByRole('radio', { name: 'Automatik' }).check();
  await next.click();
  await page.getByRole('checkbox', { name: 'Zuverlässigkeit' }).check();
  await page.getByRole('button', { name: 'Vorschläge anzeigen' }).click();

  await expect(page).toHaveURL(
    '/auto-berater?budget=20000&nutzung=familie&personen=4&getriebe=automatik&prio=zuverlaessigkeit',
  );
  await expect(
    page.getByRole('heading', { level: 2, name: 'Diese Modelle passen zu dir' }),
  ).toBeVisible();
  const suggestions = page
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { level: 3 }) });
  await expect(suggestions.first()).toBeVisible();

  // The answers survive a reload, and the search starts with them.
  await page.reload();
  await expect(suggestions.first()).toBeVisible();
  await suggestions.first().getByRole('link', { name: 'Angebote finden' }).click();
  await expect(page).toHaveURL(/\/auto-finden\?marke=[a-z-]+&modell=[a-z0-9-]+&preis_bis=20000/);
  await expect(page.getByRole('heading', { level: 2, name: /Deine Suche auf/ })).toBeVisible();

  await page.goBack();
  await page.getByRole('button', { name: 'Antworten ändern' }).click();
  await expect(page.getByText('Frage 1 von 7')).toBeVisible();
  await expect(page.getByRole('radio', { name: 'bis 20.000 €' })).toBeChecked();
  expect(errors).toEqual([]);
});

test('the listing check shows what is known about the model', async ({ page }) => {
  test.skip(!MODEL_IDS.includes('vw-golf'), 'no knowledge about the VW Golf yet');
  const { make, model } = readModel('vw-golf');
  await page.goto('/inserat-pruefen');
  // A Golf with first registration 03/2014.
  await page.getByLabel('Inseratstext oder Link zum Auto-Inserat').fill(PASTED_LISTING);
  await page.getByRole('button', { name: 'Inserat prüfen' }).click();
  await expect(page).toHaveURL(/\/analyse\//);
  const section = page.getByRole('region', { name: `${make} ${model}: bekannte Schwachstellen` });
  await expect(section).toBeVisible();
  await expect(section.getByText(/Passend zur Erstzulassung 2014/)).toBeVisible();
  await expect(section.getByRole('heading', { level: 3, name: /^Golf VII\b/ })).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Abschnitte der Prüfung' }).getByRole('link', {
      name: 'Modell',
    }),
  ).toBeVisible();
});
