import { z } from 'zod';
import { EmailSchema } from './email';

export const VAT_MODES = ['small_business', 'standard'] as const;
export type VatMode = (typeof VAT_MODES)[number];

export const PAYMENT_METHODS = ['card', 'sepa_debit', 'paypal'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** The Pro offer as charged by the payment provider: a monthly gross price in euros. */
export const ProOfferSchema = z.object({
  priceCents: z.number().int().positive(),
  currency: z.literal('eur'),
  interval: z.literal('month'),
  vatMode: z.enum(VAT_MODES),
  paymentMethods: z.array(z.enum(PAYMENT_METHODS)).min(1),
});
export type ProOffer = z.infer<typeof ProOfferSchema>;

export const OrderRequestSchema = z.object({
  acceptTerms: z.literal(true, 'Bitte akzeptiere die AGB.'),
  requestImmediateStart: z.literal(
    true,
    'Bitte bestätige, dass Pro sofort nach Vertragsschluss beginnen soll.',
  ),
});
export type OrderRequest = z.infer<typeof OrderRequestSchema>;

export const ORDER_STATUSES = ['pending', 'concluded', 'abandoned'] as const;

export const OrderDtoSchema = z.object({
  number: z.string(),
  status: z.enum(ORDER_STATUSES),
  email: z.string(),
  priceCents: z.number().int(),
  vatMode: z.enum(VAT_MODES),
  createdAt: z.string(),
  concludedAt: z.string().nullable(),
  /** Last day of the withdrawal period (end of day, Europe/Berlin); null until concluded. */
  withdrawalEndsAt: z.string().nullable(),
});
export type OrderDto = z.infer<typeof OrderDtoSchema>;

export const OrderCreatedSchema = z.object({ number: z.string(), url: z.string() });
export type OrderCreated = z.infer<typeof OrderCreatedSchema>;

const NameSchema = z
  .string()
  .trim()
  .min(2, 'Bitte gib deinen Namen an.')
  .max(120, 'Der Name ist zu lang.');
const OrderNumberSchema = z
  .string()
  .trim()
  .toUpperCase()
  .max(40, 'Die Bestellnummer ist zu lang.')
  .optional()
  .transform((value) => (value ? value : undefined));

export const CANCELLATION_KINDS = ['ordinary', 'extraordinary'] as const;
export type CancellationKind = (typeof CANCELLATION_KINDS)[number];

/** § 312k Abs. 2 BGB: kind and reason, identification, contract, end date, e-mail for the confirmation. */
export const CancellationRequestSchema = z
  .object({
    kind: z.enum(CANCELLATION_KINDS),
    reason: z
      .string()
      .trim()
      .max(2000, 'Der Grund ist zu lang.')
      .optional()
      .transform((value) => (value ? value : undefined)),
    name: NameSchema,
    email: EmailSchema,
    orderNumber: OrderNumberSchema,
    /** Requested end of the contract (YYYY-MM-DD); empty = earliest possible date. */
    endDate: z.iso
      .date('Bitte gib ein gültiges Datum an.')
      .optional()
      .or(z.literal('').transform(() => undefined)),
  })
  .refine((value) => value.kind === 'ordinary' || Boolean(value.reason), {
    path: ['reason'],
    message: 'Bitte nenne den Grund für die außerordentliche Kündigung.',
  });
export type CancellationRequest = z.infer<typeof CancellationRequestSchema>;

/** § 356a Abs. 2 BGB: name, contract, electronic address for the receipt. */
export const WithdrawalRequestSchema = z.object({
  name: NameSchema,
  email: EmailSchema,
  orderNumber: OrderNumberSchema,
});
export type WithdrawalRequest = z.infer<typeof WithdrawalRequestSchema>;

export const CONTRACT_NOTICE_OUTCOMES = [
  /** The subscription ends at `effectiveEnd`. */
  'scheduled',
  /** The subscription ends with the billing month that contains the requested date. */
  'scheduled_later',
  /** The subscription was already set to end (or has ended) at `effectiveEnd`. */
  'already_ending',
  /** Withdrawal: the subscription has been ended; the refund follows. */
  'withdrawn',
  /** We check the declaration ourselves and get back to the consumer. */
  'review',
] as const;
export type ContractNoticeOutcome = (typeof CONTRACT_NOTICE_OUTCOMES)[number];

/** What the consumer sees (and can save) after sending a cancellation or withdrawal. */
export const ContractNoticeReceiptSchema = z.object({
  number: z.string(),
  type: z.enum(['cancellation', 'withdrawal']),
  receivedAt: z.string(),
  name: z.string(),
  email: z.string(),
  contract: z.string(),
  kind: z.enum(CANCELLATION_KINDS).nullable(),
  reason: z.string().nullable(),
  requestedEndDate: z.string().nullable(),
  outcome: z.enum(CONTRACT_NOTICE_OUTCOMES),
  /** When the contract ends (or ended); null if not known yet. */
  effectiveEnd: z.string().nullable(),
  /** Whether the confirmation e-mail was sent. */
  confirmationSent: z.boolean(),
});
export type ContractNoticeReceipt = z.infer<typeof ContractNoticeReceiptSchema>;
