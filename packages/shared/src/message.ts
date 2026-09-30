export interface SellerMessageInput {
  /** `true` = "Sie", `false` = "du". */
  formal: boolean;
  vehicleTitle: string | null;
  questions: readonly string[];
}

/** Composes a short, polite message that can be pasted into the Kleinanzeigen chat. */
export function buildSellerMessage({
  formal,
  vehicleTitle,
  questions,
}: SellerMessageInput): string {
  const subject = formal ? 'Ihr Fahrzeug' : 'dein Auto';
  const title = vehicleTitle ? ` „${vehicleTitle}“` : '';
  const intro =
    questions.length > 0
      ? `ich interessiere mich für ${subject}${title} und hätte vorab ${
          questions.length === 1 ? 'eine Frage' : 'ein paar Fragen'
        }:`
      : `ich interessiere mich für ${subject}${title}.`;
  const list = questions.map((question, index) => `${index + 1}. ${question}`).join('\n');
  const closing = formal ? 'Vielen Dank im Voraus und viele Grüße' : 'Danke dir und viele Grüße';

  return ['Hallo,', intro, list, closing].filter((part) => part.length > 0).join('\n\n');
}
