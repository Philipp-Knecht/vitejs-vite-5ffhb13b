import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_URL = 'postgresql://kaufcheck:kaufcheck@localhost:5432/kaufcheck_test';

/**
 * Integration tests run against a separate database (TEST_DATABASE_URL). It is
 * created if missing and migrated with the real migrations before the run.
 * Tests truncate its tables, so the name must contain "test".
 */
export default async function setup(project: TestProject): Promise<void> {
  const databaseUrl = process.env.TEST_DATABASE_URL ?? DEFAULT_URL;
  const url = new URL(databaseUrl);
  const name = decodeURIComponent(url.pathname.slice(1));
  if (!/^[A-Za-z0-9_]+$/.test(name) || !name.toLowerCase().includes('test')) {
    throw new Error(
      `Refusing to run integration tests against "${name}": the database name must contain "test".`,
    );
  }

  const admin = new URL(databaseUrl);
  admin.pathname = '/postgres';
  const client = new pg.Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
    if (existing.rowCount === 0) await client.query(`CREATE DATABASE "${name}"`);
  } finally {
    await client.end();
  }

  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: apiRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  });
  project.provide('databaseUrl', databaseUrl);
}
