import { z } from 'zod';
import { PHOTO_FINDING_TYPES } from '@kaufcheck/shared';

/**
 * Output contracts for AI providers. Providers must return JSON matching
 * these schemas; every response is validated again before use and then
 * filtered by {@link mergeAiTextAnalysis} / {@link mergeAiPhotoAnalysis}.
 * Length and count limits are enforced client-side (providers may ignore
 * them in their schema dialect).
 */

export const AiTextAnalysisSchema = z.object({
  summary: z
    .string()
    .min(20)
    .max(700)
    .describe(
      '2–4 neutrale Sätze auf Deutsch: was das Inserat aussagt und was offen ist. Keine Kaufempfehlung.',
    ),
  observations: z
    .array(
      z.object({
        title: z
          .string()
          .min(3)
          .max(90)
          .describe('Kurzer Titel, z. B. "Beschreibung erwähnt Ölverbrauch"'),
        detail: z
          .string()
          .min(10)
          .max(400)
          .describe('Ein bis zwei Sätze: was steht im Inserat und was sollte man prüfen'),
        severity: z.enum(['info', 'notice', 'warning']),
        quote: z
          .string()
          .max(300)
          .nullable()
          .describe(
            'Wörtliches Zitat aus Titel oder Beschreibung, das die Beobachtung belegt, sonst null',
          ),
      }),
    )
    .max(4),
  checks: z
    .array(
      z.object({
        title: z.string().min(3).max(90),
        detail: z
          .string()
          .min(10)
          .max(400)
          .describe('Konkreter Prüfhinweis, als Empfehlung formuliert'),
      }),
    )
    .max(3),
  sellerQuestions: z
    .array(
      z.object({
        formal: z.string().min(8).max(220).describe('Frage an den Verkäufer in der Sie-Form'),
        informal: z.string().min(8).max(220).describe('Dieselbe Frage in der Du-Form'),
        reason: z.string().min(5).max(160).describe('Warum die Frage sinnvoll ist'),
      }),
    )
    .max(4),
});
export type AiTextAnalysis = z.infer<typeof AiTextAnalysisSchema>;

export const AiPhotoAnalysisSchema = z.object({
  findings: z
    .array(
      z.object({
        imageIndex: z
          .number()
          .int()
          .min(0)
          .describe('Index des Fotos in der gelieferten Reihenfolge, beginnend bei 0'),
        type: z.enum(PHOTO_FINDING_TYPES),
        description: z
          .string()
          .min(5)
          .max(220)
          .describe('Was auf dem Foto möglicherweise zu sehen ist, kurz und vorsichtig formuliert'),
        confidence: z.enum(['low', 'medium']),
      }),
    )
    .max(12),
  odometer: z
    .object({
      imageIndex: z.number().int().min(0),
      readingKm: z.number().int().min(0).max(2_000_000),
    })
    .nullable()
    .describe('Nur wenn ein Kilometerstand auf einem Foto eindeutig lesbar ist, sonst null'),
});
export type AiPhotoAnalysis = z.infer<typeof AiPhotoAnalysisSchema>;
