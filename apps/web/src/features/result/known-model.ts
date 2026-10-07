import { findListingModel, findMake } from '@kaufcheck/catalog';
import { hasKnowledge } from '@kaufcheck/catalog/knowledge';
import type { Vehicle } from '@kaufcheck/shared';

/** The researched catalog model of the listing's vehicle, if KaufCheck knows it. */
export function knownModelId(vehicle: Vehicle | null): string | null {
  const entry = findListingModel(findMake(vehicle?.make), vehicle?.model);
  return entry && hasKnowledge(entry.id) ? entry.id : null;
}
