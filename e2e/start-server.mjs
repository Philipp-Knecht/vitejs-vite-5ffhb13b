/**
 * Starts the production build of KaufCheck for the end-to-end tests:
 * a dedicated database (created, migrated and emptied), the bundled API
 * serving the prerendered web app, synthetic listing fixtures and the
 * clearly labelled development AI mock. Run `npm run build` first.
 */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = process.env.E2E_PORT ?? '3100';
const databaseUrl =
  process.env.E2E_DATABASE_URL ?? 'postgresql://kaufcheck:kaufcheck@localhost:5432/kaufcheck_e2e';

for (const file of ['apps/api/dist/server.js', 'apps/web/dist/index.html']) {
  if (!existsSync(path.join(root, file))) {
    console.error(`Missing ${file} – run "npm run build" before the end-to-end tests.`);
    process.exit(1);
  }
}

const name = new URL(databaseUrl).pathname.slice(1);
if (!/^[A-Za-z0-9_]+$/.test(name) || !/e2e|test/i.test(name)) {
  console.error(
    `Refusing to use "${name}" for end-to-end tests: the name must contain "e2e" or "test".`,
  );
  process.exit(1);
}

const admin = new URL(databaseUrl);
admin.pathname = '/postgres';
const client = new pg.Client({ connectionString: admin.toString() });
await client.connect();
const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
if (exists.rowCount === 0) await client.query(`CREATE DATABASE "${name}"`);
await client.end();

execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
  cwd: path.join(root, 'apps/api'),
  env: { ...process.env, DATABASE_URL: databaseUrl },
  stdio: 'ignore',
});

const db = new pg.Client({ connectionString: databaseUrl });
await db.connect();
const tables = await db.query(
  "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'",
);
if (tables.rows.length > 0) {
  await db.query(`TRUNCATE ${tables.rows.map((row) => `"${row.tablename}"`).join(', ')} CASCADE`);
}
await db.end();

const server = spawn(process.execPath, [path.join(root, 'apps/api/dist/server.js')], {
  cwd: root,
  stdio: 'inherit',
  env: {
    PATH: process.env.PATH,
    NODE_ENV: 'test',
    PORT: port,
    HOST: '127.0.0.1',
    LOG_LEVEL: process.env.E2E_LOG_LEVEL ?? 'warn',
    PUBLIC_SITE_URL: `http://127.0.0.1:${port}`,
    DATABASE_URL: databaseUrl,
    COOKIE_SECRET: 'e2e-cookie-secret-that-is-long-enough-123456',
    SERVE_WEB: 'true',
    LISTING_FETCH_MODE: 'fixtures',
    AI_PROVIDER: 'mock',
    EMAIL_TRANSPORT: 'console',
    ANALYZE_RATE_PER_MINUTE: '1000',
  },
});

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.kill(signal));
server.on('exit', (code) => process.exit(code ?? 0));
