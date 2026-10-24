import Anthropic from '@anthropic-ai/sdk';
import { claudeModelFeatures, mapAnthropicError } from './anthropic-provider';
import type { ChatModel, ChatModelMessage, ChatModelRequest, ChatModelTurn } from './chat-model';
import { AiProviderError } from './types';

export interface AnthropicChatModelOptions {
  apiKey: string;
  model: string;
  effort: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  /** Injectable for tests. */
  client?: Anthropic;
}

/** Room for adaptive thinking and the answer; more effort thinks longer. */
const MAX_TOKENS: Record<AnthropicChatModelOptions['effort'], number> = {
  low: 8_000,
  medium: 12_000,
  high: 16_000,
  xhigh: 32_000,
  max: 32_000,
};

const STOP: Record<string, ChatModelTurn['stop']> = {
  end_turn: 'end',
  stop_sequence: 'end',
  tool_use: 'tool_use',
  max_tokens: 'max_tokens',
  refusal: 'refusal',
};

function toParam(message: ChatModelMessage): Anthropic.Beta.BetaMessageParam {
  switch (message.role) {
    case 'user':
      return { role: 'user', content: message.text };
    case 'assistant':
      return { role: 'assistant', content: message.text };
    case 'assistant_turn':
      // Back unchanged, thinking and fallback blocks included.
      return {
        role: 'assistant',
        content: message.turn.raw as Anthropic.Beta.BetaContentBlockParam[],
      };
    case 'tool_results':
      return {
        role: 'user',
        content: message.results.map((result) => ({
          type: 'tool_result' as const,
          tool_use_id: result.toolUseId,
          content: result.content,
          is_error: result.isError,
        })),
      };
  }
}

/**
 * Claude for the chat: streamed, adaptive thinking, strict tool schemas, the
 * stable system prompt and tools cached. On models with refusal classifiers
 * the server-side fallback answers a false positive with another model.
 */
export class AnthropicChatModel implements ChatModel {
  readonly isMock = false;
  readonly model: string;
  private readonly client: Anthropic;
  private readonly effort: AnthropicChatModelOptions['effort'];
  private readonly features: ReturnType<typeof claudeModelFeatures>;

  constructor(options: AnthropicChatModelOptions) {
    this.model = options.model;
    this.effort = options.effort;
    this.features = claudeModelFeatures(options.model);
    this.client = options.client ?? new Anthropic({ apiKey: options.apiKey, maxRetries: 1 });
  }

  async turn(request: ChatModelRequest): Promise<ChatModelTurn> {
    let message: Anthropic.Beta.BetaMessage;
    try {
      const stream = this.client.beta.messages.stream(
        {
          model: this.model,
          max_tokens: MAX_TOKENS[this.effort],
          // The conversation so far is cached too: the next step and the next message read it.
          cache_control: { type: 'ephemeral' },
          thinking: { type: 'adaptive' },
          ...(this.features.effort ? { output_config: { effort: this.effort } } : {}),
          ...(this.features.refusalFallbacks
            ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }
            : {}),
          system: [
            { type: 'text', text: request.system.stable, cache_control: { type: 'ephemeral' } },
            { type: 'text', text: request.system.dynamic },
          ],
          tools: request.tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            input_schema: tool.inputSchema as Anthropic.Beta.BetaTool.InputSchema,
            strict: tool.strict,
            eager_input_streaming: true,
          })),
          messages: request.messages.map(toParam),
        },
        { signal: request.signal, timeout: 90_000 },
      );
      stream.on('text', (delta) => request.onText(delta));
      message = await stream.finalMessage();
    } catch (error) {
      // A tool input that is no JSON at all ends up here too: the chat retries the turn.
      throw mapAnthropicError(error);
    }

    // After a fallback mid-answer, the declined model's thinking and tool calls
    // before the last `fallback` block are neither run nor sent back; its text stays.
    const boundary = message.content.findLastIndex((block) => block.type === 'fallback');
    const content = message.content.filter(
      (block, index) => index > boundary || (block.type === 'text' && boundary !== -1),
    );
    const text = content.flatMap((block) => (block.type === 'text' ? [block.text] : [])).join('');
    const toolCalls = content.flatMap((block) =>
      block.type === 'tool_use' ? [{ id: block.id, name: block.name, input: block.input }] : [],
    );
    const stop = STOP[message.stop_reason ?? ''] ?? 'other';
    if (stop === 'tool_use' && toolCalls.length === 0) {
      throw new AiProviderError('invalid_output', 'Tool use without a tool call');
    }
    return {
      text,
      toolCalls,
      stop,
      fallback: (message.usage.iterations ?? []).some((entry) => entry.type === 'fallback_message'),
      raw: content,
    };
  }
}
