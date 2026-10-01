import {
  CANCEL_PATH,
  contractTerms,
  documentToText,
  formatCents,
  formatLegalDateTime,
  noticeLines,
  noticeOutcomeText,
  operatorLine,
  PRO_PRODUCT_NAME,
  termsOfService,
  vatNote,
  withdrawalForm,
  withdrawalPolicy,
  WITHDRAW_PATH,
  type ContractNoticeReceipt,
  type LegalContext,
  type ProOffer,
  type VatMode,
} from '@kaufcheck/shared';
import type { EmailMessage } from '../infrastructure/email/email-service';

const RULE = '────────────────────────────────────────';

function signature({ operator, siteUrl }: LegalContext): string {
  return ['Viele Grüße', 'KaufCheck', '', operatorLine(operator), siteUrl].join('\n');
}

function message(context: LegalContext, to: string, subject: string, body: string[]): EmailMessage {
  return {
    to,
    subject,
    text: [...body, '', signature(context)].join('\n'),
    replyTo: context.operator.email,
  };
}

export interface OrderFacts {
  number: string;
  email: string;
  priceCents: number;
  createdAt: Date;
}

/** § 312i Abs. 1 Satz 1 Nr. 3 BGB: confirms that the order arrived – not yet the contract. */
export function orderReceiptEmail(
  context: LegalContext,
  order: OrderFacts,
  offer: ProOffer,
): EmailMessage {
  return message(context, order.email, `Deine Bestellung ${order.number} ist eingegangen`, [
    'Hallo,',
    '',
    'wir haben deine Bestellung erhalten. Das ist eine Eingangsbestätigung: Der Vertrag kommt erst zustande, wenn du die Zahlung bei Stripe abgeschlossen hast und wir dir den Vertragsschluss bestätigen.',
    '',
    `Bestellnummer: ${order.number}`,
    `Eingegangen am: ${formatLegalDateTime(order.createdAt)}`,
    `Produkt: ${PRO_PRODUCT_NAME}`,
    `Preis: ${formatCents(order.priceCents)} pro Monat. ${vatNote(offer.vatMode)}`,
    `Konto: ${order.email}`,
    '',
    `Brichst du die Zahlung ab, entstehen dir keine Kosten. Du kannst jederzeit neu bestellen: ${context.siteUrl}/pro`,
    '',
    'Fragen? Antworte einfach auf diese E-Mail.',
  ]);
}

export interface ContractFacts extends OrderFacts {
  vatMode: VatMode;
  concludedAt: Date;
  termsAcceptedAt: Date;
  consentTexts: { acceptTerms: string; requestImmediateStart: string };
}

/**
 * § 312f Abs. 2 BGB: the contract on a durable medium with all information
 * of Art. 246a EGBGB – terms, withdrawal notice and model form included.
 */
export function contractConfirmationEmail(
  context: LegalContext,
  contract: ContractFacts,
  features: readonly string[],
): EmailMessage {
  const { siteUrl } = context;
  return message(
    context,
    contract.email,
    `Vertragsbestätigung KaufCheck Pro – Bestellung ${contract.number}`,
    [
      'Hallo,',
      '',
      'vielen Dank! Dein Vertrag über KaufCheck Pro ist geschlossen. Mit dieser E-Mail bestätigen wir dir den Vertrag und schicken dir die Vertragsbedingungen. Bitte bewahre sie auf.',
      '',
      'DEIN VERTRAG',
      `Bestellnummer: ${contract.number}`,
      `Vertragsschluss: ${formatLegalDateTime(contract.concludedAt)}`,
      `Vertragspartner: ${operatorLine(context.operator)}`,
      `Konto: ${contract.email}`,
      `Produkt: ${PRO_PRODUCT_NAME}`,
      '',
      'Leistungsumfang:',
      ...features.map((feature) => `– ${feature}`),
      '',
      ...contractTerms(contract).map((term) => `${term.label}: ${term.value}`),
      '',
      `Deine Erklärungen bei der Bestellung (${formatLegalDateTime(contract.termsAcceptedAt)}):`,
      `– „${contract.consentTexts.acceptTerms}“`,
      `– „${contract.consentTexts.requestImmediateStart}“`,
      '',
      `Widerruf: Du kannst den Vertrag binnen 14 Tagen ab Vertragsschluss widerrufen, online unter ${siteUrl}${WITHDRAW_PATH}. Einzelheiten stehen in der Widerrufsbelehrung unten.`,
      `Kündigung: jederzeit zum Ende des Abrechnungsmonats unter ${siteUrl}${CANCEL_PATH} oder in deinem Konto unter „Abo verwalten“.`,
      '',
      RULE,
      documentToText(termsOfService(context)),
      '',
      RULE,
      documentToText(withdrawalPolicy(context)),
      '',
      RULE,
      documentToText(withdrawalForm(context)),
      RULE,
    ],
  );
}

/** § 312k Abs. 4 BGB (cancellation) and § 356a Abs. 4 BGB (withdrawal). */
export function noticeConfirmationEmail(
  context: LegalContext,
  receipt: ContractNoticeReceipt,
  to: string,
): EmailMessage {
  const cancellation = receipt.type === 'cancellation';
  return message(
    context,
    to,
    cancellation
      ? `Bestätigung deiner Kündigung ${receipt.number}`
      : `Eingangsbestätigung deines Widerrufs ${receipt.number}`,
    [
      `Hallo ${receipt.name},`,
      '',
      cancellation
        ? 'deine Kündigung ist bei uns eingegangen. Das ist deine Erklärung mit allen Angaben:'
        : 'dein Widerruf ist bei uns eingegangen. Das ist deine Erklärung mit allen Angaben:',
      '',
      ...noticeLines(receipt),
      '',
      noticeOutcomeText(receipt),
    ],
  );
}

export interface OperatorNoticeFacts {
  account: string | null;
  subscriptionId: string | null;
  orderNumber: string | null;
  /** Withdrawal: what to refund. */
  refund: { paidCents: number; keptCents: number; days: number; periodDays: number } | null;
  problem: string | null;
}

/** Tells the operator what needs to be done by hand. */
export function operatorNoticeEmail(
  context: LegalContext,
  receipt: ContractNoticeReceipt,
  facts: OperatorNoticeFacts,
): EmailMessage {
  const withdrawal = receipt.type === 'withdrawal';
  const todo: string[] = [];
  if (withdrawal && receipt.outcome === 'withdrawn' && facts.refund) {
    const refund = facts.refund.paidCents - facts.refund.keptCents;
    todo.push(
      `Erstatte innerhalb von 14 Tagen ${formatCents(refund)} im Stripe-Dashboard (Zahlungen → Zahlung des Kunden → Erstatten).`,
      `Rechnung: gezahlt ${formatCents(facts.refund.paidCents)}, Wertersatz ${formatCents(facts.refund.keptCents)} für ${facts.refund.days} von ${facts.refund.periodDays} Tagen. Du kannst auch den vollen Betrag erstatten.`,
    );
  } else if (withdrawal) {
    todo.push(
      'Prüfe den Widerruf: Finde den Vertrag, beende das Abo im Stripe-Dashboard sofort und erstatte den Betrag (abzüglich Wertersatz für die Tage bis zum Widerruf) innerhalb von 14 Tagen ab Eingang.',
    );
  } else if (receipt.kind === 'extraordinary') {
    todo.push(
      'Prüfe den Grund der außerordentlichen Kündigung und antworte der Person. Die ordentliche Kündigung zum Ende des Abrechnungsmonats ist bereits eingetragen, falls ein Abo gefunden wurde.',
    );
  } else {
    todo.push(
      'Die Kündigung ließ sich keinem laufenden Abo zuordnen. Suche den Kunden im Stripe-Dashboard, kündige dort zum Ende des Abrechnungsmonats und antworte der Person.',
    );
  }
  return {
    to: context.operator.email,
    subject: `[KaufCheck] ${withdrawal ? 'Widerruf' : 'Kündigung'} ${receipt.number} – bitte bearbeiten`,
    text: [
      ...noticeLines(receipt),
      '',
      `Konto: ${facts.account ?? 'nicht gefunden'}`,
      `Stripe-Abo: ${facts.subscriptionId ?? 'nicht gefunden'}`,
      `Bestellung: ${facts.orderNumber ?? 'nicht gefunden'}`,
      `Ergebnis: ${receipt.outcome}${facts.problem ? ` (${facts.problem})` : ''}`,
      `Bestätigung an die Person: ${receipt.confirmationSent ? 'gesendet' : 'NICHT gesendet – bitte selbst bestätigen'}`,
      '',
      'Zu tun:',
      ...todo.map((line) => `– ${line}`),
    ].join('\n'),
    replyTo: receipt.email,
  };
}
