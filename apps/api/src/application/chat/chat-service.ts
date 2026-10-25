import { createHash, createHmac } from 'node:crypto';
import { redactContactData } from '@kaufcheck/domain';
import {
  CHAT_LIMITS,
  germanDay,
  type ChatJump,
  type ChatRequest,
  type ChatStreamEvent,
} from '@kaufcheck/shared';
import type { FastifyBaseLogger } from 'fastify';
import type {
  ChatModel,
  ChatModelMessage,
  ChatModelTurn,
  ChatToolResult,
} from '../../infrastructure/ai/chat-model';
import { AiProviderError } from '../../infrastructure/ai/types';
import { AppError, isAppError } from '../../lib/errors';
import { usageSubject, type Actor } from '../actor';
import { CHAT_SYSTEM_PROMPT, chatDateNote } from './chat-prompt';
import {
  looksLikePastedListing,
  topicJumps,
  type ChatTool,
  type ChatToolOutcome,
} from './chat-tools';
import type { ChatReservation, ChatUsageService } from './chat-usage';

/** Model calls per message: a tool or two, then the answer. */
const MAX_STEPS = 5;
const LISTING_TOOL = 'analyze_listing';
/** Pages to go on yourself under one answer. */
const MAX_JUMPS = 3;
/** A listing sent again (say, after an error) is not checked twice within this time. */
const RECENT_CHECK_MS = 15 * 60_000;
const RECENT_CHECKS_KEPT = 500;

export interface ChatServiceDeps {
  model: ChatModel;
  tools: readonly ChatTool[];
  usage: ChatUsageService;
  logger: FastifyBaseLogger;
  /** Keys the daily code that marks KaufCheck's own notes to the model. */
  secret: string;
  now?: () => Date;
}

export interface ChatRunContext {
  actor: Actor;
  signal: AbortSignal;
  emit: (event: ChatStreamEvent) => void;
}

/** What the visitor has seen of the answer so far: text not taken back, tools that worked. */
interface Shown {
  text: string;
  tools: number;
}

function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/**
 * A note of KaufCheck written into a listing (say, by a seller) is defused:
 * the model trusts only notes with the daily code, and none can start with
 * „[KaufCheck“ in what the visitor sends.
 */
function defuseNotes(text: string): string {
  return text.replace(/\[(\s*)(k\s*a\s*u\s*f\s*-?\s*c\s*h\s*e\s*c\s*k)/gi, '($1$2');
}

/**
 * The earlier conversation as the browser keeps it; facts from tools follow
 * the answer. Phone numbers, e-mail addresses and IBANs – a pasted listing is
 * full of them – never reach the AI provider; the tools read the original.
 */
function history(request: ChatRequest): ChatModelMessage[] {
  return request.messages.map((turn): ChatModelMessage =>
    turn.role === 'user'
      ? { role: 'user', text: defuseNotes(redactContactData(turn.content)) }
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

  /** Listing checks of the last minutes, by visitor and text. */
  private readonly recentChecks = new Map<string, { outcome: ChatToolOutcome; until: number }>();

  constructor(private readonly deps: ChatServiceDeps) {
    this.now = deps.now ?? (() => new Date());
    this.byName = new Map(deps.tools.map((tool) => [tool.spec.name, tool]));
  }

  /** Marks KaufCheck's own notes in a message; changes daily, never shown to anyone. */
  private noteCode(day: string): string {
    return createHmac('sha256', this.deps.secret)
      .update(`chat-note|${day}`)
      .digest('hex')
      .slice(0, 10);
  }

  private recentCheckKey(actor: Actor, text: string): string | null {
    const subject = usageSubject(actor);
    if (!subject) return null;
    return createHash('sha256')
      .update(`${subject.subjectType}:${subject.subjectId}\n${text}`)
      .digest('hex');
  }

  private rememberCheck(key: string, outcome: ChatToolOutcome): void {
    const now = this.now().getTime();
    for (const [stored, entry] of this.recentChecks)
      if (entry.until <= now || this.recentChecks.size >= RECENT_CHECKS_KEPT)
        this.recentChecks.delete(stored);
      else break;
    this.recentChecks.set(key, { outcome, until: now + RECENT_CHECK_MS });
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
    const day = germanDay(this.now());
    const code = this.noteCode(day);
    const contexts: string[] = [];
    let replaceUserMessage: string | null = null;
    let text = '';
    let separate = false;
    let fallback = false;
    let invalidRetries = 0;
    let shownCards = 0;
    /** Tools that run once per message, with what they answered. */
    const ran = new Map<string, ChatToolResult>();
    /** Pages of KaufCheck to go on yourself, from the tools that ran. */
    const jumps: ChatJump[] = [];
    /** Buttons to pages are an answer of their own: no further pages under it. */
    let linked = false;

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

    /** What a tool found: its card and page go to the browser, its result to the model. */
    const apply = (id: string, tool: ChatTool, outcome: ChatToolOutcome): ChatToolResult => {
      const result = { toolUseId: id, content: outcome.content, isError: outcome.isError ?? false };
      if (!outcome.isError) shown.tools += 1;
      if (tool.once) ran.set(tool.spec.name, result);
      if (outcome.card) {
        ctx.emit({ type: 'card', card: outcome.card });
        shownCards += 1;
        if (outcome.card.type === 'links') linked = true;
      }
      // Sent right away: should the answer fail, the page is still there.
      if (outcome.jump && !jumps.some((jump) => jump.href === outcome.jump?.href)) {
        jumps.push(outcome.jump);
        ctx.emit({ type: 'jump', jump: outcome.jump });
      }
      if (outcome.context) contexts.push(outcome.context);
      if (outcome.replaceUserMessage) replaceUserMessage = outcome.replaceUserMessage;
      return result;
    };

    /** Runs one tool call: its steps and card go to the browser, its result to the model. */
    const runTool = async (
      id: string,
      name: string,
      input: unknown,
    ): Promise<{ result: ChatToolResult; outcome?: ChatToolOutcome }> => {
      const tool = this.byName.get(name);
      if (!tool)
        return { result: { toolUseId: id, content: 'Unbekanntes Werkzeug.', isError: true } };
      const earlier = ran.get(tool.spec.name);
      if (earlier !== undefined) {
        return {
          result: {
            toolUseId: id,
            content: `Schon in dieser Nachricht aufgerufen: ${earlier.content}`,
            isError: earlier.isError,
          },
        };
      }
      ctx.emit({ type: 'tool', label: tool.label, status: 'started' });
      try {
        const outcome = await tool.run(input, {
          actor: ctx.actor,
          signal: ctx.signal,
          latestUserText: latest.content,
          now: this.now(),
        });
        ctx.emit({
          type: 'tool',
          label: tool.label,
          status: outcome.isError ? 'failed' : 'completed',
        });
        return { result: apply(id, tool, outcome), outcome };
      } catch (error) {
        if (ctx.signal.aborted) throw new AppError('REQUEST_ABORTED');
        this.deps.logger.warn({ err: error, tool: name }, 'chat tool failed');
        ctx.emit({ type: 'tool', label: tool.label, status: 'failed' });
        return {
          result: {
            toolUseId: id,
            content:
              'Das hat gerade nicht geklappt. Sag dem Nutzer, er soll es gleich noch einmal versuchen.',
            isError: true,
          },
        };
      }
    };

    // A pasted listing is checked right away – the model gets the result with the message
    // and never has to remember to ask for it. A failed check adds nothing: the model can
    // still call the tool and then reads why.
    const listingTool = this.byName.get(LISTING_TOOL);
    if (listingTool && looksLikePastedListing(latest.content)) {
      const key = this.recentCheckKey(ctx.actor, latest.content);
      const recent = key ? this.recentChecks.get(key) : undefined;
      let checked: ChatToolOutcome | undefined;
      if (recent && recent.until > this.now().getTime()) {
        apply('pasted-listing', listingTool, recent.outcome);
        checked = recent.outcome;
      } else {
        const { outcome } = await runTool('pasted-listing', LISTING_TOOL, {});
        if (outcome && !outcome.isError) {
          checked = outcome;
          if (key) this.rememberCheck(key, outcome);
        }
      }
      const last = messages[messages.length - 1];
      if (checked && last?.role === 'user') {
        messages[messages.length - 1] = {
          role: 'user',
          text: `${last.text}\n\n[KaufCheck-Prüfung ${code}] Ergebnis der Prüfung dieses Inserats; die Karte damit sieht der Nutzer unter deiner Antwort:\n${checked.content}`,
        };
      }
    }

    for (let step = 0; step < MAX_STEPS; step += 1) {
      const mark = text.length;
      const separateBefore = separate;
      let turn: ChatModelTurn;
      try {
        turn = await this.deps.model.turn({
          system: { stable: CHAT_SYSTEM_PROMPT, dynamic: chatDateNote(day, code) },
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
      for (const call of turn.toolCalls)
        results.push((await runTool(call.id, call.name, call.input)).result);
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
      // Not happy with the answer? Do it yourself in the tool of KaufCheck.
      jumps: (jumps.length > 0 ? jumps : linked ? [] : topicJumps(latest.content, text)).slice(
        0,
        MAX_JUMPS,
      ),
      fallbackModel: fallback,
    };
  }
}
