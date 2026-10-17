import { fold, icsText } from './hu';

/**
 * E-mail reminders for a car in „Mein Auto“ (Pro). Each reminder is switched
 * on by the owner, is sent once per due date, and says only what is due –
 * no advertising (§ 7 UWG): a reminder with promotion would need consent.
 */

export const REMINDER_KINDS = ['hu', 'service', 'brakeFluid', 'tyres'] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];

export const REMINDER_LABELS: Record<ReminderKind, string> = {
  hu: 'Hauptuntersuchung (HU)',
  service: 'Inspektion',
  brakeFluid: 'Bremsflüssigkeit',
  tyres: 'Reifenwechsel',
};

/** Kinds where the owner enters a month: the next inspection, the last brake fluid change. */
export const REMINDER_NEEDS_MONTH: ReadonlySet<ReminderKind> = new Set(['service', 'brakeFluid']);

/** ADAC: change the brake fluid at the latest every two years; the manufacturer's plan rules. */
export const BRAKE_FLUID_MONTHS = 24;

/** Month and year, both required (unlike a listing's `YearMonth`). */
export interface ReminderMonth {
  year: number;
  month: number;
}
type YearMonth = ReminderMonth;

/** The month a dated reminder is about; null for tyres (seasonal) and without a month. */
export function reminderDueMonth(
  kind: ReminderKind,
  input: { huUntil: YearMonth | null; month: YearMonth | null },
): YearMonth | null {
  if (kind === 'tyres') return null;
  const base = kind === 'hu' ? input.huUntil : input.month;
  if (!base) return null;
  return kind === 'brakeFluid' ? fromIndex(index(base) + BRAKE_FLUID_MONTHS) : base;
}

/** Months from `today` to `due`; negative when it has passed. */
export const monthsUntil = (due: YearMonth, today: YearMonth) => index(due) - index(today);

/**
 * Why a month cannot be saved, or null. The next inspection lies ahead (at
 * most five years); the last brake fluid change lies behind.
 */
export function reminderMonthProblem(
  kind: ReminderKind,
  month: YearMonth | null,
  today: YearMonth,
): string | null {
  if (!REMINDER_NEEDS_MONTH.has(kind)) return month === null ? null : 'Hier gibt es keinen Monat.';
  if (month === null) return null;
  const offset = index(month) - index(today);
  if (kind === 'service') {
    if (offset < 0) return 'Der Monat liegt in der Vergangenheit.';
    if (offset > 60) return 'Bitte höchstens fünf Jahre im Voraus.';
    return null;
  }
  if (offset > 0) return 'Der letzte Wechsel kann nicht in der Zukunft liegen.';
  if (month.year < 1990) return 'Bitte gib ein Jahr ab 1990 an.';
  return null;
}

export interface ReminderOccurrence {
  /** Identifies the due date, so that each is sent once. */
  key: string;
  /** The month the reminder is about (the due month, or the tyre season). */
  due: YearMonth;
}

const index = (value: YearMonth) => value.year * 12 + value.month - 1;
const fromIndex = (value: number): YearMonth => ({
  year: Math.floor(value / 12),
  month: (value % 12) + 1,
});
const pad = (value: number) => String(value).padStart(2, '0');
export const monthText = (value: YearMonth) => `${pad(value.month)}/${value.year}`;

/**
 * The reminder to send now, or null. Dated reminders go out in the month
 * before the due month and up to its end; tyre reminders at the start of
 * October and of April (the „O bis O“ rule of thumb). `today` is the date in
 * German time.
 */
export function dueOccurrence(
  kind: ReminderKind,
  input: { huUntil: YearMonth | null; month: YearMonth | null },
  today: { year: number; month: number; day: number },
): ReminderOccurrence | null {
  const now = index(today);
  if (kind === 'tyres') {
    if (today.month !== 10 && today.month !== 4) return null;
    // Only in the first half of the month: a reminder in late April is late.
    if (today.day > 15) return null;
    return { key: `tyres-${today.year}-${pad(today.month)}`, due: today };
  }
  const due = reminderDueMonth(kind, input);
  if (!due) return null;
  const dueIndex = index(due);
  if (now < dueIndex - 1 || now > dueIndex) return null;
  return { key: `${kind}-${due.year}-${pad(due.month)}`, due };
}

const MONTH_NAMES = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
];

/** E.g. „November 2026“. */
export const monthName = (value: YearMonth) => `${MONTH_NAMES[value.month - 1]} ${value.year}`;

/** What happens next with an e-mail reminder, for the settings page. */
export type ReminderPlan =
  /** The next e-mail goes out at the start of this month. */
  | { state: 'scheduled'; month: YearMonth }
  /** Due now: the e-mail goes out with the next run. */
  | { state: 'due' }
  /** The e-mail for the current date was sent. */
  | { state: 'sent' }
  /** The date has passed: no e-mail until a new date is entered. */
  | { state: 'past' }
  /** No date yet (no HU month, no inspection month). */
  | { state: 'noDate' };

/** The next tyre season: October or April, from the first half of the month on. */
function nextTyreSeason(today: { year: number; month: number; day: number }): YearMonth {
  const current = index(today) + (today.day > 15 ? 1 : 0);
  for (let offset = 0; offset < 12; offset++) {
    const candidate = fromIndex(current + offset);
    if (candidate.month === 10 || candidate.month === 4) return candidate;
  }
  return fromIndex(current);
}

export function reminderPlan(
  kind: ReminderKind,
  input: { huUntil: YearMonth | null; month: YearMonth | null },
  today: { year: number; month: number; day: number },
  lastSentKey: string | null,
): ReminderPlan {
  const occurrence = dueOccurrence(kind, input, today);
  if (kind === 'tyres') {
    if (occurrence && occurrence.key !== lastSentKey) return { state: 'due' };
    const season = nextTyreSeason(occurrence ? { ...today, day: 16 } : today);
    return { state: 'scheduled', month: season };
  }
  const due = reminderDueMonth(kind, input);
  if (!due) return { state: 'noDate' };
  if (occurrence) return occurrence.key === lastSentKey ? { state: 'sent' } : { state: 'due' };
  return index(today) < index(due) - 1
    ? { state: 'scheduled', month: fromIndex(index(due) - 1) }
    : { state: 'past' };
}

export interface ReminderMail {
  subject: string;
  /** The factual part; the footer with sender and unsubscribe links is added by the server. */
  body: string;
}

/** The text of a reminder: what is due and where to look it up, nothing else. */
export function reminderMail(
  kind: ReminderKind,
  occurrence: ReminderOccurrence,
  carName: string,
): ReminderMail {
  const month = monthName(occurrence.due);
  switch (kind) {
    case 'hu':
      return {
        subject: `Erinnerung: HU für ${carName} bis Ende ${month}`,
        body: [
          `Die Hauptuntersuchung für ${carName} ist laut deiner Angabe in „Mein Auto“ bis Ende ${month} fällig. Maßgeblich sind Monat und Jahr auf der Prüfplakette am hinteren Kennzeichen.`,
          'Einen Termin vereinbarst du zum Beispiel bei TÜV, DEKRA, GTÜ oder KÜS. Die Frist für die nächste HU beginnt mit dem Monat, in dem die HU gemacht wird – gehst du schon vor dem Monat auf der Plakette, ist auch die nächste HU entsprechend früher fällig.',
          'Ist die HU mehr als zwei Monate überzogen, wird eine Ergänzungsuntersuchung fällig, die mehr kostet; außerdem droht dann ein Verwarnungsgeld ab 15 €.',
          'Nach der HU trägst du in „Mein Auto“ den neuen Monat von der Plakette ein, dann erinnern wir dich wieder.',
        ].join('\n\n'),
      };
    case 'service':
      return {
        subject: `Erinnerung: Inspektion für ${carName} im ${month}`,
        body: [
          `Für ${carName} hast du in „Mein Auto“ die nächste Inspektion für ${month} eingetragen.`,
          'Maßgeblich sind der Wartungsplan des Herstellers und die Anzeige im Auto.',
          'Nach der Inspektion trägst du den nächsten Termin ein, dann erinnern wir dich wieder.',
        ].join('\n\n'),
      };
    case 'brakeFluid':
      return {
        subject: `Erinnerung: Bremsflüssigkeit für ${carName} im ${month}`,
        body: [
          `Für ${carName} hast du in „Mein Auto“ den letzten Wechsel der Bremsflüssigkeit eingetragen. Der ADAC empfiehlt, sie spätestens alle zwei Jahre zu wechseln – das wäre im ${month}.`,
          'Maßgeblich ist der Wartungsplan des Herstellers; eine gesetzliche Frist gibt es nicht.',
          'Nach dem Wechsel trägst du den neuen Monat ein, dann erinnern wir dich wieder.',
        ].join('\n\n'),
      };
    case 'tyres':
      return occurrence.due.month === 10
        ? {
            subject: `Erinnerung: Winterreifen für ${carName}`,
            body: [
              `${WINTER_RULE} Eine feste Frist gibt es nicht; als Faustregel gilt „von O bis O“, von Oktober bis Ostern.`,
              'Prüf auch die Profiltiefe: Gesetzlich sind mindestens 1,6 mm vorgeschrieben.',
            ].join('\n\n'),
          }
        : {
            subject: `Erinnerung: Sommerreifen für ${carName}`,
            body: [
              'Die Faustregel „von O bis O“ endet mit Ostern: Wenn keine Glätte durch Eis oder Schnee mehr zu erwarten ist, kannst du auf Sommerreifen wechseln.',
              'Prüf dabei Profiltiefe (gesetzlich mindestens 1,6 mm), Alter und Schäden der Reifen.',
            ].join('\n\n'),
          };
  }
}

/** § 2 Abs. 3a StVO and § 36 Abs. 4 StVZO, in plain words. */
export const WINTER_RULE =
  'Bei Glatteis, Schneeglätte, Schneematsch, Eisglätte oder Reifglätte darfst du nur fahren, wenn alle Räder Winter- oder Ganzjahresreifen mit Alpine-Symbol (Bergpiktogramm mit Schneeflocke) haben; Reifen nur mit M+S-Kennzeichnung reichen nicht mehr.';

const dateValue = (value: YearMonth, day = 1) => `${value.year}${pad(value.month)}${pad(day)}`;

function stamp(now: Date): string {
  return now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

interface CalendarEvent {
  uid: string;
  start: YearMonth;
  summary: string;
  description: string;
  /** e.g. `-P14D`, relative to the start of the all-day event. */
  alarm: string;
  yearly?: boolean;
}

function calendar(events: CalendarEvent[], now: Date): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//KaufCheck//Mein Auto//DE',
    'CALSCALE:GREGORIAN',
  ];
  for (const event of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.uid}`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART;VALUE=DATE:${dateValue(event.start)}`,
      // One day: the end of an all-day event is exclusive.
      `DTEND;VALUE=DATE:${dateValue(event.start, 2)}`,
      ...(event.yearly ? ['RRULE:FREQ=YEARLY'] : []),
      `SUMMARY:${icsText(event.summary)}`,
      `DESCRIPTION:${icsText(event.description)}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${icsText(event.summary)}`,
      `TRIGGER:${event.alarm}`,
      'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR', '');
  return lines.map(fold).join('\r\n');
}

/**
 * A calendar file for inspection, brake fluid or tyres (the HU has its own,
 * see `huCalendarFile`); null without a month. The reminder then lives in the
 * user's own calendar, without e-mail.
 */
export function reminderCalendarFile({
  kind,
  carId,
  title,
  month,
  today,
  now,
}: {
  kind: Exclude<ReminderKind, 'hu'>;
  carId: string;
  title: string;
  month: YearMonth | null;
  today: YearMonth;
  now: Date;
}): string | null {
  if (kind === 'tyres') {
    // The next October and April; both repeat every year.
    const october = { year: today.month <= 10 ? today.year : today.year + 1, month: 10 };
    const april = { year: today.month <= 4 ? today.year : today.year + 1, month: 4 };
    return calendar(
      [
        {
          uid: `tyres-winter-${carId}@kaufcheck`,
          start: october,
          summary: `Winterreifen aufziehen: ${title}`,
          description: `Faustregel „von O bis O“: von Oktober bis Ostern. ${WINTER_RULE}`,
          alarm: 'PT9H',
          yearly: true,
        },
        {
          uid: `tyres-summer-${carId}@kaufcheck`,
          start: april,
          summary: `Sommerreifen aufziehen: ${title}`,
          description:
            'Faustregel „von O bis O“: Wenn keine Glätte durch Eis oder Schnee mehr zu erwarten ist, kannst du auf Sommerreifen wechseln. Prüf Profiltiefe (mindestens 1,6 mm), Alter und Schäden.',
          alarm: 'PT9H',
          yearly: true,
        },
      ],
      now,
    );
  }
  const due = reminderDueMonth(kind, { huUntil: null, month });
  if (!due) return null;
  const event: CalendarEvent =
    kind === 'service'
      ? {
          uid: `service-${carId}-${due.year}-${due.month}@kaufcheck`,
          start: due,
          summary: `Inspektion fällig: ${title}`,
          description: `Laut deiner Angabe ist die nächste Inspektion im ${monthName(due)} fällig. Maßgeblich sind der Wartungsplan des Herstellers und die Anzeige im Auto.`,
          alarm: '-P14D',
        }
      : {
          uid: `brake-fluid-${carId}-${due.year}-${due.month}@kaufcheck`,
          start: due,
          summary: `Bremsflüssigkeit wechseln: ${title}`,
          description: `Der ADAC empfiehlt, die Bremsflüssigkeit spätestens alle zwei Jahre zu wechseln; zuletzt gewechselt im ${monthName(month!)}. Maßgeblich ist der Wartungsplan des Herstellers.`,
          alarm: '-P14D',
        };
  return calendar([event], now);
}
