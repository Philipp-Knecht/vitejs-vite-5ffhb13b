import { defineConfig } from 'prisma/config';

// Prisma does not load .env files by itself; use the repository's root .env when present.
try {
  process.loadEnvFile(new URL('../../.env', import.meta.url));
} catch {
  // No .env file – rely on the process environment.
}

// DATABASE_URL is only needed for migrate/introspect; `prisma generate` works without it.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
