import {
  BRAKE_FLUID_MONTHS,
  huStatus,
  monthName,
  monthsUntil,
  REMINDER_LABELS,
  reminderCalendarFile,
  reminderDueMonth,
  reminderMonthProblem,
  reminderPlan,
  type OwnedCarDto,
  type ReminderDto,
  type ReminderKind,
  type ReminderMonth,
} from '@kaufcheck/shared';
import { CalendarPlus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { ApiRequestError } from '../../api/client';
import {
  useCarReminders,
  useConfig,
  useMe,
  useOwnedCars,
  useRequestReminderConfirmation,
  useSaveReminder,
} from '../../api/queries';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { SelectField, TextField } from '../../components/ui/Field';
import { PageLoading } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/toast-context';
import { track } from '../../lib/analytics';
import { downloadTextFile } from '../../lib/download';
import { appPageMeta } from '../../seo/pages';
import { usePageMeta } from '../../seo/use-page-meta';
import { carHuCalendarFile, carName, carTitle } from '../my-car/car';

const META = appPageMeta('Erinnerungen');

const MONTHS = [
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

/** Today in Germany, as the server counts due months and tyre seasons. */
function germanToday(now: Date) {
  const [year, month, day] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' })
    .format(now)
    .split('-')
    .map(Number) as [number, number, number];
  return { year, month, day };
}

const errorOf = (error: unknown): { month: boolean; message: string } =>
  error instanceof ApiRequestError
    ? error.details?.fieldErrors?.month?.[0]
      ? { month: true, message: error.details.fieldErrors.month[0] }
      : { month: false, message: error.message }
    : { month: false, message: 'Das hat nicht geklappt. Bitte versuch es noch einmal.' };

const DESCRIPTIONS: Record<ReminderKind, string> = {
  hu: 'Eine E-Mail Anfang des Vormonats: Steht auf der Plakette Oktober, kommt sie Anfang September. Die Frist für die nächste HU beginnt mit dem Monat, in dem die HU gemacht wird. Ist sie mehr als zwei Monate überzogen, wird eine teurere Ergänzungsuntersuchung fällig.',
  service:
    'Eine E-Mail einen Monat vor der Inspektion. Wann sie fällig ist, steht im Serviceheft, auf dem letzten Werkstattzettel oder in der Anzeige im Auto.',
  brakeFluid:
    'Der ADAC empfiehlt, die Bremsflüssigkeit spätestens alle zwei Jahre zu wechseln; maßgeblich ist der Wartungsplan des Herstellers. Eine E-Mail einen Monat vor dem Termin.',
  tyres:
    'Eine E-Mail Anfang Oktober und Anfang April. Feste Termine gibt es nicht: Bei Glatteis, Schneeglätte, Schneematsch, Eis- oder Reifglätte sind Winter- oder Ganzjahresreifen mit Alpine-Symbol (Bergpiktogramm mit Schneeflocke) Pflicht; als Faustregel gilt „von O bis O“.',
};

/** When the calendar app reminds, if it takes the alarm from the file. */
const CALENDAR_NOTES: Record<ReminderKind, string> = {
  hu: 'Der Termin steht am Monatsersten; übernimmt dein Kalender die Erinnerung aus der Datei, meldet er sich vier Wochen vorher.',
  service:
    'Der Termin steht am Monatsersten; übernimmt dein Kalender die Erinnerung aus der Datei, meldet er sich zwei Wochen vorher.',
  brakeFluid:
    'Der Termin steht am Monatsersten; übernimmt dein Kalender die Erinnerung aus der Datei, meldet er sich zwei Wochen vorher.',
  tyres:
    'Zwei Termine, jedes Jahr am 1. Oktober und am 1. April; manche Kalender übernehmen die Erinnerung aus der Datei nicht.',
};

const PAST_HINTS: Record<ReminderKind, string> = {
  hu: 'Trag nach der HU in „Mein Auto“ den Monat von der neuen Plakette ein.',
  service: 'Trag den nächsten Termin ein.',
  brakeFluid:
    'Laut deiner Angabe liegt der letzte Wechsel mehr als zwei Jahre zurück – länger, als der ADAC empfiehlt. Lass die Bremsflüssigkeit wechseln und trag danach den Monat ein, dann erinnern wir dich zum nächsten Termin.',
  tyres: '',
};

/** Days before the 1st of the due month at which the calendar file's alarm rings. */
const ALARM_DAYS: Partial<Record<ReminderKind, number>> = { hu: 28, service: 14, brakeFluid: 14 };

const AFTER_DUE: Partial<Record<ReminderKind, string>> = {
  hu: 'Nach der HU trägst du in „Mein Auto“ den neuen Monat von der Plakette ein, dann erinnern wir dich wieder.',
  service: 'Nach der Inspektion trägst du hier den nächsten Termin ein.',
  brakeFluid: 'Nach dem Wechsel trägst du hier den neuen Monat ein.',
};

function PlanLine({
  kind,
  car,
  reminder,
  confirmed,
}: {
  kind: ReminderKind;
  car: OwnedCarDto;
  reminder: ReminderDto;
  confirmed: boolean;
}) {
  const plan = reminderPlan(
    kind,
    { huUntil: car.huUntil, month: reminder.month },
    germanToday(new Date()),
    reminder.lastSentKey,
  );
  const unconfirmed = confirmed ? '' : ' – sobald du deine E-Mail-Adresse bestätigt hast';
  switch (plan.state) {
    case 'scheduled':
      return (
        <p className="reminder__plan">
          Nächste E-Mail: Anfang {monthName(plan.month)}
          {unconfirmed}.
        </p>
      );
    case 'due':
      return (
        <p className="reminder__plan">
          Der Termin steht an: Die E-Mail kommt in den nächsten Stunden{unconfirmed}.
        </p>
      );
    case 'sent':
      return (
        <p className="reminder__plan">
          Die E-Mail zu diesem Termin haben wir verschickt. {AFTER_DUE[kind]}
        </p>
      );
    case 'past':
      return (
        <Alert tone="warning">
          <p>Keine E-Mail geplant: Der Termin ist vorbei. {PAST_HINTS[kind]}</p>
        </Alert>
      );
    default:
      return null;
  }
}

function ReminderForm({
  car,
  reminder,
  emailAvailable,
  confirmed,
  address,
}: {
  car: OwnedCarDto;
  reminder: ReminderDto;
  emailAvailable: boolean;
  confirmed: boolean;
  address: string;
}) {
  const toast = useToast();
  const editable = reminder.editable;
  const save = useSaveReminder(car.id);
  const kind = reminder.kind;
  const needsMonth = kind === 'service' || kind === 'brakeFluid';
  const savedMonthText = reminder.month ? String(reminder.month.month) : '';
  const savedYearText = reminder.month ? String(reminder.month.year) : '';
  const [email, setEmail] = useState(reminder.email);
  const [month, setMonth] = useState(savedMonthText);
  const [year, setYear] = useState(savedYearText);
  const [localError, setLocalError] = useState<{ month: boolean; message: string } | null>(null);
  // A new state from the server (saved here, or unsubscribed elsewhere) replaces the form.
  const [server, setServer] = useState(reminder);
  if (server !== reminder) {
    setServer(reminder);
    setEmail(reminder.email);
    setMonth(savedMonthText);
    setYear(savedYearText);
    setLocalError(null);
  }

  const titleId = `reminder-${kind}-title`;
  const reasonId = `reminder-${kind}-reason`;
  const monthErrorId = `reminder-${kind}-month-error`;
  const now = new Date();
  const today = germanToday(now);

  const typed = (): { value: ReminderMonth | null } | { error: string } => {
    if (!needsMonth || (!month && !year.trim())) return { value: null };
    if (!month || !/^\d{4}$/.test(year.trim()))
      return { error: 'Bitte gib Monat und Jahr an, zum Beispiel März und 2027.' };
    return { value: { year: Number(year.trim()), month: Number(month) } };
  };
  const current = typed();
  const dirty = email !== reminder.email || month !== savedMonthText || year !== savedYearText;
  const huMissing = kind === 'hu' && !car.huUntil;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if ('error' in current) {
      setLocalError({ month: true, message: current.error });
      return;
    }
    const monthChanged = month !== savedMonthText || year !== savedYearText;
    const problem = monthChanged ? reminderMonthProblem(kind, current.value, today) : null;
    if (problem) {
      setLocalError({ month: true, message: problem });
      return;
    }
    if (email && needsMonth && current.value === null) {
      setLocalError({
        month: true,
        message:
          kind === 'service'
            ? 'Bitte gib an, wann die nächste Inspektion fällig ist.'
            : 'Bitte gib an, wann die Bremsflüssigkeit zuletzt gewechselt wurde.',
      });
      return;
    }
    if (email && (!reminder.email || monthChanged)) {
      const plan = reminderPlan(
        kind,
        { huUntil: car.huUntil, month: current.value },
        today,
        reminder.lastSentKey,
      );
      if (plan.state === 'past') {
        setLocalError(
          kind === 'hu'
            ? {
                month: false,
                message:
                  'Die HU ist laut „Mein Auto“ schon abgelaufen. Trag nach der HU den Monat von der neuen Plakette ein, dann erinnern wir dich.',
              }
            : {
                month: true,
                message:
                  kind === 'brakeFluid'
                    ? PAST_HINTS.brakeFluid
                    : 'Der Termin ist schon vorbei. Trag den neuen Termin ein, dann erinnern wir dich.',
              },
        );
        return;
      }
    }
    setLocalError(null);
    const label = REMINDER_LABELS[kind];
    save.mutate(
      { kind, input: { email, month: current.value } },
      {
        onSuccess: (response) => {
          if (email && !reminder.email) {
            track('reminder_enabled', { placement: kind });
            toast.show(
              confirmed
                ? `Erinnerung „${label}“ ist eingeschaltet`
                : response.confirmationSent
                  ? `Eingeschaltet – wir haben dir einen Link an ${address} geschickt. Bitte bestätige damit deine E-Mail-Adresse.`
                  : 'Eingeschaltet – bitte bestätige noch deine E-Mail-Adresse über den Link, den wir dir geschickt haben.',
            );
          } else if (!email && reminder.email) {
            toast.show(`Erinnerung „${label}“ ist ausgeschaltet`);
          } else {
            toast.show(`Erinnerung „${label}“ gespeichert`);
          }
        },
      },
    );
  };

  const title = car.nickname ? `${car.nickname} (${carTitle(car)})` : carTitle(car);
  const calendarMonth = 'value' in current ? current.value : null;
  const due = reminderDueMonth(kind, { huUntil: car.huUntil, month: calendarMonth });
  // The HU file is free, as on the car card; the others belong to Pro.
  const calendarAllowed = kind === 'hu' || editable;
  const calendarPossible = kind === 'tyres' || due !== null;
  // A calendar entry this month or in the past helps nobody.
  const calendarTooLate = due !== null && monthsUntil(due, today) < 1;
  const alarmDays = ALARM_DAYS[kind];
  // The alarm in the file lies before today: don't promise it.
  const alarmPast =
    due !== null &&
    alarmDays !== undefined &&
    new Date(due.year, due.month - 1, 1 - alarmDays) <=
      new Date(today.year, today.month - 1, today.day);

  const downloadCalendar = () => {
    if (kind === 'hu') {
      if (!car.huUntil) return;
      downloadTextFile(
        `hu-${car.huUntil.year}-${String(car.huUntil.month).padStart(2, '0')}.ics`,
        carHuCalendarFile(car, car.huUntil, now),
        'text/calendar;charset=utf-8',
      );
      return;
    }
    const file = reminderCalendarFile({
      kind,
      carId: car.id,
      title,
      month: calendarMonth,
      today,
      now,
    });
    if (!file) return;
    const suffix = due ? `-${due.year}-${String(due.month).padStart(2, '0')}` : '';
    const name = { service: 'inspektion', brakeFluid: 'bremsfluessigkeit', tyres: 'reifenwechsel' }[
      kind
    ];
    downloadTextFile(`${name}${suffix}.ics`, file, 'text/calendar;charset=utf-8');
  };

  const serverError = save.error ? errorOf(save.error) : null;
  const error = localError ?? serverError;
  const dueText =
    kind === 'hu' && car.huUntil
      ? huStatus(car.huUntil, now).text
      : kind === 'brakeFluid' && due
        ? monthsUntil(due, today) < 0
          ? `Nach der Empfehlung war der Wechsel im ${monthName(due)} fällig – also schon überfällig.`
          : `Nächster Wechsel nach der Empfehlung: ${monthName(due)} (${BRAKE_FLUID_MONTHS / 12} Jahre nach dem letzten).`
        : null;
  const reason = !editable
    ? 'Diese Erinnerung gehört zu KaufCheck Pro.'
    : !emailAvailable
      ? 'E-Mail-Erinnerungen sind derzeit nicht verfügbar.'
      : null;
  const checkboxDisabled = (!editable || !emailAvailable) && !email;

  return (
    <section className="card reminder" aria-labelledby={titleId}>
      <h2 id={titleId}>{REMINDER_LABELS[kind]}</h2>
      <p className="muted">{DESCRIPTIONS[kind]}</p>
      {dueText && <p>{dueText}</p>}
      {huMissing && (
        <p>
          Trag in <Link to="/mein-auto">„Mein Auto“</Link> über „Bearbeiten“ Monat und Jahr von der
          Prüfplakette ein, dann kann KaufCheck dich erinnern.
        </p>
      )}
      {/* Still shown when the HU month was removed later: the reminder can be switched off. */}
      {(!huMissing || reminder.email) && (
        <form className="stack" onSubmit={submit} noValidate aria-labelledby={titleId}>
          {needsMonth && (
            <fieldset className="car-form__pair">
              <legend>
                {kind === 'service' ? 'Nächste Inspektion fällig im' : 'Zuletzt gewechselt im'}
              </legend>
              <div className="car-form__pair-fields">
                <SelectField
                  label="Monat"
                  value={month}
                  disabled={!editable}
                  aria-invalid={error?.month ? true : undefined}
                  aria-describedby={error?.month ? monthErrorId : undefined}
                  onChange={(event) => setMonth(event.target.value)}
                >
                  <option value="">Monat</option>
                  {MONTHS.map((name, index) => (
                    <option key={name} value={index + 1}>
                      {name}
                    </option>
                  ))}
                </SelectField>
                <TextField
                  label="Jahr"
                  inputMode="numeric"
                  maxLength={4}
                  value={year}
                  disabled={!editable}
                  onChange={(event) => setYear(event.target.value)}
                  aria-invalid={error?.month ? true : undefined}
                  aria-describedby={error?.month ? monthErrorId : undefined}
                />
              </div>
              {error?.month && (
                <p className="field__error" id={monthErrorId}>
                  {error.message}
                </p>
              )}
            </fieldset>
          )}
          <div>
            <label className="consent">
              <input
                type="checkbox"
                className="checkbox"
                checked={email}
                // Switching off always works, also without Pro.
                disabled={checkboxDisabled}
                aria-describedby={checkboxDisabled && reason ? reasonId : undefined}
                onChange={(event) => setEmail(event.target.checked)}
              />
              <span>Per E-Mail erinnern</span>
            </label>
            {checkboxDisabled && reason && (
              <p className="field__hint" id={reasonId}>
                {reason}
              </p>
            )}
          </div>
          {reminder.email && editable && emailAvailable && !dirty && (
            <PlanLine kind={kind} car={car} reminder={reminder} confirmed={confirmed} />
          )}
          {error && !error.month && (
            <Alert tone="error">
              <p>{error.message}</p>
            </Alert>
          )}
          <div className="button-row">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={save.isPending}
              disabled={!dirty || (!editable && email)}
            >
              Speichern<span className="visually-hidden">: {REMINDER_LABELS[kind]}</span>
            </Button>
            {calendarAllowed && calendarPossible && !calendarTooLate && (
              <Button
                variant="secondary"
                size="sm"
                icon={<CalendarPlus aria-hidden size={16} />}
                onClick={downloadCalendar}
              >
                In den Kalender<span className="visually-hidden">: {REMINDER_LABELS[kind]}</span>
              </Button>
            )}
            {dirty && <span className="reminder__dirty">Noch nicht gespeichert</span>}
          </div>
          {calendarAllowed && calendarPossible && (
            <p className="muted car-card__note">
              {calendarTooLate
                ? 'Der Termin ist diesen Monat oder schon vorbei – ein Kalendereintrag lohnt sich nicht mehr.'
                : alarmPast
                  ? 'Der Termin steht am Monatsersten in deinem Kalender.'
                  : CALENDAR_NOTES[kind]}
            </p>
          )}
        </form>
      )}
    </section>
  );
}

function EmailStatus({
  address,
  confirmed,
  pending,
  anyEmail,
}: {
  address: string;
  confirmed: boolean;
  pending: boolean;
  anyEmail: boolean;
}) {
  const resend = useRequestReminderConfirmation();
  const toast = useToast();
  if (confirmed)
    return (
      <p>
        Erinnerungen gehen an <strong>{address}</strong>.
      </p>
    );
  if (!anyEmail)
    return (
      <p className="muted">
        Erinnerungen gehen an <strong>{address}</strong>. Beim ersten Einschalten schicken wir dir
        einen Link, mit dem du die Adresse bestätigst.
      </p>
    );
  return (
    <Alert
      tone="warning"
      title="Bitte bestätige deine E-Mail-Adresse"
      actions={
        <Button
          variant="secondary"
          size="sm"
          loading={resend.isPending}
          onClick={() =>
            resend.mutate(undefined, {
              onSuccess: () => toast.show(`Wir haben dir einen Link an ${address} geschickt`),
              onError: (error) => toast.show(errorOf(error).message),
            })
          }
        >
          {pending ? 'Link erneut senden' : 'Bestätigungslink senden'}
        </Button>
      }
    >
      <p>
        {pending
          ? `Wir haben dir einen Link an ${address} geschickt. Erst nach der Bestätigung bekommst du Erinnerungen. Schau auch im Spam-Ordner nach.`
          : `Bestätige deine Adresse ${address}, damit wir dir Erinnerungen schicken können.`}
      </p>
    </Alert>
  );
}

/**
 * Reminders for one car: e-mail after confirming the address (the HU with any
 * account, the others with Pro) and calendar files.
 */
export function RemindersPage() {
  usePageMeta(META);
  const { id = '' } = useParams();
  const me = useMe();
  const config = useConfig();
  const signedIn = Boolean(me.data?.user);
  const cars = useOwnedCars(signedIn);
  const car = cars.data?.items.find((item) => item.id === id);
  const reminders = useCarReminders(id, car !== undefined);

  if (me.isPending || (signedIn && cars.isPending)) return <PageLoading />;
  if (!signedIn)
    return (
      <div className="container page">
        <h1>Erinnerungen</h1>
        <p>
          Melde dich an, um die Erinnerungen für dein Auto einzustellen.{' '}
          <Link to="/anmelden" state={{ returnTo: `/mein-auto/${id}/erinnerungen` }}>
            Anmelden
          </Link>
        </p>
      </div>
    );
  if (!car)
    return (
      <div className="container page">
        <h1>Erinnerungen</h1>
        <p>
          {cars.isError
            ? 'Deine Autos konnten nicht geladen werden.'
            : 'Dieses Auto gibt es nicht.'}{' '}
          <Link to="/mein-auto">Zu „Mein Auto“</Link>
        </p>
      </div>
    );

  const data = reminders.data;
  const emailAvailable = config.data?.features.reminders ?? false;
  const anyEmail = data?.items.some((item) => item.email) ?? false;
  // Switched on with Pro and kept after it ended: these are not sent now.
  const anyProEmail = data?.items.some((item) => item.email && !item.editable) ?? false;

  return (
    <div className="container page reminders">
      <nav className="breadcrumbs" aria-label="Brotkrümelnavigation">
        <ol>
          <li>
            <Link to="/mein-auto">Mein Auto</Link>
          </li>
          <li>
            <span aria-current="page">Erinnerungen</span>
          </li>
        </ol>
      </nav>
      <div className="page__header">
        <div>
          <h1>Erinnerungen: {carName(car)}</h1>
          <p className="page__lead">
            KaufCheck erinnert dich per E-Mail an HU, Inspektion, Bremsflüssigkeit und Reifenwechsel
            – oder du übernimmst die Termine in deinen Kalender. Die E-Mails enthalten nur die
            Erinnerung, keine Werbung; abbestellen kannst du sie jederzeit. Jede Erinnerung
            speicherst du einzeln. Die Erinnerungen sind ein Service; für die Fristen bleibst du
            selbst verantwortlich.
          </p>
        </div>
      </div>

      {reminders.isPending ? (
        <PageLoading />
      ) : reminders.isError || !data ? (
        <Alert
          tone="error"
          title="Die Erinnerungen konnten nicht geladen werden"
          actions={<Button onClick={() => void reminders.refetch()}>Erneut versuchen</Button>}
        />
      ) : (
        <div className="stack">
          {!data.editable && (
            <Alert
              tone="info"
              title="Inspektion, Bremsflüssigkeit und Reifen gehören zu KaufCheck Pro"
            >
              <p>
                {anyProEmail
                  ? 'Ohne Pro verschicken wir nur die Erinnerung an die HU. Deine übrigen Einstellungen bleiben gespeichert und gelten wieder, sobald du Pro hast; ausschalten kannst du sie jederzeit.'
                  : 'An die HU erinnern wir dich kostenlos. Mit Pro erinnert dich KaufCheck auch an Inspektion, Bremsflüssigkeit und Reifenwechsel, und du übernimmst diese Termine in deinen Kalender.'}
              </p>
              <p>
                <Link to="/pro" onClick={() => track('pro_clicked', { placement: 'reminders' })}>
                  KaufCheck Pro ansehen
                </Link>
              </p>
            </Alert>
          )}
          {!emailAvailable && (
            <Alert tone="info" title="E-Mail-Erinnerungen sind derzeit nicht verfügbar">
              <p>Die Termine kannst du trotzdem in deinen Kalender übernehmen.</p>
            </Alert>
          )}
          {emailAvailable && (
            <EmailStatus
              address={data.emailAddress}
              confirmed={data.emailConfirmed}
              pending={data.confirmationPending}
              anyEmail={anyEmail}
            />
          )}
          {data.items.map((reminder) => (
            <ReminderForm
              key={reminder.kind}
              car={car}
              reminder={reminder}
              emailAvailable={emailAvailable}
              confirmed={data.emailConfirmed}
              address={data.emailAddress}
            />
          ))}
        </div>
      )}
    </div>
  );
}
