import {
  BRAKE_FLUID_MONTHS,
  huStatus,
  monthText,
  monthsUntil,
  REMINDER_LABELS,
  reminderCalendarFile,
  reminderDueMonth,
  reminderMonthProblem,
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

const thisMonth = (now: Date): ReminderMonth => ({
  year: now.getFullYear(),
  month: now.getMonth() + 1,
});

const errorMessage = (error: unknown) =>
  error instanceof ApiRequestError
    ? (error.details?.fieldErrors?.month?.[0] ?? error.message)
    : 'Das hat nicht geklappt. Bitte versuch es noch einmal.';

const DESCRIPTIONS: Record<ReminderKind, string> = {
  hu: 'Eine E-Mail im Monat vor dem Monat auf der Prüfplakette. Ist die HU mehr als zwei Monate überzogen, wird eine teurere Ergänzungsuntersuchung fällig.',
  service:
    'Eine E-Mail im Monat vor der Inspektion. Wann sie fällig ist, steht im Serviceheft, auf dem letzten Werkstattzettel oder in der Anzeige im Auto.',
  brakeFluid:
    'Der ADAC empfiehlt, die Bremsflüssigkeit spätestens alle zwei Jahre zu wechseln; maßgeblich ist der Wartungsplan des Herstellers. Eine E-Mail im Monat vor dem Termin.',
  tyres:
    'Eine E-Mail Anfang Oktober und Anfang April. Feste Termine gibt es nicht: Bei Glätte, Schnee oder Schneematsch sind Winter- oder Ganzjahresreifen Pflicht; als Faustregel gilt „von O bis O“.',
};

function ReminderForm({
  car,
  reminder,
  editable,
  emailAvailable,
}: {
  car: OwnedCarDto;
  reminder: ReminderDto;
  editable: boolean;
  emailAvailable: boolean;
}) {
  const toast = useToast();
  const save = useSaveReminder(car.id);
  const kind = reminder.kind;
  const needsMonth = kind === 'service' || kind === 'brakeFluid';
  const [email, setEmail] = useState(reminder.email);
  const [month, setMonth] = useState(reminder.month ? String(reminder.month.month) : '');
  const [year, setYear] = useState(reminder.month ? String(reminder.month.year) : '');
  const [localError, setLocalError] = useState<string | null>(null);
  const titleId = `reminder-${kind}-title`;
  const now = new Date();
  const today = thisMonth(now);

  const typed = (): { value: ReminderMonth | null } | { error: string } => {
    if (!needsMonth || (!month && !year.trim())) return { value: null };
    const yearNumber = Number(year.trim());
    if (!month || !/^\d{4}$/.test(year.trim()))
      return { error: 'Bitte gib Monat und Jahr an, zum Beispiel März und 2027.' };
    return { value: { year: yearNumber, month: Number(month) } };
  };
  const current = typed();
  const savedMonth = reminder.month;
  const due = reminderDueMonth(kind, {
    huUntil: car.huUntil,
    month: 'value' in current ? current.value : savedMonth,
  });
  const huMissing = kind === 'hu' && !car.huUntil;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if ('error' in current) {
      setLocalError(current.error);
      return;
    }
    const problem = reminderMonthProblem(kind, current.value, today);
    if (problem) {
      setLocalError(problem);
      return;
    }
    if (email && needsMonth && current.value === null) {
      setLocalError(
        kind === 'service'
          ? 'Bitte gib an, wann die nächste Inspektion fällig ist.'
          : 'Bitte gib an, wann die Bremsflüssigkeit zuletzt gewechselt wurde.',
      );
      return;
    }
    setLocalError(null);
    save.mutate(
      { kind, input: { email, month: current.value } },
      {
        onSuccess: () => {
          toast.show(
            email
              ? `Erinnerung „${REMINDER_LABELS[kind]}“ ist eingeschaltet`
              : `Erinnerung „${REMINDER_LABELS[kind]}“ gespeichert`,
          );
          if (email && !reminder.email) track('reminder_enabled', { placement: kind });
        },
      },
    );
  };

  const downloadCalendar = () => {
    const title = car.nickname ? `${car.nickname} (${carTitle(car)})` : carTitle(car);
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
      month: 'value' in current ? current.value : null,
      today,
      now,
    });
    if (!file) return;
    downloadTextFile(
      kind === 'tyres'
        ? 'reifenwechsel.ics'
        : `${kind === 'service' ? 'inspektion' : 'bremsfluessigkeit'}-${due ? `${due.year}-${String(due.month).padStart(2, '0')}` : ''}.ics`,
      file,
      'text/calendar;charset=utf-8',
    );
  };

  const error = localError ?? (save.error ? errorMessage(save.error) : null);
  const calendarPossible =
    kind === 'tyres' ||
    (kind === 'hu' ? car.huUntil !== null : 'value' in current && current.value !== null);
  // A calendar entry in the past helps nobody.
  const calendarInPast = due !== null && monthsUntil(due, today) < 1;
  const dueText =
    kind === 'hu' && car.huUntil
      ? huStatus(car.huUntil, now).text
      : kind === 'brakeFluid' && due
        ? monthsUntil(due, today) < 0
          ? `Nach der Empfehlung war der Wechsel im ${monthText(due)} fällig – also schon überfällig.`
          : `Nächster Wechsel nach der Empfehlung: ${monthText(due)} (${BRAKE_FLUID_MONTHS / 12} Jahre nach dem letzten).`
        : null;

  return (
    <section className="card reminder" aria-labelledby={titleId}>
      <h2 id={titleId}>{REMINDER_LABELS[kind]}</h2>
      <p className="muted">{DESCRIPTIONS[kind]}</p>
      {dueText && <p>{dueText}</p>}
      {huMissing && (
        <p>
          Trag in <Link to="/mein-auto">„Mein Auto“</Link> Monat und Jahr von der Prüfplakette ein,
          dann kann KaufCheck dich erinnern.
        </p>
      )}
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
              />
            </div>
          </fieldset>
        )}
        <label className="consent">
          <input
            type="checkbox"
            className="checkbox"
            checked={email}
            // Without Pro or e-mail a reminder can still be switched off.
            disabled={(!editable || !emailAvailable || huMissing) && !email}
            onChange={(event) => setEmail(event.target.checked)}
          />
          <span>Per E-Mail erinnern</span>
        </label>
        {error && (
          <Alert tone="error">
            <p>{error}</p>
          </Alert>
        )}
        <div className="button-row">
          <Button
            type="submit"
            variant="primary"
            size="sm"
            loading={save.isPending}
            disabled={!editable && (email || !reminder.email)}
          >
            Speichern<span className="visually-hidden">: {REMINDER_LABELS[kind]}</span>
          </Button>
          {editable && calendarPossible && !calendarInPast && (
            <Button
              variant="secondary"
              size="sm"
              icon={<CalendarPlus aria-hidden size={16} />}
              onClick={downloadCalendar}
            >
              In den Kalender<span className="visually-hidden">: {REMINDER_LABELS[kind]}</span>
            </Button>
          )}
        </div>
      </form>
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
              onSuccess: () => toast.show('Wir haben dir einen neuen Link geschickt'),
              onError: (error) => toast.show(errorMessage(error)),
            })
          }
        >
          Link erneut senden
        </Button>
      }
    >
      <p>
        {pending
          ? `Wir haben dir einen Link an ${address} geschickt.`
          : `Der Link an ${address} ist abgelaufen.`}{' '}
        Erst nach der Bestätigung bekommst du Erinnerungen. Schau auch im Spam-Ordner nach.
      </p>
    </Alert>
  );
}

/** Reminders for one car: e-mail (Pro, after confirming the address) and calendar files. */
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
            Erinnerung, keine Werbung; jede kannst du mit einem Klick abbestellen.
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
            <Alert tone="info" title="Erinnerungen gehören zu KaufCheck Pro">
              <p>
                Mit Pro erinnert dich KaufCheck per E-Mail an Fristen deiner Autos und du übernimmst
                sie in deinen Kalender. Eingeschaltete Erinnerungen kannst du jederzeit ausschalten.
              </p>
              <p>
                <Link to="/pro" onClick={() => track('pro_clicked', { placement: 'reminders' })}>
                  KaufCheck Pro ansehen
                </Link>
              </p>
            </Alert>
          )}
          {data.editable && !emailAvailable && (
            <Alert tone="info" title="E-Mail-Erinnerungen sind derzeit nicht verfügbar">
              <p>Die Termine kannst du trotzdem in deinen Kalender übernehmen.</p>
            </Alert>
          )}
          {emailAvailable && (data.editable || data.items.some((item) => item.email)) && (
            <EmailStatus
              address={data.emailAddress}
              confirmed={data.emailConfirmed}
              pending={data.confirmationPending}
              anyEmail={data.items.some((item) => item.email)}
            />
          )}
          {data.items.map((reminder) => (
            <ReminderForm
              // A new server state (e.g. after unsubscribing) resets the form.
              key={`${reminder.kind}-${reminder.email}-${reminder.month?.year}-${reminder.month?.month}`}
              car={car}
              reminder={reminder}
              editable={data.editable}
              emailAvailable={emailAvailable}
            />
          ))}
        </div>
      )}
    </div>
  );
}
