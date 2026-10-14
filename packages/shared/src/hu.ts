/** HU (Hauptuntersuchung) dates as on the badge: month and year, due by the end of that month. */
export interface HuMonth {
  year: number;
  month: number;
}

export const monthYear = (value: { year: number; month: number | null }) =>
  value.month ? `${String(value.month).padStart(2, '0')}/${value.year}` : String(value.year);

export interface HuStatus {
  tone: 'ok' | 'soon' | 'overdue';
  text: string;
}

/**
 * The badge shows the month until which the HU is valid; it ends with the end
 * of that month (§ 29 Abs. 7 StVZO).
 */
export function huStatus(hu: HuMonth, now: Date): HuStatus {
  const months = hu.year * 12 + hu.month - (now.getFullYear() * 12 + now.getMonth() + 1);
  const until = monthYear(hu);
  if (months < 0) {
    const overdue = -months;
    return {
      tone: 'overdue',
      text: `Die HU ist seit ${overdue === 1 ? 'einem Monat' : `${overdue} Monaten`} abgelaufen (gültig bis ${until}).`,
    };
  }
  if (months === 0) return { tone: 'soon', text: `Die HU ist diesen Monat fällig (${until}).` };
  if (months <= 2)
    return {
      tone: 'soon',
      text: `Die HU ist bis ${until} fällig – in ${months === 1 ? 'einem Monat' : `${months} Monaten`}.`,
    };
  return { tone: 'ok', text: `Die nächste HU ist bis ${until} fällig.` };
}

const icsText = (value: string) =>
  value.replace(/[\\;,]/g, (char) => `\\${char}`).replace(/\r?\n/g, '\\n');

/** Folds a content line at 75 octets (RFC 5545, 3.1) without splitting a character. */
function fold(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = '';
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    // Continuation lines start with a space, which counts towards their 75 octets.
    const max = parts.length === 0 ? 75 : 74;
    if (bytes + size > max) {
      parts.push(current);
      current = '';
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

/**
 * A calendar file for the HU month (all day on the 1st) with a reminder four
 * weeks before – the reminder stays in the user's own calendar.
 */
export function huCalendarFile({
  uid,
  title,
  hu,
  now,
}: {
  uid: string;
  title: string;
  hu: HuMonth;
  now: Date;
}): string {
  const date = `${hu.year}${String(hu.month).padStart(2, '0')}01`;
  const end = new Date(Date.UTC(hu.year, hu.month - 1, 2))
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, '');
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//KaufCheck//Mein Auto//DE',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${date}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${icsText(`HU fällig: ${title}`)}`,
    `DESCRIPTION:${icsText(
      `Die Hauptuntersuchung ist bis Ende ${monthYear(hu)} fällig. Termin z. B. bei TÜV, DEKRA, GTÜ oder KÜS vereinbaren.`,
    )}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsText(`HU fällig: ${title}`)}`,
    'TRIGGER:-P28D',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ]
    .map(fold)
    .join('\r\n');
}
