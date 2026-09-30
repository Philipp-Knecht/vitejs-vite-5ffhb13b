/** Limits and protocol constants shared by web and api (no runtime dependencies). */

export const MIN_LISTING_TEXT_LENGTH = 40;
export const MAX_LISTING_TEXT_LENGTH = 20_000;

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 200;

/**
 * Real pipeline stages, reported while an analysis runs. `ai` is only
 * reported when an AI provider is configured and actually called.
 */
export const ANALYSIS_STAGES = [
  'validate',
  'retrieve',
  'extract',
  'analyze',
  'questions',
  'ai',
] as const;
export type AnalysisStage = (typeof ANALYSIS_STAGES)[number];

export const NDJSON_CONTENT_TYPE = 'application/x-ndjson';
