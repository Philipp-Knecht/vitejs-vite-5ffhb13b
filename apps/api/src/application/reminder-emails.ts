import {
  operatorLine,
  REMINDER_LABELS,
  reminderMail,
  type LegalContext,
  type ReminderKind,
  type ReminderOccurrence,
} from '@kaufcheck/shared';
import type { EmailMessage } from '../infrastructure/email/email-service';

/** Hours a confirmation link stays valid. */
export const REMINDER_CONFIRM_HOURS = 48;

function footer(context: LegalContext, lines: string[]): string[] {
  return [
    '',
    '--',
    ...lines,
    '',
    'KaufCheck',
    operatorLine(context.operator),
    `Impressum: ${context.siteUrl}/impressum`,
    `Datenschutz: ${context.siteUrl}/datenschutz`,
  ];
}

/** Confirms the account address before the first reminder: accounts are not verified at sign-up. */
export function reminderConfirmEmail(
  context: LegalContext,
  to: string,
  token: string,
): EmailMessage {
  const link = `${context.siteUrl}/erinnerungen-bestaetigen?token=${encodeURIComponent(token)}`;
  return {
    to,
    subject: 'KaufCheck: E-Mail-Adresse für Erinnerungen bestätigen',
    text: [
      'Hallo,',
      '',
      'du möchtest in „Mein Auto“ Erinnerungen per E-Mail bekommen, zum Beispiel an die Hauptuntersuchung. Bitte bestätige dazu innerhalb von 48 Stunden deine E-Mail-Adresse:',
      '',
      link,
      '',
      'Ohne Bestätigung schicken wir keine Erinnerungen an diese Adresse. Hast du kein KaufCheck-Konto angelegt, kannst du diese E-Mail ignorieren. Antwortest du uns, löschen wir das Konto.',
      ...footer(context, [
        'Du bekommst diese E-Mail, weil in deinem KaufCheck-Konto eine Erinnerung eingeschaltet wurde.',
      ]),
    ].join('\n'),
    replyTo: context.operator.email,
  };
}

/** The page that asks before unsubscribing (link scanners only open it). */
export const unsubscribePageUrl = (siteUrl: string, reminderId: string, token: string) =>
  `${siteUrl}/erinnerung-abbestellen?r=${encodeURIComponent(reminderId)}&t=${encodeURIComponent(token)}`;

/** The one-click endpoint (RFC 8058): mail providers POST to it without cookies. */
export const oneClickUnsubscribeUrl = (siteUrl: string, reminderId: string, token: string) =>
  `${siteUrl}/api/reminders/unsubscribe?r=${encodeURIComponent(reminderId)}&t=${encodeURIComponent(token)}`;

/**
 * A reminder: what is due, the reason for the e-mail and how to stop it –
 * nothing else, so that it stays a service message (no advertising).
 */
export function reminderEmail(
  context: LegalContext,
  input: {
    to: string;
    kind: ReminderKind;
    occurrence: ReminderOccurrence;
    carName: string;
    carId: string;
    reminderId: string;
    unsubscribeToken: string;
  },
): EmailMessage {
  const mail = reminderMail(input.kind, input.occurrence, input.carName);
  return {
    to: input.to,
    subject: mail.subject,
    text: [
      'Hallo,',
      '',
      mail.body,
      '',
      `Termine ändern: ${context.siteUrl}/mein-auto/${input.carId}/erinnerungen`,
      ...footer(context, [
        `Du bekommst diese E-Mail, weil du in „Mein Auto“ die Erinnerung „${REMINDER_LABELS[input.kind]}“ für ${input.carName} eingeschaltet hast.`,
        `Diese Erinnerung abbestellen: ${unsubscribePageUrl(context.siteUrl, input.reminderId, input.unsubscribeToken)}`,
      ]),
    ].join('\n'),
    replyTo: context.operator.email,
    headers: {
      'List-Unsubscribe': `<${oneClickUnsubscribeUrl(context.siteUrl, input.reminderId, input.unsubscribeToken)}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      // Automatic message: no out-of-office replies (RFC 3834).
      'Auto-Submitted': 'auto-generated',
    },
  };
}
