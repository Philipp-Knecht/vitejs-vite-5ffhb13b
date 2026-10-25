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
  /** Told why the API rejected a request (no message content, only the API's reason). */
  onRejected?: (detail: string) => void;
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
  private readonly onRejected: (detail: string) => void;
  /**
   * After the API rejected the full request once, the chat runs with the
   * basic form (no strict schemas, eager tool streaming, automatic caching or
   * refusal fallback) until the next restart.
   */
  private basic = false;

  constructor(options: AnthropicChatModelOptions) {
    this.model = options.model;
    this.effort = options.effort;
    this.features = claudeModelFeatures(options.model);
    this.client = options.client ?? new Anthropic({ apiKey: options.apiKey, maxRetries: 1 });
    this.onRejected = options.onRejected ?? (() => undefined);
  }

  private body(request: ChatModelRequest, basic: boolean) {
    return {
      model: this.model,
      max_tokens: MAX_TOKENS[this.effort],
      // The conversation so far is cached too: the next step and the next message read it.
      ...(basic ? {} : { cache_control: { type: 'ephemeral' as const } }),
      thinking: { type: 'adaptive' as const },
      ...(this.features.effort ? { output_config: { effort: this.effort } } : {}),
      ...(this.features.refusalFallbacks && !basic
        ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }
        : {}),
      system: [
        {
          type: 'text' as const,
          text: request.system.stable,
          cache_control: { type: 'ephemeral' as const },
        },
        { type: 'text' as const, text: request.system.dynamic },
      ],
      tools: request.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.inputSchema as Anthropic.Beta.BetaTool.InputSchema,
        ...(basic ? {} : { strict: tool.strict, eager_input_streaming: true }),
      })),
      messages: request.messages.map(toParam),
    };
  }

  private async send(
    request: ChatModelRequest,
    basic: boolean,
  ): Promise<Anthropic.Beta.BetaMessage> {
    const stream = this.client.beta.messages.stream(this.body(request, basic), {
      signal: request.signal,
      timeout: 90_000,
    });
    stream.on('text', (delta) => request.onText(delta));
    return stream.finalMessage();
  }

  async turn(request: ChatModelRequest): Promise<ChatModelTurn> {
    let message: Anthropic.Beta.BetaMessage;
    try {
      try {
        message = await this.send(request, this.basic);
      } catch (error) {
        // Rejected before any output: tell why and try the basic form once.
        if (this.basic || !(error instanceof Anthropic.BadRequestError)) throw error;
        this.onRejected(error.message.slice(0, 500));
        this.basic = true;
        message = await this.send(request, true);
      }
    } catch (error) {
      if (error instanceof Anthropic.APIError && !(error instanceof Anthropic.APIUserAbortError))
        this.onRejected(`${error.status ?? 'no status'}: ${error.message.slice(0, 500)}`);
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
