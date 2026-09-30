import { DEFAULT_ENTITLEMENTS, PASSWORD_MIN_LENGTH } from '@kaufcheck/shared';
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router';
import { ApiRequestError } from '../../api/client';
import {
  useConfig,
  useConfirmPasswordReset,
  useLogin,
  useMe,
  useRegister,
  useRequestPasswordReset,
} from '../../api/queries';
import { Alert } from '../../components/ui/Alert';
import { Button, ButtonLink } from '../../components/ui/Button';
import { TextField } from '../../components/ui/Field';
import { PageLoading } from '../../components/ui/Spinner';
import { appPageMeta } from '../../seo/pages';
import { usePageMeta } from '../../seo/use-page-meta';
import { AuthForm } from './AuthForm';

/** Only internal paths are accepted as return targets. */
function useReturnTo(fallback: string): string {
  const location = useLocation();
  const target = (location.state as { returnTo?: unknown } | null)?.returnTo;
  return typeof target === 'string' && target.startsWith('/') && !target.startsWith('//')
    ? target
    : fallback;
}

const LOGIN_META = appPageMeta('Anmelden');
const REGISTER_META = appPageMeta('Konto erstellen');
const FORGOT_META = appPageMeta('Passwort vergessen');
const RESET_META = appPageMeta('Neues Passwort');

export function LoginPage() {
  usePageMeta(LOGIN_META);
  const me = useMe();
  const login = useLogin();
  const navigate = useNavigate();
  const returnTo = useReturnTo('/meine-angebote');

  if (me.isPending) return <PageLoading />;
  if (me.data?.user && !login.isSuccess) return <Navigate to={returnTo} replace />;

  return (
    <div className="container page page--auth">
      <h1>Anmelden</h1>
      <p className="page__lead">
        Melde dich an, um gespeicherte Angebote zu sehen und zu vergleichen.
      </p>
      <AuthForm
        mode="login"
        pending={login.isPending}
        error={login.error}
        onSubmit={(credentials) =>
          login.mutate(credentials, { onSuccess: () => void navigate(returnTo, { replace: true }) })
        }
        footer={
          <p className="auth-links">
            <Link to="/passwort-vergessen">Passwort vergessen?</Link>
            <span>
              Noch kein Konto?{' '}
              <Link to="/registrieren" state={{ returnTo }}>
                Kostenlos registrieren
              </Link>
            </span>
          </p>
        }
      />
    </div>
  );
}

export function RegisterPage() {
  usePageMeta(REGISTER_META);
  const me = useMe();
  const config = useConfig();
  const register = useRegister();
  const navigate = useNavigate();
  const returnTo = useReturnTo('/meine-angebote');
  const free = (config.data?.plans ?? DEFAULT_ENTITLEMENTS).free;

  if (me.isPending) return <PageLoading />;
  if (me.data?.user && !register.isSuccess) return <Navigate to={returnTo} replace />;

  return (
    <div className="container page page--auth">
      <h1>Kostenloses Konto erstellen</h1>
      <ul className="check-list check-list--compact">
        <li>{free.monthlyAnalyses} Prüfungen pro Monat</li>
        <li>Bis zu {free.savedListingsMax} Angebote speichern und erneut prüfen</li>
        <li>Bis zu {free.compareMax} Angebote nebeneinander vergleichen</li>
      </ul>
      <AuthForm
        mode="register"
        pending={register.isPending}
        error={register.error}
        onSubmit={(credentials) =>
          register.mutate(credentials, {
            onSuccess: () => void navigate(returnTo, { replace: true }),
          })
        }
        footer={
          <>
            <p className="muted">
              Prüfungen, die du in diesem Browser ohne Konto gemacht hast, werden deinem Konto
              zugeordnet. Wie wir mit deinen Daten umgehen, steht in der{' '}
              <Link to="/datenschutz">Datenschutzerklärung</Link>.
            </p>
            <p className="auth-links">
              <span>
                Schon registriert?{' '}
                <Link to="/anmelden" state={{ returnTo }}>
                  Anmelden
                </Link>
              </span>
            </p>
          </>
        }
      />
    </div>
  );
}

export function ForgotPasswordPage() {
  usePageMeta(FORGOT_META);
  const config = useConfig();
  const request = useRequestPasswordReset();
  const [email, setEmail] = useState('');

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    request.mutate(email);
  };

  return (
    <div className="container page page--auth">
      <h1>Passwort vergessen</h1>
      {config.data && !config.data.features.passwordReset ? (
        <Alert tone="info" title="Derzeit nicht verfügbar">
          <p>Das Zurücksetzen per E-Mail ist auf diesem Server nicht eingerichtet.</p>
        </Alert>
      ) : request.isSuccess ? (
        <Alert tone="success" title="Schau in dein Postfach">
          <p>
            Wenn es ein Konto mit dieser Adresse gibt, haben wir dir einen Link geschickt. Er ist
            eine Stunde gültig. Sieh auch im Spam-Ordner nach.
          </p>
        </Alert>
      ) : (
        <form className="stack" onSubmit={submit} noValidate>
          <p className="page__lead">
            Gib deine E-Mail-Adresse ein. Wir schicken dir einen Link, mit dem du ein neues Passwort
            festlegst.
          </p>
          {request.error instanceof ApiRequestError && (
            <Alert tone="error">{request.error.message}</Alert>
          )}
          <TextField
            label="E-Mail-Adresse"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Button type="submit" size="lg" block loading={request.isPending}>
            Link anfordern
          </Button>
        </form>
      )}
      <p className="auth-links">
        <Link to="/anmelden">Zurück zur Anmeldung</Link>
      </p>
    </div>
  );
}

export function ResetPasswordPage() {
  usePageMeta(RESET_META);
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const confirm = useConfirmPasswordReset();
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password.length < PASSWORD_MIN_LENGTH) {
      setLocalError(`Das Passwort muss mindestens ${PASSWORD_MIN_LENGTH} Zeichen haben.`);
      return;
    }
    setLocalError(null);
    confirm.mutate({ token, password });
  };

  if (!token) {
    return (
      <div className="container page page--auth">
        <h1>Neues Passwort</h1>
        <Alert
          tone="warning"
          title="Der Link ist unvollständig"
          actions={<ButtonLink to="/passwort-vergessen">Neuen Link anfordern</ButtonLink>}
        >
          <p>Öffne den Link aus der E-Mail bitte vollständig.</p>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container page page--auth">
      <h1>Neues Passwort festlegen</h1>
      {confirm.isSuccess ? (
        <Alert
          tone="success"
          title="Passwort geändert"
          actions={<ButtonLink to="/anmelden">Jetzt anmelden</ButtonLink>}
        >
          <p>Aus Sicherheitsgründen wurdest du auf allen Geräten abgemeldet.</p>
        </Alert>
      ) : (
        <form className="stack" onSubmit={submit} noValidate>
          {(localError ??
            (confirm.error instanceof ApiRequestError ? confirm.error.message : null)) && (
            <Alert tone="error">
              {localError ??
                (confirm.error instanceof ApiRequestError ? confirm.error.message : '')}
            </Alert>
          )}
          <TextField
            label="Neues Passwort"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            hint={`Mindestens ${PASSWORD_MIN_LENGTH} Zeichen.`}
          />
          <Button type="submit" size="lg" block loading={confirm.isPending}>
            Passwort speichern
          </Button>
        </form>
      )}
    </div>
  );
}
