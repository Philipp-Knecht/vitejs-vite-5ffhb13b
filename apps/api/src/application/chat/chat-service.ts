import { redactContactData } from '@kaufcheck/domain';
import { CHAT_LIMITS, germanDay, type ChatRequest, type ChatStreamEvent } from '@kaufcheck/shared';
import type { FastifyBaseLogger } from 'fastify';
import type {
  ChatModel,
  ChatModelMessage,
  ChatModelTurn,
  ChatToolResult,
} from '../../infrastructure/ai/chat-model';
import { AiProviderError } from '../../infrastructure/ai/types';
import { AppError, isAppError } from '../../lib/errors';
import type { Actor } from '../actor';
import { CHAT_SYSTEM_PROMPT, chatDateNote } from './chat-prompt';
import type { ChatTool } from './chat-tools';
import type { ChatReservation, ChatUsageService } from './chat-usage';

/** Model calls per message: a tool or two, then the answer. */
const MAX_STEPS = 5;

export interface ChatServiceDeps {
  model: ChatModel;
  tools: readonly ChatTool[];
  usage: ChatUsageService;
  logger: FastifyBaseLogger;
  now?: () => Date;
}

export interface ChatRunContext {
  actor: Actor;
  signal: AbortSignal;
  emit: (event: ChatStreamEvent) => void;
}

/** What the visitor has seen of the answer so far. */
interface Shown {
  text: string;
  tools: number;
}

function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/**
 * The earlier conversation as the browser keeps it; facts from tools follow
 * the answer. Phone numbers, e-mail addresses and IBANs – a pasted listing is
 * full of them – never reach the AI provider; the tools read the original.
 */
function history(request: ChatRequest): ChatModelMessage[] {
  return request.messages.map((turn): ChatModelMessage =>
    turn.role === 'user'
      ? { role: 'user', text: redactContactData(turn.content) }
      : {
          role: 'assistant',
          text: turn.context
            ? `${turn.content}\n\n[Ergebnisse der Werkzeuge: ${turn.context}]`
            : turn.content,
        },
  );
}

function providerError(error: unknown): AppError {
  if (isAppError(error)) return error;
  if (error instanceof AiProviderError && error.reason === 'aborted')
    return new AppError('REQUEST_ABORTED');
  if (error instanceof AiProviderError && error.reason === 'rate_limited') {
    return new AppError('SERVICE_UNAVAILABLE', {
      message:
        'Der Assistent ist gerade ausgelastet. Bitte versuch es in einer Minute noch einmal.',
      internalReason: 'chat_rate_limited',
      cause: error,
    });
  }
  return new AppError('SERVICE_UNAVAILABLE', {
    message: 'Der Assistent ist gerade nicht erreichbar. Bitte versuch es gleich noch einmal.',
    internalReason: error instanceof AiProviderError ? `chat_${error.reason}` : 'chat_failed',
    cause: error,
  });
}

/**
 * The chat assistant: one message in, a streamed answer out. The model may
 * call KaufCheck's own functions as tools; their results go to the browser as
 * cards. Counts the message against the daily limit and gives it back when
 * no answer came.
 */
export class ChatService {
  private readonly now: () => Date;
  private readonly byName: Map<string, ChatTool>;

  constructor(private readonly deps: ChatServiceDeps) {
    this.now = deps.now ?? (() => new Date());
    this.byName = new Map(deps.tools.map((tool) => [tool.spec.name, tool]));
  }

  get model(): ChatModel {
    return this.deps.model;
  }

  /** Counts the message against the daily limits; throws when one is reached. */
  reserve(actor: Actor, address: string): Promise<ChatReservation> {
    return this.deps.usage.reserve(actor, address);
  }

  /** Answers one message; gives the reserved message back when no answer came. */
  async run(
    request: ChatRequest,
    reservation: ChatReservation,
    ctx: ChatRunContext,
  ): Promise<void> {
    const shown: Shown = { text: '', tools: 0 };
    try {
      await this.answer(request, ctx, shown).then((done) =>
        ctx.emit({ ...done, usage: reservation.usage }),
      );
    } catch (error) {
      // Nothing the visitor can use (text taken back, no tool ran): the message does not count.
      const empty = isAppError(error) && error.internalReason === 'chat_empty_answer';
      if (empty || (!shown.text.trim() && shown.tools === 0))
        await reservation.release().catch(() => undefined);
      throw providerError(error);
    }
  }

  private async answer(
    request: ChatRequest,
    ctx: ChatRunContext,
    shown: Shown,
  ): Promise<Omit<Extract<ChatStreamEvent, { type: 'done' }>, 'usage'>> {
    const latest = request.messages[request.messages.length - 1]!;
    const messages = history(request);
    const contexts: string[] = [];
    let replaceUserMessage: string | null = null;
    let text = '';
    let separate = false;
    let fallback = false;
    let invalidRetries = 0;
    let shownCards = 0;
    /** Tools that run once per message, with what they answered. */
    const ran = new Map<string, ChatToolResult>();

    /** Takes back what a step wrote: it is repeated or was declined. */
    const retract = (length: number, separateBefore: boolean) => {
      separate = separateBefore;
      if (text.length <= length) return;
      text = text.slice(0, length);
      shown.text = text;
      ctx.emit({ type: 'retract', length });
    };

    const onText = (delta: string) => {
      if (!delta) return;
      if (separate && text) {
        text += '\n\n';
        ctx.emit({ type: 'text', delta: '\n\n' });
      }
      separate = false;
      text += delta;
      shown.text = text;
      ctx.emit({ type: 'text', delta });
    };

    for (let step = 0; step < MAX_STEPS; step += 1) {
      const mark = text.length;
      const separateBefore = separate;
      let turn: ChatModelTurn;
      try {
        turn = await this.deps.model.turn({
          system: { stable: CHAT_SYSTEM_PROMPT, dynamic: chatDateNote(germanDay(this.now())) },
          tools: [...this.byName.values()].map((tool) => tool.spec),
          messages,
          signal: ctx.signal,
          onText,
        });
      } catch (error) {
        // A tool input that is no JSON at all: ask the model once more, never twice.
        if (
          error instanceof AiProviderError &&
          error.reason === 'invalid_output' &&
          invalidRetries < 1
        ) {
          invalidRetries += 1;
          retract(mark, separateBefore);
          continue;
        }
        throw error;
      }
      fallback ||= turn.fallback;

      if (turn.stop === 'refusal') {
        // A declined step's partial text is not kept; a later step says that it stopped.
        retract(mark, separateBefore);
        separate = true;
        onText(
          text
            ? 'Weiter kann ich dabei leider nicht helfen.'
            : 'Dabei kann ich leider nicht helfen. Frag mich gern etwas rund ums Auto.',
        );
        break;
      }
      // A tool input cut off at max_tokens can look complete: never run it.
      if (turn.stop !== 'tool_use' || turn.toolCalls.length === 0) break;

      messages.push({ role: 'assistant_turn', turn });
      const results: ChatToolResult[] = [];
      for (const call of turn.toolCalls) {
        const tool = this.byName.get(call.name);
        if (!tool) {
          results.push({ toolUseId: call.id, content: 'Unbekanntes Werkzeug.', isError: true });
          continue;
        }
        const earlier = ran.get(tool.spec.name);
        if (earlier !== undefined) {
          results.push({
            toolUseId: call.id,
            content: `Schon in dieser Nachricht aufgerufen: ${earlier.content}`,
            isError: earlier.isError,
          });
          continue;
        }
        ctx.emit({ type: 'tool', label: tool.label, status: 'started' });
        shown.tools += 1;
        try {
          const outcome = await tool.run(call.input, {
            actor: ctx.actor,
            signal: ctx.signal,
            latestUserText: latest.content,
            now: this.now(),
          });
          results.push({
            toolUseId: call.id,
            content: outcome.content,
            isError: outcome.isError ?? false,
          });
          ctx.emit({
            type: 'tool',
            label: tool.label,
            status: outcome.isError ? 'failed' : 'completed',
          });
          if (tool.once)
            ran.set(tool.spec.name, {
              toolUseId: call.id,
              content: outcome.content,
              isError: outcome.isError ?? false,
            });
          if (outcome.card) {
            ctx.emit({ type: 'card', card: outcome.card });
            shownCards += 1;
          }
          if (outcome.context) contexts.push(outcome.context);
          if (outcome.replaceUserMessage) replaceUserMessage = outcome.replaceUserMessage;
        } catch (error) {
          if (ctx.signal.aborted) throw new AppError('REQUEST_ABORTED');
          this.deps.logger.warn({ err: error, tool: call.name }, 'chat tool failed');
          ctx.emit({ type: 'tool', label: tool.label, status: 'failed' });
          results.push({
            toolUseId: call.id,
            content:
              'Das hat gerade nicht geklappt. Sag dem Nutzer, er soll es gleich noch einmal versuchen.',
            isError: true,
          });
        }
      }
      messages.push({ role: 'tool_results', results });
      separate = true;
    }

    if (!text.trim()) {
      // Nothing to show (say, all tokens went into thinking): the message does not count.
      if (shownCards === 0)
        throw new AppError('SERVICE_UNAVAILABLE', {
          message:
            'Darauf habe ich gerade keine Antwort gefunden. Versuch es bitte noch einmal, gern etwas anders formuliert.',
          internalReason: 'chat_empty_answer',
        });
      onText('Hier ist das Ergebnis.');
    }
    return {
      type: 'done',
      turn: {
        role: 'assistant',
        content: clip(text.trim(), CHAT_LIMITS.messageChars),
        ...(contexts.length > 0
          ? { context: clip(contexts.join(' | '), CHAT_LIMITS.contextChars) }
          : {}),
      },
      replaceUserMessage: replaceUserMessage
        ? clip(replaceUserMessage, CHAT_LIMITS.messageChars)
        : null,
      fallbackModel: fallback,
    };
  }
}
