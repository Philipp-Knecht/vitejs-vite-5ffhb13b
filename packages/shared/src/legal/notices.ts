import type { ContractNoticeReceipt } from '../schemas/contracts';
import { formatLegalDay, formatLegalDate, formatLegalDateTime } from './offer';

/** Exact labels of the cancellation (§ 312k BGB) and withdrawal (§ 356a BGB) buttons. */
export const CANCEL_BUTTON_LABEL = 'Verträge hier kündigen';
export const CANCEL_CONFIRM_LABEL = 'jetzt kündigen';
export const WITHDRAW_BUTTON_LABEL = 'Vertrag widerrufen';
export const WITHDRAW_CONFIRM_LABEL = 'Widerruf bestätigen';

/** The withdrawal declaration, worded like the official model form. */
export function withdrawalDeclaration(contract: string): string {
  return `Hiermit widerrufe ich den von mir abgeschlossenen Vertrag über die Erbringung der folgenden Dienstleistung: ${contract}.`;
}

export interface NoticeField {
  label: string;
  value: string;
}

/**
 * The declaration with date and time of receipt – shown on the receipt
 * page (to save), in the confirmation e-mail and to the operator.
 */
export function noticeFields(receipt: ContractNoticeReceipt): NoticeField[] {
  const cancellation = receipt.type === 'cancellation';
  const fields: NoticeField[] = [
    { label: 'Referenz', value: receipt.number },
    {
      label: 'Eingegangen am',
      value: cancellation
        ? `${formatLegalDateTime(receipt.receivedAt)}, abgegeben über die Schaltfläche „${CANCEL_CONFIRM_LABEL}“`
        : `${formatLegalDateTime(receipt.receivedAt)}, übermittelt über die Schaltfläche „${WITHDRAW_CONFIRM_LABEL}“`,
    },
  ];
  if (cancellation) {
    fields.push({
      label: 'Art der Kündigung',
      value:
        receipt.kind === 'extraordinary' ? 'außerordentliche Kündigung' : 'ordentliche Kündigung',
    });
    if (receipt.reason) fields.push({ label: 'Grund', value: receipt.reason });
  } else {
    fields.push({ label: 'Erklärung', value: `„${withdrawalDeclaration(receipt.contract)}“` });
  }
  fields.push(
    { label: 'Name', value: receipt.name },
    { label: 'E-Mail-Adresse', value: receipt.email },
    { label: 'Vertrag', value: receipt.contract },
  );
  if (cancellation) {
    fields.push({
      label: 'Gewünschtes Vertragsende',
      value: receipt.requestedEndDate
        ? formatLegalDay(receipt.requestedEndDate)
        : 'zum nächstmöglichen Zeitpunkt',
    });
  }
  return fields;
}

export function noticeLines(receipt: ContractNoticeReceipt): string[] {
  return noticeFields(receipt).map((field) => `${field.label}: ${field.value}`);
}

/** What happens next, in the words of the receipt page and the confirmation e-mail. */
export function noticeOutcomeText(receipt: ContractNoticeReceipt): string {
  const end = receipt.effectiveEnd ? formatLegalDate(receipt.effectiveEnd) : null;
  switch (receipt.outcome) {
    case 'scheduled':
      return end
        ? `Dein Vertrag endet zum ${end}. Bis dahin kannst du KaufCheck Pro weiter nutzen; danach wird nichts mehr abgebucht.`
        : 'Dein Vertrag endet zum Ende des laufenden Abrechnungsmonats; danach wird nichts mehr abgebucht.';
    case 'scheduled_later':
      return `Dein Vertrag endet mit Ablauf des Abrechnungsmonats, in den der ${formatLegalDay(receipt.requestedEndDate ?? '')} fällt. Bis dahin läuft er wie gewohnt weiter.`;
    case 'already_ending':
      return end
        ? `Dein Vertrag war bereits gekündigt und endet zum ${end}.`
        : 'Dein Vertrag war bereits gekündigt.';
    case 'withdrawn':
      return 'Wir haben dein Abo beendet. Die Erstattung erhältst du spätestens 14 Tage nach Eingang deines Widerrufs mit dem Zahlungsmittel, mit dem du bezahlt hast. Weil du verlangt hast, dass KaufCheck Pro sofort beginnt, ziehen wir davon einen anteiligen Betrag für die Zeit bis zu deinem Widerruf ab (siehe Widerrufsbelehrung).';
    case 'review':
      if (receipt.type === 'withdrawal')
        return 'Wir ordnen deinen Widerruf deinem Vertrag zu und melden uns bei dir. Ist der Widerruf wirksam, erstatten wir dir den Betrag spätestens 14 Tage nach Eingang dieses Widerrufs.';
      if (receipt.kind === 'extraordinary')
        return end
          ? `Deine außerordentliche Kündigung prüfen wir und melden uns bei dir. Unabhängig davon endet dein Vertrag spätestens zum ${end}.`
          : 'Deine außerordentliche Kündigung prüfen wir und melden uns bei dir.';
      return 'Wir konnten deiner Kündigung noch keinen laufenden Vertrag zuordnen. Wir prüfen das und melden uns bei dir. Hast du ein KaufCheck-Konto mit einer anderen E-Mail-Adresse, antworte bitte auf die Bestätigungs-E-Mail.';
  }
}

/** Plain text of a receipt, for saving it as a file (§ 312k Abs. 3 BGB). */
export function noticeReceiptText(receipt: ContractNoticeReceipt, siteUrl: string): string {
  const title =
    receipt.type === 'cancellation'
      ? 'KÜNDIGUNG – EINGANGSBESTÄTIGUNG'
      : 'WIDERRUF – EINGANGSBESTÄTIGUNG';
  return [
    title,
    `KaufCheck (${siteUrl})`,
    '',
    ...noticeLines(receipt),
    '',
    noticeOutcomeText(receipt),
    '',
  ].join('\n');
}
