import type { AppConfig } from '../../config/env';
import { AnthropicProvider } from './anthropic-provider';
import { MockAiProvider } from './mock-provider';
import { OpenAiProvider } from './openai-provider';
import type { AiProvider } from './types';

/** Returns the configured provider, or `null` when AI is not configured. */
export function createAiProvider(config: AppConfig): AiProvider | null {
  const { ai } = config;
  switch (ai.provider) {
    case 'anthropic':
      return ai.anthropic.apiKey
        ? new AnthropicProvider({
            apiKey: ai.anthropic.apiKey,
            model: ai.anthropic.model,
            effort: ai.anthropic.effort,
          })
        : null;
    case 'openai':
      return ai.openai.apiKey && ai.openai.model
        ? new OpenAiProvider({
            apiKey: ai.openai.apiKey,
            model: ai.openai.model,
            baseUrl: ai.openai.baseUrl,
          })
        : null;
    case 'mock':
      return config.isProduction ? null : new MockAiProvider();
    case 'none':
      return null;
  }
}
