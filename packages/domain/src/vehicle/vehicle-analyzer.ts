import type { AnalysisResult, NormalizedListing, PhotoAnalysis } from '@kaufcheck/shared';
import {
  ANALYSIS_DISCLAIMER,
  type AnalysisContext,
  type BuyerPreparation,
  type CoreAssessment,
  type StagedListingAnalyzer,
} from '../analysis/types';
import { buildInspectionChecklist } from './checklist';
import { collectChecks } from './checks';
import { assessCompleteness } from './completeness';
import { collectObservations } from './observations';
import { buildOverview, buildVehicleSummary } from './overview';
import { assessPrice } from './price';
import { generateSellerQuestions } from './questions';
import { buildRuleContext } from './rule-context';
import { buildSummary } from './summary';

/** Bump when rules change in a way that affects results. Stored with each analysis. */
export const VEHICLE_RULES_VERSION = '2026.09.1';

function initialPhotoAnalysis(listing: NormalizedListing): PhotoAnalysis {
  if (listing.images.length === 0) {
    return {
      status: 'no_photos',
      message:
        listing.source.type === 'kleinanzeigen_url'
          ? 'Das Inserat enthält keine Fotos.'
          : 'Bei eingefügtem Text sind keine Fotos verfügbar.',
      findings: [],
      analyzedImageCount: 0,
    };
  }
  // The application layer replaces this once it knows whether photo analysis runs.
  return { status: 'not_configured', message: null, findings: [], analyzedImageCount: 0 };
}

/** Rule-based analysis for used cars. Deterministic and free of external calls. */
export class VehicleAnalyzer implements StagedListingAnalyzer {
  readonly category = 'vehicle' as const;
  readonly rulesVersion = VEHICLE_RULES_VERSION;

  assess(listing: NormalizedListing, context: AnalysisContext): CoreAssessment {
    const ctx = buildRuleContext(listing, context.now);
    const completeness = assessCompleteness(ctx);
    const observations = collectObservations(ctx);
    return {
      schemaVersion: 1,
      rulesVersion: this.rulesVersion,
      category: 'vehicle',
      vehicleSummary: buildVehicleSummary(ctx),
      summary: buildSummary(ctx, completeness, observations),
      overview: buildOverview(ctx),
      completeness,
      priceContext: assessPrice(ctx, context.market ?? null),
      observations,
      checks: collectChecks(ctx),
      photoAnalysis: initialPhotoAnalysis(listing),
      ai: { status: 'skipped', provider: null, model: null, isMock: false, message: null },
      disclaimer: ANALYSIS_DISCLAIMER,
    };
  }

  prepareBuyerQuestions(
    listing: NormalizedListing,
    assessment: CoreAssessment,
    context: AnalysisContext,
  ): BuyerPreparation {
    const ctx = buildRuleContext(listing, context.now);
    return {
      sellerQuestions: generateSellerQuestions(ctx, assessment.observations),
      inspectionChecklist: buildInspectionChecklist(ctx),
    };
  }

  analyze(
    listing: NormalizedListing,
    context: AnalysisContext = { now: new Date() },
  ): Promise<AnalysisResult> {
    const assessment = this.assess(listing, context);
    const preparation = this.prepareBuyerQuestions(listing, assessment, context);
    return Promise.resolve({ ...assessment, ...preparation });
  }
}
