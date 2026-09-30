import { PASSWORD_MIN_LENGTH } from '@kaufcheck/shared';
import { useState, type FormEvent, type ReactNode } from 'react';
import { ApiRequestError } from '../../api/client';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/Field';

export interface Credentials {
  email: string;
  password: string;
}

function fieldError(error: unknown, field: string): string | null {
  if (!(error instanceof ApiRequestError)) return null;
  return error.details?.fieldErrors?.[field]?.[0] ?? null;
}

/** Shared e-mail/password form for sign-in and registration. */
export function AuthForm({
  mode,
  onSubmit,
  pending,
  error,
  footer,
}: {
  mode: 'login' | 'register';
  onSubmit: (credentials: Credentials) => void;
  pending: boolean;
  error: unknown;
  footer?: ReactNode;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.includes('@')) {
      setLocalError('Bitte gib eine gültige E-Mail-Adresse ein.');
      return;
    }
    if (mode === 'register' && password.length < PASSWORD_MIN_LENGTH) {
      setLocalError(`Das Passwort muss mindestens ${PASSWORD_MIN_LENGTH} Zeichen haben.`);
      return;
    }
    setLocalError(null);
    onSubmit({ email, password });
  };

  const apiError = error instanceof ApiRequestError ? error : null;
  const general = apiError && !apiError.details?.fieldErrors ? apiError.message : null;

  return (
    <form className="stack" onSubmit={submit} noValidate>
      {(localError ?? general) && <Alert tone="error">{localError ?? general}</Alert>}
      <TextField
        label="E-Mail-Adresse"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={fieldError(error, 'email')}
      />
      <TextField
        label="Passwort"
        type="password"
        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        required
        minLength={mode === 'register' ? PASSWORD_MIN_LENGTH : undefined}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        hint={
          mode === 'register'
            ? `Mindestens ${PASSWORD_MIN_LENGTH} Zeichen. Ein langer Satz ist sicherer als ein kurzes Wort.`
            : undefined
        }
        error={fieldError(error, 'password')}
      />
      <Button type="submit" size="lg" block loading={pending}>
        {mode === 'login' ? 'Anmelden' : 'Konto erstellen'}
      </Button>
      {footer}
    </form>
  );
}
