import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';

export type Db = PrismaClient;
export { Prisma } from '../../generated/prisma/client';

export function createDb(databaseUrl: string): Db {
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  return new PrismaClient({ adapter });
}

/** Unique-constraint violation (e.g. concurrent inserts). */
export function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}
