import { useSearchParams } from 'react-router';
import { ApiRequestError } from '../../api/client';
import { useConfirmReminders, useUnsubscribeReminder } from '../../api/queries';
import { Alert } from '../../components/ui/Alert';
import { Button, ButtonLink } from '../../components/ui/Button';
import { appPageMeta } from '../../seo/pages';
import { usePageMeta } from '../../seo/use-page-meta';

const CONFIRM_META = appPageMeta('E-Mail-Adresse bestätigen');
const UNSUBSCRIBE_META = appPageMeta('Erinnerung abbestellen');

const message = (error: unknown) =>
  error instanceof ApiRequestError
    ? error.message
    : 'Das hat nicht geklappt. Bitte versuch es noch einmal.';

function Incomplete({ title }: { title: string }) {
  return (
    <div className="container page page--auth">
      <h1>{title}</h1>
      <Alert
        tone="warning"
        title="Der Link ist unvollständig"
        actions={<ButtonLink to="/mein-auto">Zu „Mein Auto“</ButtonLink>}
      >
        <p>Öffne den Link aus der E-Mail bitte vollständig.</p>
      </Alert>
    </div>
  );
}

/**
 * The link from the confirmation e-mail. Confirming needs a click: mail
 * scanners that open links would otherwise confirm for the recipient.
 */
export function ConfirmRemindersPage() {
  usePageMeta(CONFIRM_META);
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const confirm = useConfirmReminders();
  if (!token) return <Incomplete title="E-Mail-Adresse bestätigen" />;
  return (
    <div className="container page page--auth">
      <h1>E-Mail-Adresse bestätigen</h1>
      {confirm.isSuccess ? (
        <Alert
          tone="success"
          title="Bestätigt"
          actions={<ButtonLink to="/mein-auto">Zu „Mein Auto“</ButtonLink>}
        >
          <p>
            Ab jetzt bekommst du die Erinnerungen, die du eingeschaltet hast. Jede E-Mail enthält
            einen Link zum Abbestellen.
          </p>
        </Alert>
      ) : (
        <div className="stack">
          <p>
            Bestätige, dass KaufCheck dir die Erinnerungen schicken darf, die du in „Mein Auto“
            einschaltest. Du kannst sie jederzeit wieder ausschalten.
          </p>
          {confirm.isError && (
            <Alert tone="error">
              <p>{message(confirm.error)}</p>
            </Alert>
          )}
          <div>
            <Button
              variant="primary"
              loading={confirm.isPending}
              onClick={() => confirm.mutate(token)}
            >
              E-Mail-Adresse bestätigen
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** The unsubscribe link in the text of a reminder; the one-click header posts directly. */
export function UnsubscribeReminderPage() {
  usePageMeta(UNSUBSCRIBE_META);
  const [params] = useSearchParams();
  const reminder = params.get('r') ?? '';
  const token = params.get('t') ?? '';
  const unsubscribe = useUnsubscribeReminder();
  if (!reminder || !token) return <Incomplete title="Erinnerung abbestellen" />;
  return (
    <div className="container page page--auth">
      <h1>Erinnerung abbestellen</h1>
      {unsubscribe.isSuccess ? (
        <Alert
          tone="success"
          title="Abbestellt"
          actions={<ButtonLink to="/mein-auto">Zu „Mein Auto“</ButtonLink>}
        >
          <p>
            Diese Erinnerung schicken wir dir nicht mehr. Andere Erinnerungen und deine Angaben in
            „Mein Auto“ bleiben, wie sie sind.
          </p>
        </Alert>
      ) : (
        <div className="stack">
          <p>Möchtest du diese Erinnerung nicht mehr per E-Mail bekommen?</p>
          {unsubscribe.isError && (
            <Alert tone="error">
              <p>{message(unsubscribe.error)}</p>
            </Alert>
          )}
          <div>
            <Button
              variant="primary"
              loading={unsubscribe.isPending}
              onClick={() => unsubscribe.mutate({ reminder, token })}
            >
              Erinnerung abbestellen
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
