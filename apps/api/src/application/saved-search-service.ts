import { isEmptySearch, modelById, parseSearchParams, toSearchParams } from '@kaufcheck/catalog';
import type { SavedSearchDto, SavedSearchesResponse } from '@kaufcheck/shared';
import type { Db } from '../infrastructure/db/client';
import { AppError } from '../lib/errors';
import { isUuid } from '../repositories/analysis-repository';
import type { Actor } from './actor';
import type { AnalyticsService } from './analytics-service';

const isModelId = (id: string) => modelById(id) !== null;

function requireUser(actor: Actor): string {
  if (!actor.userId)
    throw new AppError('UNAUTHENTICATED', { message: 'Melde dich an, um Suchen zu speichern.' });
  return actor.userId;
}

/**
 * Keeps only KaufCheck's own search parameters (make, model, price, …) in a
 * fixed order – never anything else from the request.
 */
export function canonicalSearchQuery(query: string, now: Date): string | null {
  const search = parseSearchParams(new URLSearchParams(query), isModelId, now);
  return isEmptySearch(search) ? null : toSearchParams(search).toString();
}

function toDto(row: { id: string; name: string; query: string; createdAt: Date }): SavedSearchDto {
  return { id: row.id, name: row.name, query: row.query, createdAt: row.createdAt.toISOString() };
}

/** Saved car searches (Pro): reopened later on all marketplaces with one click. */
export class SavedSearchService {
  constructor(
    private readonly db: Db,
    private readonly analytics: AnalyticsService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async list(actor: Actor): Promise<SavedSearchesResponse> {
    const userId = requireUser(actor);
    const rows = await this.db.savedSearch.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return { items: rows.map(toDto), limit: actor.entitlements.savedSearchesMax };
  }

  async save(actor: Actor, name: string, query: string): Promise<SavedSearchDto> {
    const userId = requireUser(actor);
    const max = actor.entitlements.savedSearchesMax;
    if (max === 0)
      throw new AppError('PLAN_LIMIT_REACHED', {
        message: 'Suchen speichern kannst du mit KaufCheck Pro.',
      });
    const canonical = canonicalSearchQuery(query, this.now());
    if (!canonical)
      throw new AppError('VALIDATION_ERROR', {
        message: 'Diese Suche enthält noch keine Angaben.',
      });
    const used = await this.db.savedSearch.count({ where: { userId } });
    if (used >= max)
      throw new AppError('PLAN_LIMIT_REACHED', {
        message: `Du kannst bis zu ${max} Suchen speichern. Lösche eine gespeicherte Suche, um Platz zu schaffen.`,
        details: { limit: max, used },
      });
    const row = await this.db.savedSearch.create({ data: { userId, name, query: canonical } });
    this.analytics.track('search_saved', { plan: actor.plan }, actor);
    return toDto(row);
  }

  async remove(actor: Actor, id: string): Promise<void> {
    const userId = requireUser(actor);
    const notFound = new AppError('NOT_FOUND', {
      message: 'Diese gespeicherte Suche gibt es nicht.',
    });
    if (!isUuid(id)) throw notFound;
    const { count } = await this.db.savedSearch.deleteMany({ where: { id, userId } });
    if (count === 0) throw notFound;
  }
}
