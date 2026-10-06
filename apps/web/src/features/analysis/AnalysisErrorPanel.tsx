import { useNavigate } from 'react-router';
import type { AnalysisRequest } from '../../api/analysis-stream';
import type { ApiRequestError } from '../../api/client';
import { useMe } from '../../api/queries';
import { Alert } from '../../components/ui/Alert';
import { Button, ButtonLink } from '../../components/ui/Button';
import { track } from '../../lib/analytics';
import { formatDate } from '../../lib/format';

/** Explains a failed analysis and offers the most useful next step. */
export function AnalysisErrorPanel({
  error,
  request,
  onRetry,
  onDismiss,
}: {
  error: ApiRequestError;
  request: AnalysisRequest;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  const navigate = useNavigate();
  const me = useMe();

  if (error.code === 'USAGE_LIMIT_REACHED') {
    const signedIn = Boolean(me.data?.user);
    const resetsAt = error.details?.resetsAt;
    return (
      <Alert
        tone="warning"
        title="Monatliches Kontingent aufgebraucht"
        actions={
          signedIn ? (
            <ButtonLink
              to="/pro"
              onClick={() => track('pro_clicked', { placement: 'usage_limit' })}
            >
              KaufCheck Pro ansehen
            </ButtonLink>
          ) : (
            <>
              <ButtonLink to="/registrieren">Kostenloses Konto erstellen</ButtonLink>
              <ButtonLink to="/anmelden" variant="secondary">
                Anmelden
              </ButtonLink>
            </>
          )
        }
      >
        <p>{error.message}</p>
        {resetsAt && (
          <p>
            Neue Prüfungen gibt es ab dem {formatDate(resetsAt)}. Das Beispiel kannst du jederzeit
            ansehen.
          </p>
        )}
      </Alert>
    );
  }

  if (error.fallbackToText && request.kind === 'url') {
    return (
      <Alert
        tone="info"
        title={error.message}
        actions={
          <>
            <Button
              onClick={() =>
                void navigate('/inseratstext', {
                  state: {
                    url: request.url,
                    ...(error.details?.platform
                      ? { reason: 'retrieval_disabled', platform: error.details.platform }
                      : {}),
                  },
                })
              }
            >
              Inseratstext einfügen
            </Button>
            <Button variant="quiet" onClick={onDismiss}>
              Anderen Link prüfen
            </Button>
          </>
        }
      >
        <p>
          {error.code === 'LISTING_NOT_FOUND'
            ? 'Wenn du das Inserat noch geöffnet hast, kannst du den Text kopieren und hier einfügen.'
            : 'Du kannst den Text des Inserats kopieren und einfügen – die Prüfung ist dann genauso ausführlich.'}
        </p>
      </Alert>
    );
  }

  if (error.code === 'RATE_LIMITED') {
    const seconds = error.details?.retryAfterSeconds;
    return (
      <Alert
        tone="warning"
        title="Kurz durchatmen"
        actions={<Button onClick={onRetry}>Erneut versuchen</Button>}
      >
        <p>
          {error.message}
          {seconds ? ` Versuche es in etwa ${seconds} Sekunden noch einmal.` : ''}
        </p>
      </Alert>
    );
  }

  const retryable = ['FETCH_FAILED', 'SERVICE_UNAVAILABLE', 'INTERNAL_ERROR'].includes(error.code);
  return (
    <Alert
      tone={retryable ? 'error' : 'warning'}
      title={retryable ? 'Das hat nicht geklappt' : 'Prüfung nicht möglich'}
      actions={
        retryable ? (
          <Button onClick={onRetry}>Erneut versuchen</Button>
        ) : (
          <Button variant="secondary" onClick={onDismiss}>
            Zurück
          </Button>
        )
      }
    >
      <p>{error.message}</p>
      {error.requestId && retryable && (
        <p className="alert__meta">Fehlerkennung: {error.requestId}</p>
      )}
    </Alert>
  );
}
