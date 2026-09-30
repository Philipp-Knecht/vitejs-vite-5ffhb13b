/**
 * Operator tool: sets a user's plan by hand, e.g. for support cases or to
 * grant Pro while no payment provider is configured.
 *
 *   npm run user:set-plan -w @kaufcheck/api -- nutzer@example.de pro
 *
 * Plans of users with a Stripe subscription are synced from verified webhook
 * events and may be overwritten by the next event.
 */
import { EmailSchema } from '@kaufcheck/shared';
import { createDb } from '../src/infrastructure/db/client';

const [rawEmail, rawPlan] = process.argv.slice(2);
const email = EmailSchema.safeParse(rawEmail ?? '');
const plan = rawPlan?.toUpperCase();

if (!email.success || (plan !== 'FREE' && plan !== 'PRO')) {
  console.error('Aufruf: npm run user:set-plan -w @kaufcheck/api -- <e-mail> <free|pro>');
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL ist nicht gesetzt.');
  process.exit(1);
}

const db = createDb(databaseUrl);
try {
  const user = await db.user.findUnique({
    where: { email: email.data },
    select: { id: true, subscription: true },
  });
  if (!user) {
    console.error('Kein Konto mit dieser E-Mail-Adresse gefunden.');
    process.exitCode = 1;
  } else {
    await db.user.update({ where: { id: user.id }, data: { plan } });
    console.log(`Tarif auf ${plan} gesetzt.`);
    if (user.subscription?.provider === 'stripe') {
      console.warn(
        'Hinweis: Dieses Konto hat ein Stripe-Abo. Der nächste Webhook kann den Tarif wieder ändern.',
      );
    }
  }
} finally {
  await db.$disconnect();
}
