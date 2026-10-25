import type { ChatCard, ChatForm, ChatJump } from '@kaufcheck/shared';

export const FORM_TITLES: Record<ChatForm, string> = {
  search: 'Auto suchen',
  financing: 'Finanzierung rechnen',
  tax: 'Kfz-Steuer berechnen',
  rdw: 'Kennzeichen aus den Niederlanden prüfen',
};

/** What a card shows, in a few words – read out with the finished answer. */
export function cardSummary(card: ChatCard): string {
  switch (card.type) {
    case 'analysis':
      return `Prüfung: ${card.title}`;
    case 'search':
      return `Suche: ${card.summary}`;
    case 'tax':
      return 'Kfz-Steuer';
    case 'financing':
      return 'Finanzierung';
    case 'model':
      return `Modellwissen: ${card.name}`;
    case 'advisor':
      return 'Passende Modelle';
    case 'rdw':
      return `RDW: ${card.plate}`;
    case 'links':
      return `Links: ${card.links.map((link) => link.label).join(', ')}`;
    case 'form':
      return `Formular: ${FORM_TITLES[card.form]}`;
  }
}

/** The answer as screen readers get it: plain text, then the cards below it. */
export function spokenAnswer(
  text: string,
  cards: readonly ChatCard[],
  jumps: readonly ChatJump[] = [],
): string {
  const plain = text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\[([^\]\n]+)\]\([^)\s]+\)/g, '$1')
    .replace(/^\s*(?:[-*•]|\d+\.)\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
  const below = cards.length > 0 ? ` Darunter: ${cards.map(cardSummary).join('; ')}.` : '';
  const self =
    jumps.length > 0 ? ` Selbst weitermachen: ${jumps.map((jump) => jump.label).join('; ')}.` : '';
  return `${plain}${below}${self}`.trim();
}
