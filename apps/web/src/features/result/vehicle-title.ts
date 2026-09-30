import type { AnalysisDto } from '@kaufcheck/shared';

export function vehicleTitle(dto: AnalysisDto): string {
  return dto.analysis.vehicleSummary?.title ?? dto.listing.title ?? 'Auto-Inserat';
}
