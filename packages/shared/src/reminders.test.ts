import { describe, expect, it } from 'vitest';
import {
  dueOccurrence,
  reminderAllowed,
  reminderCalendarFile,
  reminderDueMonth,
  reminderMail,
  reminderMonthProblem,
  reminderPlan,
} from './reminders';

const none = { huUntil: null, month: null };

describe('reminders', () => {
  it('sends dated reminders in the month before and in the due month', () => {
    const input = { huUntil: { year: 2026, month: 11 }, month: null };
    expect(dueOccurrence('hu', input, { year: 2026, month: 9, day: 30 })).toBeNull();
    expect(dueOccurrence('hu', input, { year: 2026, month: 10, day: 1 })).toEqual({
      key: 'hu-2026-11',
      due: { year: 2026, month: 11 },
    });
    expect(dueOccurrence('hu', input, { year: 2026, month: 11, day: 30 })?.key).toBe('hu-2026-11');
    expect(dueOccurrence('hu', input, { year: 2026, month: 12, day: 1 })).toBeNull();
    // Across the turn of the year.
    const january = { huUntil: { year: 2027, month: 1 }, month: null };
    expect(dueOccurrence('hu', january, { year: 2026, month: 12, day: 5 })?.key).toBe('hu-2027-01');
    expect(dueOccurrence('hu', none, { year: 2026, month: 10, day: 1 })).toBeNull();
  });

  it('adds two years to the last brake fluid change', () => {
    const input = { huUntil: null, month: { year: 2024, month: 12 } };
    expect(reminderDueMonth('brakeFluid', input)).toEqual({ year: 2026, month: 12 });
    expect(dueOccurrence('brakeFluid', input, { year: 2026, month: 11, day: 3 })?.key).toBe(
      'brakeFluid-2026-12',
    );
    expect(reminderDueMonth('tyres', input)).toBeNull();
  });

  it('reminds of tyres in the first half of October and April', () => {
    expect(dueOccurrence('tyres', none, { year: 2026, month: 10, day: 15 })?.key).toBe(
      'tyres-2026-10',
    );
    expect(dueOccurrence('tyres', none, { year: 2026, month: 10, day: 16 })).toBeNull();
    expect(dueOccurrence('tyres', none, { year: 2027, month: 4, day: 1 })?.key).toBe(
      'tyres-2027-04',
    );
    expect(dueOccurrence('tyres', none, { year: 2026, month: 11, day: 1 })).toBeNull();
  });

  it('says when the next e-mail goes out', () => {
    const today = { year: 2026, month: 10, day: 20 };
    const hu = (year: number, month: number) => ({ huUntil: { year, month }, month: null });
    expect(reminderPlan('hu', hu(2027, 3), today, null)).toEqual({
      state: 'scheduled',
      month: { year: 2027, month: 2 },
    });
    expect(reminderPlan('hu', hu(2026, 11), today, null)).toEqual({ state: 'due' });
    expect(reminderPlan('hu', hu(2026, 11), today, 'hu-2026-11')).toEqual({ state: 'sent' });
    expect(reminderPlan('hu', hu(2026, 9), today, null)).toEqual({ state: 'past' });
    expect(reminderPlan('service', none, today, null)).toEqual({ state: 'noDate' });
    // Tyres: after the first half of October, the next is April.
    expect(reminderPlan('tyres', none, today, null)).toEqual({
      state: 'scheduled',
      month: { year: 2027, month: 4 },
    });
    const early = { year: 2026, month: 10, day: 3 };
    expect(reminderPlan('tyres', none, early, null)).toEqual({ state: 'due' });
    expect(reminderPlan('tyres', none, early, 'tyres-2026-10')).toEqual({
      state: 'scheduled',
      month: { year: 2027, month: 4 },
    });
    expect(reminderPlan('tyres', none, { year: 2026, month: 9, day: 30 }, null)).toEqual({
      state: 'scheduled',
      month: { year: 2026, month: 10 },
    });
  });

  it('allows the HU reminder with any account, the others with Pro', () => {
    const free = { reminders: false, huReminder: true };
    const anonymous = { reminders: false, huReminder: false };
    expect(reminderAllowed('hu', free)).toBe(true);
    expect(reminderAllowed('service', free)).toBe(false);
    expect(reminderAllowed('tyres', free)).toBe(false);
    expect(reminderAllowed('hu', anonymous)).toBe(false);
    expect(reminderAllowed('brakeFluid', { reminders: true, huReminder: true })).toBe(true);
  });

  it('checks the months', () => {
    const today = { year: 2026, month: 10 };
    expect(reminderMonthProblem('service', { year: 2026, month: 10 }, today)).toBeNull();
    expect(reminderMonthProblem('service', { year: 2026, month: 9 }, today)).toMatch(
      /Vergangenheit/,
    );
    expect(reminderMonthProblem('service', { year: 2031, month: 10 }, today)).toBeNull();
    expect(reminderMonthProblem('service', { year: 2031, month: 11 }, today)).toMatch(/fünf/);
    expect(reminderMonthProblem('brakeFluid', { year: 2026, month: 10 }, today)).toBeNull();
    expect(reminderMonthProblem('brakeFluid', { year: 2026, month: 11 }, today)).toMatch(/Zukunft/);
    expect(reminderMonthProblem('brakeFluid', { year: 1989, month: 12 }, today)).toMatch(/1990/);
    expect(reminderMonthProblem('hu', null, today)).toBeNull();
    expect(reminderMonthProblem('tyres', { year: 2026, month: 10 }, today)).not.toBeNull();
  });

  it('writes factual e-mails', () => {
    const mail = reminderMail(
      'hu',
      { key: 'hu-2026-11', due: { year: 2026, month: 11 } },
      'Mein Golf',
    );
    expect(mail.subject).toBe('Erinnerung: HU für Mein Golf bis Ende November 2026');
    expect(mail.body).toContain('Ergänzungsuntersuchung');
    const summer = reminderMail(
      'tyres',
      { key: 'tyres-2027-04', due: { year: 2027, month: 4 } },
      'Mein Golf',
    );
    expect(summer.subject).toBe('Erinnerung: Sommerreifen für Mein Golf');
  });

  it('builds calendar files', () => {
    const now = new Date('2026-10-15T08:00:00Z');
    const today = { year: 2026, month: 10 };
    const service = reminderCalendarFile({
      kind: 'service',
      carId: 'car-1',
      title: 'VW Golf; Kombi',
      month: { year: 2027, month: 3 },
      today,
      now,
    })!;
    expect(service).toContain('DTSTART;VALUE=DATE:20270301');
    expect(service).toContain('DTEND;VALUE=DATE:20270302');
    expect(service).toContain('SUMMARY:Inspektion fällig: VW Golf\\; Kombi');
    expect(service).toContain('TRIGGER:-P14D');
    expect(service.split('\r\n').every((line) => new TextEncoder().encode(line).length <= 75)).toBe(
      true,
    );

    const brake = reminderCalendarFile({
      kind: 'brakeFluid',
      carId: 'car-1',
      title: 'Golf',
      month: { year: 2025, month: 5 },
      today,
      now,
    })!;
    expect(brake).toContain('DTSTART;VALUE=DATE:20270501');

    const tyres = reminderCalendarFile({
      kind: 'tyres',
      carId: 'car-1',
      title: 'Golf',
      month: null,
      today,
      now,
    })!;
    expect(tyres).toContain('DTSTART;VALUE=DATE:20261001');
    expect(tyres).toContain('DTSTART;VALUE=DATE:20270401');
    expect(tyres.match(/RRULE:FREQ=YEARLY/g)).toHaveLength(2);

    expect(
      reminderCalendarFile({ kind: 'service', carId: 'c', title: 'G', month: null, today, now }),
    ).toBeNull();
  });
});
