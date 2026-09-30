import type {
  AnalysisResult,
  CheckItem,
  NormalizedListing,
  Observation,
  PhotoAnalysis,
  PhotoFinding,
  SellerQuestion,
} from '@kaufcheck/shared';
import { formatKm } from '../../format';
import { containsVerbatim, normalizeForMatch } from '../../text/text';
import {
  AiPhotoAnalysisSchema,
  AiTextAnalysisSchema,
  type AiPhotoAnalysis,
  type AiTextAnalysis,
} from './schemas';

/**
 * AI output is never trusted as-is. After schema validation, every
 * statement goes through these guards:
 *  - no purchase verdicts, fraud accusations or certainty claims,
 *  - quotes must appear verbatim in the listing,
 *  - euro amounts and mileages must come from the listing,
 *  - no duplicates of rule-based findings.
 * Everything that passes is labelled as inference ("Vermutung").
 */

const FORBIDDEN: readonly RegExp[] = [
  /\b(?:guter|schlechter|lohnender|toller|fairer)\s+(?:kauf|deal|preis)\b/i,
  /\bkaufempfehlung\b/i,
  /\b(?:unbedingt|sofort|bedenkenlos)\s+(?:kaufen|zuschlagen)\b/i,
  /\bnicht\s+kaufen\b|\bfinger\s+weg\b|\bfinger\s+davon\b/i,
  /betrug|betrüg|\bscam\b|\bfake\b|abzocke|abzocker|unseriös/i,
  /\b100\s?%|hundertprozentig/i,
  /\bgarantiert\b|\bdefinitiv\b|\bauf\s+jeden\s+fall\b|\bzweifellos\b/i,
  /\bschnäppchen\b|\bzu\s+(?:billig|teuer)\b|\büberteuert\b|\bpreiswert\b/i,
  /\bmarkt(?:wert|preis|üblich)\b/i,
];

export function containsForbiddenClaim(text: string): boolean {
  return FORBIDDEN.some((pattern) => pattern.test(text));
}

function listingText(listing: NormalizedListing): string {
  return [
    listing.title ?? '',
    listing.description ?? '',
    ...listing.attributes.map((a) => `${a.label} ${a.value}`),
  ].join('\n');
}

function digitsOf(value: string): string {
  return value.replace(/\D/g, '');
}

/** Euro amounts and mileages mentioned by the model must exist in the listing. */
export function hasUnsupportedNumbers(text: string, listing: NormalizedListing): boolean {
  const source = listingText(listing);
  const sourceDigits = new Set(
    [...source.matchAll(/\d{1,3}(?:[.\s]\d{3})+|\d+/g)].map((match) => digitsOf(match[0])),
  );
  if (listing.price) sourceDigits.add(String(listing.price.amountEur));
  if (listing.vehicle?.mileageKm != null) sourceDigits.add(String(listing.vehicle.mileageKm));

  const claims = [
    ...text.matchAll(/(\d{1,3}(?:[.\s]\d{3})+|\d{3,})\s*(?:€|euro|eur\b)/gi),
    ...text.matchAll(/(\d{1,3}(?:[.\s]\d{3})+|\d{4,})\s*(?:km|kilometer)\b/gi),
  ];
  return claims.some((match) => !sourceDigits.has(digitsOf(match[1] ?? '')));
}

function words(text: string): Set<string> {
  return new Set(
    normalizeForMatch(text)
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 3),
  );
}

function similar(a: string, b: string): boolean {
  const wa = words(a);
  const wb = words(b);
  if (wa.size === 0 || wb.size === 0) return false;
  let shared = 0;
  for (const word of wa) if (wb.has(word)) shared += 1;
  return shared / Math.min(wa.size, wb.size) >= 0.6;
}

export interface MergeReport {
  accepted: number;
  rejected: number;
}

/** Validates and merges an AI text analysis into the rule-based result. */
export function mergeAiTextAnalysis(
  result: AnalysisResult,
  raw: unknown,
  listing: NormalizedListing,
): { result: AnalysisResult; report: MergeReport } | null {
  const parsed = AiTextAnalysisSchema.safeParse(raw);
  if (!parsed.success) return null;
  const ai: AiTextAnalysis = parsed.data;
  const source = listingText(listing);
  let accepted = 0;
  let rejected = 0;
  const acceptable = (text: string) =>
    !containsForbiddenClaim(text) && !hasUnsupportedNumbers(text, listing);

  const observations: Observation[] = [];
  ai.observations.forEach((item, index) => {
    const text = `${item.title} ${item.detail}`;
    const quoteOk = item.quote === null || containsVerbatim(source, item.quote);
    const duplicate = result.observations.some((existing) => similar(existing.title, item.title));
    if (!acceptable(text) || !quoteOk || duplicate) {
      rejected += 1;
      return;
    }
    accepted += 1;
    observations.push({
      id: `ai_observation_${index + 1}`,
      title: item.title,
      detail: item.detail,
      // Without quotable evidence an AI statement is only a hint.
      severity: item.quote === null ? 'info' : item.severity,
      evidence: 'inference',
      origin: 'ai',
      relatedFields: [],
      quotes: item.quote ? [item.quote] : [],
    });
  });

  const checks: CheckItem[] = [];
  ai.checks.forEach((item, index) => {
    const duplicate = result.checks.some((existing) => similar(existing.title, item.title));
    if (!acceptable(`${item.title} ${item.detail}`) || duplicate) {
      rejected += 1;
      return;
    }
    accepted += 1;
    checks.push({
      id: `ai_check_${index + 1}`,
      title: item.title,
      detail: item.detail,
      evidence: 'inference',
      basis: 'KI-Einschätzung',
      origin: 'ai',
    });
  });

  const questions: SellerQuestion[] = [];
  ai.sellerQuestions.forEach((item, index) => {
    const duplicate = [...result.sellerQuestions, ...questions].some((existing) =>
      similar(existing.text, item.formal),
    );
    if (!acceptable(`${item.formal} ${item.informal} ${item.reason}`) || duplicate) {
      rejected += 1;
      return;
    }
    accepted += 1;
    questions.push({
      id: `ai_question_${index + 1}`,
      text: item.formal,
      textInformal: item.informal,
      reason: item.reason,
      priority: 2,
      relatedField: null,
      origin: 'ai',
    });
  });

  const summaryOk = acceptable(ai.summary);
  if (summaryOk) accepted += 1;
  else rejected += 1;

  // AI questions go after the rule-based priority-2 questions, before priority 3.
  const ruleQuestions = result.sellerQuestions;
  const firstLowPriority = ruleQuestions.findIndex((question) => question.priority === 3);
  const sellerQuestions =
    firstLowPriority === -1
      ? [...ruleQuestions, ...questions]
      : [
          ...ruleQuestions.slice(0, firstLowPriority),
          ...questions,
          ...ruleQuestions.slice(firstLowPriority),
        ];

  return {
    result: {
      ...result,
      summary: { ...result.summary, ai: summaryOk ? { text: ai.summary } : null },
      observations: [...result.observations, ...observations],
      checks: [...result.checks, ...checks],
      sellerQuestions,
    },
    report: { accepted, rejected },
  };
}

/** Validates AI photo findings and turns a legible, deviating odometer reading into an observation. */
export function mergeAiPhotoAnalysis(
  result: AnalysisResult,
  raw: unknown,
  listing: NormalizedListing,
  analyzedImageCount: number,
): { result: AnalysisResult; report: MergeReport } | null {
  const parsed = AiPhotoAnalysisSchema.safeParse(raw);
  if (!parsed.success) return null;
  const ai: AiPhotoAnalysis = parsed.data;
  let accepted = 0;
  let rejected = 0;

  const findings: PhotoFinding[] = [];
  for (const finding of ai.findings) {
    if (finding.imageIndex >= analyzedImageCount || containsForbiddenClaim(finding.description)) {
      rejected += 1;
      continue;
    }
    accepted += 1;
    findings.push(finding);
  }

  const observations = [...result.observations];
  const odometer = ai.odometer;
  if (odometer && odometer.imageIndex < analyzedImageCount) {
    findings.push({
      imageIndex: odometer.imageIndex,
      type: 'odometer',
      description: `Tachostand von ca. ${formatKm(odometer.readingKm)} möglicherweise lesbar`,
      confidence: 'medium',
    });
    const stated = listing.vehicle?.mileageKm ?? null;
    if (stated !== null && Math.abs(stated - odometer.readingKm) > Math.max(5000, stated * 0.05)) {
      observations.push({
        id: 'photo_odometer_mismatch',
        title: 'Kilometerstand auf einem Foto weicht möglicherweise ab',
        detail: `Auf Foto ${odometer.imageIndex + 1} ist möglicherweise ein Kilometerstand von ca. ${formatKm(
          odometer.readingKm,
        )} zu sehen, im Inserat stehen ${formatKm(stated)}. Das kann an einem älteren Foto liegen – frag nach und vergleiche den Tacho vor Ort.`,
        severity: 'notice',
        evidence: 'inference',
        origin: 'ai',
        relatedFields: ['mileageKm'],
        quotes: [],
      });
    }
  }

  const photoAnalysis: PhotoAnalysis = {
    status: 'completed',
    message:
      findings.length === 0
        ? 'Auf den Fotos ist nichts Auffälliges erkennbar. Das ersetzt keine Besichtigung.'
        : null,
    findings,
    analyzedImageCount,
  };
  return { result: { ...result, observations, photoAnalysis }, report: { accepted, rejected } };
}
