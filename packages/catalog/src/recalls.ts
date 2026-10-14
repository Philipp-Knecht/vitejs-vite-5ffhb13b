/**
 * Where buyers check recalls. Only the manufacturers know whether a particular
 * car still has an open recall, so KaufCheck links to their official pages and
 * to the KBA database; it never queries them itself.
 */
export interface RecallCheck {
  /** Official page of the manufacturer or its German importer. */
  url: string;
  /**
   * `vin`: the page checks a FIN directly; `account`: only after signing in to
   * the owner portal; `info`: general recall information without a FIN check.
   */
  lookup: 'vin' | 'account' | 'info';
}

/** Recall database of the Kraftfahrt-Bundesamt: recalls by make, model and year, not by FIN. */
export const KBA_RECALL_DATABASE_URL = 'https://www.kba-online.de/rrdb/buerger/';

/** Keyed by make id (`src/makes.ts`); only pages that were checked by hand. */
const RECALL_CHECKS: Readonly<Record<string, RecallCheck>> = {};

export function recallCheckFor(makeId: string | null | undefined): RecallCheck | null {
  return makeId ? (RECALL_CHECKS[makeId] ?? null) : null;
}

/** For the catalog test: every entry must belong to a make of the catalog. */
export const RECALL_CHECK_MAKE_IDS: readonly string[] = Object.keys(RECALL_CHECKS);
