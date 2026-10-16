import { createHash, createHmac, randomBytes } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import pg from 'pg';
import { makePro, uniqueEmail } from './helpers';

/** The same secret as in e2e/start-server.mjs: it signs the unsubscribe links. */
const COOKIE_SECRET = 'e2e-cookie-secret-that-is-long-enough-123456';

async function query<T>(sql: string, values: unknown[]): Promise<T[]> {
  const client = new pg.Client({
    connectionString:
      process.env.E2E_DATABASE_URL ??
      'postgresql://kaufcheck:kaufcheck@localhost:5432/kaufcheck_e2e',
  });
  await client.connect();
  try {
    return (await client.query(sql, values)).rows as T[];
  } finally {
    await client.end();
  }
}

async function ownerWithCar(page: Page, pro: boolean): Promise<string> {
  const email = uniqueEmail();
  await page.goto('/registrieren');
  await page.getByLabel('E-Mail-Adresse').fill(email);
  await page.getByLabel('Passwort').fill('ein-sicheres-passwort');
  await page.getByRole('button', { name: 'Konto erstellen' }).click();
  await expect(page).not.toHaveURL(/\/registrieren$/);
  if (pro) await makePro(email);
  await page.goto('/mein-auto');
  const add = page.getByRole('region', { name: 'Auto anlegen' });
  await add.getByLabel('Marke').selectOption('skoda');
  await add.getByLabel('Modell', { exact: true }).selectOption('other');
  await add.getByLabel('Modellbezeichnung').fill('Fabia');
  await add.getByRole('group', { name: 'Erstzulassung' }).getByLabel('Jahr').fill('2018');
  await add.getByRole('button', { name: 'Auto anlegen' }).click();
  await page.getByRole('link', { name: 'Erinnerungen einstellen für Škoda Fabia' }).click();
  await expect(page).toHaveURL(/\/mein-auto\/[0-9a-f-]{36}\/erinnerungen$/);
  return email;
}

test('without Pro reminders explain themselves', async ({ page }) => {
  await ownerWithCar(page, false);
  await expect(page.getByText('Erinnerungen gehören zu KaufCheck Pro')).toBeVisible();
  const service = page.getByRole('region', { name: 'Inspektion' });
  await expect(service.getByRole('checkbox', { name: 'Per E-Mail erinnern' })).toBeDisabled();
});

test('reminders are switched on, confirmed by link and unsubscribed', async ({ page }) => {
  const email = await ownerWithCar(page, true);
  const nextYear = String(new Date().getFullYear() + 1);

  // The HU needs the month from the badge first.
  const hu = page.getByRole('region', { name: 'Hauptuntersuchung (HU)' });
  await expect(hu.getByText(/Monat und Jahr von der Prüfplakette/)).toBeVisible();
  await expect(hu.getByRole('checkbox')).toHaveCount(0);

  const service = page.getByRole('region', { name: 'Inspektion' });
  await service.getByLabel('Monat').selectOption({ label: 'März' });
  await service.getByLabel('Jahr').fill(nextYear);
  await service.getByRole('checkbox', { name: 'Per E-Mail erinnern' }).check();
  await service.getByRole('button', { name: /^Speichern\s*: Inspektion$/ }).click();
  await expect(
    page.getByText(/Eingeschaltet – bitte bestätige noch deine E-Mail-Adresse/),
  ).toBeVisible();
  await expect(page.getByText('Bitte bestätige deine E-Mail-Adresse')).toBeVisible();
  await expect(
    page.getByText(
      `Wir haben dir einen Link an ${email} geschickt. Erst nach der Bestätigung bekommst du Erinnerungen.`,
    ),
  ).toBeVisible();

  const download = page.waitForEvent('download');
  await service.getByRole('button', { name: /^In den Kalender\s*: Inspektion$/ }).click();
  expect((await download).suggestedFilename()).toBe(`inspektion-${nextYear}-03.ics`);

  // A last change in the future is rejected before saving.
  const brake = page.getByRole('region', { name: 'Bremsflüssigkeit' });
  await brake.getByLabel('Monat').selectOption({ label: 'Januar' });
  await brake.getByLabel('Jahr').fill(nextYear);
  await brake.getByRole('button', { name: /^Speichern\s*: Bremsflüssigkeit$/ }).click();
  await expect(
    brake.getByText('Der letzte Wechsel kann nicht in der Zukunft liegen.'),
  ).toBeVisible();

  const results = await new AxeBuilder({ page })
    .include('.reminders')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations.map((violation) => violation.id)).toEqual([]);

  // The link from the confirmation e-mail (the e2e server only logs e-mails).
  const token = randomBytes(32).toString('base64url');
  await query(
    `INSERT INTO "ReminderConfirmToken" ("id", "tokenHash", "userId", "expiresAt")
     SELECT gen_random_uuid(), $1, "id", now() + interval '1 day' FROM "User" WHERE "email" = $2`,
    [createHash('sha256').update(token).digest('hex'), email],
  );
  const remindersUrl = page.url();
  await page.goto(`/erinnerungen-bestaetigen?token=${token}`);
  await page.getByRole('button', { name: 'E-Mail-Adresse bestätigen' }).click();
  await expect(page.getByText('Bestätigt', { exact: true })).toBeVisible();
  await page.goto(remindersUrl);
  await expect(page.getByText(`Erinnerungen gehen an ${email}.`)).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Inspektion' }).getByText(/Nächste E-Mail: Anfang Februar/),
  ).toBeVisible();

  // The unsubscribe link in a reminder.
  const [reminder] = await query<{ id: string }>(
    `SELECT r."id" FROM "CarReminder" r JOIN "OwnedCar" c ON c."id" = r."carId"
     JOIN "User" u ON u."id" = c."userId" WHERE u."email" = $1 AND r."kind" = 'service'`,
    [email],
  );
  const signature = createHmac('sha256', COOKIE_SECRET)
    .update(`reminder-unsubscribe:${reminder!.id}`)
    .digest('base64url');
  await page.goto(`/erinnerung-abbestellen?r=${reminder!.id}&t=${signature}`);
  await expect(
    page.getByText(/die Erinnerung „Inspektion“ für Škoda Fabia nicht mehr/),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Erinnerung abbestellen' }).click();
  await expect(page.getByText('Abbestellt', { exact: true })).toBeVisible();
  await page.goto(remindersUrl);
  await expect(
    page
      .getByRole('region', { name: 'Inspektion' })
      .getByRole('checkbox', { name: 'Per E-Mail erinnern' }),
  ).not.toBeChecked();
});
