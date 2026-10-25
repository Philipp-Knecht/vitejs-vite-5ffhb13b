/**
 * The language model behind the chat assistant, independent of the SDK: one
 * call is one model turn that streams text and may ask for tools. The chat
 * service runs the loop and the tools.
 */

/** A tool the model may call; `inputSchema` is JSON Schema with `additionalProperties: false`. */
export interface ChatToolSpec {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  /**
   * The model's input always matches the schema. The API caps strict schemas
   * per request (24 optional parameters in all), so tools with many optional
   * fields rely on their own validation instead.
   */
  strict: boolean;
}

export interface ChatToolCall {
  id: string;
  name: string;
  input: unknown;
}

export interface ChatToolResult {
  toolUseId: string;
  content: string;
  isError: boolean;
}

export type ChatModelMessage =
  | { role: 'user'; text: string }
  /** An answer from an earlier turn, as text. */
  | { role: 'assistant'; text: string }
  /** The model's own turn within this answer, passed back unchanged (with its tool calls). */
  | { role: 'assistant_turn'; turn: ChatModelTurn }
  | { role: 'tool_results'; results: ChatToolResult[] };

export interface ChatModelTurn {
  text: string;
  toolCalls: ChatToolCall[];
  /** `end`: answered; `tool_use`: wants tools; the rest end the answer early. */
  stop: 'end' | 'tool_use' | 'max_tokens' | 'refusal' | 'other';
  /** True when another model answered because the first one declined. */
  fallback: boolean;
  /** The provider's own content blocks, to send back unchanged. */
  raw: unknown;
}

export interface ChatModelRequest {
  /** `stable` is cached with the tools; `dynamic` (e.g. today's date) follows it. */
  system: { stable: string; dynamic: string };
  tools: readonly ChatToolSpec[];
  messages: readonly ChatModelMessage[];
  signal: AbortSignal;
  onText: (delta: string) => void;
}

export interface ChatModel {
  readonly model: string;
  readonly isMock: boolean;
  turn(request: ChatModelRequest): Promise<ChatModelTurn>;
}
