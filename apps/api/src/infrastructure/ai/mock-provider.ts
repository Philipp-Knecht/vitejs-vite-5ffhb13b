import type { AiPhotoAnalysis, AiTextAnalysis } from '@kaufcheck/domain';
import type { AiProvider, StructuredAnalysisRequest, StructuredAnalysisResponse } from './types';

/**
 * DEVELOPMENT / TEST ONLY. Produces clearly labelled, simulated output so the
 * AI code path and UI can be exercised without an API key. The configuration
 * rejects this provider in production, and results carry `isMock: true`.
 */
export class MockAiProvider implements AiProvider {
  readonly name = 'mock' as const;
  readonly model = 'mock-dev';
  readonly isMock = true;
  readonly supportsVision = true;

  generateStructuredAnalysis<T>(request: StructuredAnalysisRequest<T>): Promise<StructuredAnalysisResponse<T>> {
    const data = request.task === 'listing_text' ? this.text(request.prompt) : this.photos();
    return Promise.resolve({ data: request.schema.parse(data), model: this.model });
  }

  private text(prompt: string): AiTextAnalysis {
    const description = /<description>\n([\s\S]*?)\n<\/description>/.exec(prompt)?.[1] ?? '';
    const firstSentence = description.split(/(?<=[.!?])\s+/)[0]?.trim() ?? '';
    const quote = firstSentence.length >= 10 && firstSentence.length <= 200 ? firstSentence : null;
    return {
      summary:
        'Simulierte KI-Einschätzung (Entwicklungsmodus): Dieser Text stammt nicht von einem KI-Modell und dient nur zum Testen der Oberfläche.',
      observations: quote
        ? [
            {
              title: 'Simulierter KI-Hinweis',
              detail: 'Entwicklungsmodus: Dieser Hinweis ist simuliert und zitiert den ersten Satz der Beschreibung.',
              severity: 'info',
              quote,
            },
          ]
        : [],
      checks: [],
      sellerQuestions: [
        {
          formal: 'Simulierte Frage (Entwicklungsmodus): Gibt es noch etwas, das ich vorab wissen sollte?',
          informal: 'Simulierte Frage (Entwicklungsmodus): Gibt es noch etwas, das ich vorab wissen sollte?',
          reason: 'Nur zum Testen der KI-Anbindung.',
        },
      ],
    };
  }

  private photos(): AiPhotoAnalysis {
    return { findings: [], odometer: null };
  }
}
