import type { ListingCategory } from '@kaufcheck/shared';
import { VehicleAnalyzer } from '../vehicle/vehicle-analyzer';
import type { StagedListingAnalyzer } from './types';

/**
 * Category → analyzer. New categories (ElectronicsAnalyzer,
 * ComputerAnalyzer, …) are added here without touching the pipeline.
 */
const ANALYZERS: ReadonlyMap<ListingCategory, StagedListingAnalyzer> = new Map([
  ['vehicle', new VehicleAnalyzer()],
]);

export function getAnalyzer(category: ListingCategory): StagedListingAnalyzer | null {
  return ANALYZERS.get(category) ?? null;
}
