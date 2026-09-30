import type { AnalysisResult, ListingCategory, NormalizedListing } from '@kaufcheck/shared';
import type { MarketData } from '../vehicle/price';

export interface AnalysisContext {
  /** Reference time for ages and HU validity. */
  now: Date;
  /** Verified comparable listings for price context, if any. */
  market?: MarketData | null;
}

export interface ListingAnalyzer {
  readonly category: ListingCategory;
  analyze(listing: NormalizedListing, context?: AnalysisContext): Promise<AnalysisResult>;
}

/** Everything except the buyer-facing questions and checklist. */
export type CoreAssessment = Omit<AnalysisResult, 'sellerQuestions' | 'inspectionChecklist'>;

export type BuyerPreparation = Pick<AnalysisResult, 'sellerQuestions' | 'inspectionChecklist'>;

/**
 * Analyzer that exposes its steps separately, so the pipeline can report
 * real progress ("Angebot wird analysiert" → "Fragen werden erstellt").
 */
export interface StagedListingAnalyzer extends ListingAnalyzer {
  readonly rulesVersion: string;
  assess(listing: NormalizedListing, context: AnalysisContext): CoreAssessment;
  prepareBuyerQuestions(
    listing: NormalizedListing,
    assessment: CoreAssessment,
    context: AnalysisContext,
  ): BuyerPreparation;
}

export const ANALYSIS_DISCLAIMER =
  'KaufCheck wertet nur die Angaben im Inserat aus und ersetzt keine Besichtigung, Probefahrt oder fachkundige Prüfung. Alle Angaben ohne Gewähr.';
