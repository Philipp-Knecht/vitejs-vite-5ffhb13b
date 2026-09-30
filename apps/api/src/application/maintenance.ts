import type { Db } from '../infrastructure/db/client';

export interface MaintenanceReport {
  expiredSessions: number;
  expiredResetTokens: number;
  anonymousAnalyses: number;
  orphanedListings: number;
  oldUsage: number;
  oldAnalyticsEvents: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Data retention: removes expired credentials and data that is no longer
 * needed. Anonymous analyses are kept for `anonRetentionDays` so result
 * links keep working for a while; account data stays until deletion.
 */
export async function runMaintenance(
  db: Db,
  options: { now: Date; anonRetentionDays: number },
): Promise<MaintenanceReport> {
  const { now } = options;
  const anonCutoff = new Date(now.getTime() - options.anonRetentionDays * DAY_MS);
  const retentionCutoff = new Date(now.getTime() - 400 * DAY_MS);
  const oldPeriod = `${retentionCutoff.getUTCFullYear()}-${String(retentionCutoff.getUTCMonth() + 1).padStart(2, '0')}`;

  const expiredSessions = await db.session.deleteMany({ where: { expiresAt: { lt: now } } });
  const expiredResetTokens = await db.passwordResetToken.deleteMany({
    where: { expiresAt: { lt: now } },
  });
  const anonymousAnalyses = await db.analysis.deleteMany({
    where: { userId: null, createdAt: { lt: anonCutoff } },
  });
  const orphanedListings = await db.listing.deleteMany({
    where: { analyses: { none: {} }, savedListings: { none: {} } },
  });
  const oldUsage = await db.usage.deleteMany({ where: { period: { lt: oldPeriod } } });
  const oldAnalyticsEvents = await db.analyticsEvent.deleteMany({
    where: { createdAt: { lt: retentionCutoff } },
  });

  return {
    expiredSessions: expiredSessions.count,
    expiredResetTokens: expiredResetTokens.count,
    anonymousAnalyses: anonymousAnalyses.count,
    orphanedListings: orphanedListings.count,
    oldUsage: oldUsage.count,
    oldAnalyticsEvents: oldAnalyticsEvents.count,
  };
}
