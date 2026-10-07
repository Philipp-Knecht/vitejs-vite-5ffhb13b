import { KNOWLEDGE_IDS } from '@kaufcheck/catalog/knowledge';

/**
 * The advisor only suggests researched models. It is offered once it can
 * choose from enough of them across makes and classes – with fewer, its
 * suggestions would be one-sided.
 */
export const ADVISOR_MIN_MODELS = 40;

export const ADVISOR_AVAILABLE = KNOWLEDGE_IDS.length >= ADVISOR_MIN_MODELS;

/** The overview of model pages is offered as soon as there is one. */
export const MODEL_PAGES_AVAILABLE = KNOWLEDGE_IDS.length > 0;
