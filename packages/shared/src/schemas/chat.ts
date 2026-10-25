import { z } from 'zod';
import { MAX_LISTING_TEXT_LENGTH } from '../constants';
import { PRICE_ADVICE_ACTIONS, PRICE_VERDICTS } from '../labels';
import { ApiErrorSchema } from './errors';

/**
 * The chat assistant on the start page. The browser keeps the conversation
 * and sends it with each message; the server stores none of it, it only
 * counts messages per day.
 */
export const CHAT_LIMITS = {
  /** One message: as long as a listing the check takes. */
  messageChars: MAX_LISTING_TEXT_LENGTH,
  /** Facts from the tools of one answer, kept for follow-up questions. */
  contextChars: 4_000,
  /** Older messages are dropped by the browser first. */
  historyMessages: 24,
  historyChars: 40_000,
} as const;

export const ChatTurnSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(CHAT_LIMITS.messageChars),
  /** Assistant turns only: what the tools found, for follow-up questions. */
  context: z.string().max(CHAT_LIMITS.contextChars).optional(),
});
export type ChatTurn = z.infer<typeof ChatTurnSchema>;

export const ChatRequestSchema = z.object({
  messages: z
    .array(ChatTurnSchema)
    .min(1)
    .max(CHAT_LIMITS.historyMessages)
    .refine((turns) => turns[turns.length - 1]?.role === 'user', {
      message: 'Die letzte Nachricht muss von dir sein.',
    })
    .refine(
      (turns) =>
        turns.reduce((sum, turn) => sum + turn.content.length + (turn.context?.length ?? 0), 0) <=
        CHAT_LIMITS.historyChars,
      { message: 'Der Verlauf ist zu lang.' },
    ),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

/** Input fields the assistant can put into the chat. */
export const CHAT_FORMS = ['search', 'financing', 'tax', 'rdw'] as const;
export type ChatForm = (typeof CHAT_FORMS)[number];

const LinkSchema = z.object({ label: z.string(), href: z.string() });
/** A page of KaufCheck: a button under an answer or in a card. */
export type ChatJump = z.infer<typeof LinkSchema>;

/** Results of the tools, shown as cards; built by the server from KaufCheck's own data only. */
export const ChatCardSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('analysis'),
    analysisId: z.string(),
    title: z.string(),
    priceDisplay: z.string().nullable(),
    verdict: z.enum(PRICE_VERDICTS).nullable(),
    advice: z
      .object({
        action: z.enum(PRICE_ADVICE_ACTIONS),
        title: z.string(),
        text: z.string(),
        targetPriceEur: z.number().int().positive().nullable(),
      })
      .nullable(),
    warnings: z.array(z.string()),
    questions: z.array(z.string()),
  }),
  z.object({
    type: z.literal('search'),
    summary: z.string(),
    /** KaufCheck's own search page with these filters. */
    findUrl: z.string(),
    links: z.array(z.object({ name: z.string(), url: z.string(), applied: z.array(z.string()) })),
  }),
  z.object({
    type: z.literal('tax'),
    /** Annual tax; null while exempt. */
    annualEur: z.number().int().nonnegative().nullable(),
    /** End of the exemption as shown, e.g. „31.12.2030“ or „03/2026 (je nach Tag …)“. */
    exemptUntil: z.string().nullable(),
    rule: z.string(),
    inputs: z.array(z.object({ label: z.string(), value: z.string() })),
    calculatorUrl: z.string(),
  }),
  z.object({
    type: z.literal('financing'),
    priceEur: z.number(),
    downPaymentEur: z.number(),
    amountEur: z.number(),
    months: z.number().int(),
    ratePercent: z.number(),
    /** Without a rate from the user: the Bundesbank's average rate. */
    averageRate: z.boolean(),
    monthlyRate: z.number(),
    totalInterest: z.number(),
    totalPaid: z.number(),
    calculatorUrl: z.string(),
  }),
  z.object({
    type: z.literal('model'),
    modelId: z.string(),
    name: z.string(),
    generation: z.string().nullable(),
    issues: z.array(z.object({ title: z.string(), severity: z.string() })),
    url: z.string(),
  }),
  z.object({
    type: z.literal('advisor'),
    items: z.array(
      z.object({ name: z.string(), detail: z.string(), url: z.string(), searchUrl: z.string() }),
    ),
  }),
  z.object({
    type: z.literal('rdw'),
    plate: z.string(),
    title: z.string(),
    facts: z.array(z.object({ label: z.string(), value: z.string() })),
    warnings: z.array(z.string()),
  }),
  z.object({ type: z.literal('links'), links: z.array(LinkSchema) }),
  z.object({
    type: z.literal('form'),
    form: z.enum(CHAT_FORMS),
    prefill: z.record(z.string(), z.union([z.string(), z.number()])),
  }),
]);
export type ChatCard = z.infer<typeof ChatCardSchema>;

export const ChatUsageSchema = z.object({
  used: z.number().int().nonnegative(),
  limit: z.number().int().nonnegative(),
  /** The German day the count starts again, „YYYY-MM-DD“. */
  resetsOn: z.string(),
});
export type ChatUsage = z.infer<typeof ChatUsageSchema>;

/** The answer streams as NDJSON: text pieces, tool steps and cards, then `done` or `error`. */
export const ChatStreamEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), delta: z.string() }),
  /** The text from `length` on is withdrawn: a step was repeated or declined. */
  z.object({ type: z.literal('retract'), length: z.number().int().nonnegative() }),
  z.object({
    type: z.literal('tool'),
    /** What the assistant is doing, e.g. „Prüfe das Inserat“. */
    label: z.string(),
    status: z.enum(['started', 'completed', 'failed']),
  }),
  z.object({ type: z.literal('card'), card: ChatCardSchema }),
  z.object({
    type: z.literal('done'),
    /** The assistant turn to keep and send back with the next message. */
    turn: ChatTurnSchema,
    /** A shorter version of the last user message to keep instead (a pasted listing). */
    replaceUserMessage: z.string().max(CHAT_LIMITS.messageChars).nullable(),
    /** Pages of KaufCheck to do it yourself, e.g. the calculator the answer used. */
    jumps: z.array(LinkSchema).max(3),
    usage: ChatUsageSchema,
    /** True when another Claude model answered because the first one declined. */
    fallbackModel: z.boolean(),
  }),
  z.object({ type: z.literal('error'), error: ApiErrorSchema }),
]);
export type ChatStreamEvent = z.infer<typeof ChatStreamEventSchema>;
