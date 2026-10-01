import {
  berlinDate,
  CANCEL_BUTTON_LABEL,
  CANCEL_PATH,
  PLAN_LABELS,
  WITHDRAW_BUTTON_LABEL,
  WITHDRAW_PATH,
} from '@kaufcheck/shared';
import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { ApiRequestError } from '../../api/client';
import { useConfig, useDeleteAccount, useLogout, useMe, usePortal } from '../../api/queries';
import { Alert } from '../../components/ui/Alert';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { TextField } from '../../components/ui/Field';
import { PageLoading } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/toast-context';
import { track } from '../../lib/analytics';
import { formatDate } from '../../lib/format';
import { appPageMeta } from '../../seo/pages';
import { usePageMeta } from '../../seo/use-page-meta';

const META = appPageMeta('Konto');

const SUBSCRIPTION_STATUS: Record<string, string> = {
  active: 'aktiv',
  trialing: 'Testphase',
  past_due: 'Zahlung ausstehend',
  canceled: 'gekündigt',
  incomplete: 'nicht abgeschlossen',
  incomplete_expired: 'abgelaufen',
  unpaid: 'unbezahlt',
  paused: 'pausiert',
};

function DeleteAccountDialog({
  pending,
  error,
  onConfirm,
  onClose,
}: {
  pending: boolean;
  error: unknown;
  onConfirm: (password: string) => void;
  onClose: () => void;
}) {
  const [password, setPassword] = useState('');
  return (
    <Dialog
      open
      onClose={onClose}
      title="Konto löschen?"
      footer={
        <>
          <Button
            variant="danger"
            loading={pending}
            disabled={!password}
            onClick={() => onConfirm(password)}
          >
            Endgültig löschen
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Abbrechen
          </Button>
        </>
      }
    >
      <p>
        Dein Konto, alle gespeicherten Angebote und deine Prüfungen werden sofort gelöscht. Das
        lässt sich nicht rückgängig machen.
      </p>
      <p>
        Ein laufendes Pro-Abo endet mit der Löschung; für den bezahlten Monat erstatten wir nichts.
        Möchtest du nur Pro beenden, nutze „<Link to={CANCEL_PATH}>{CANCEL_BUTTON_LABEL}</Link>“.
        Nachweise zu Bestellungen, Kündigungen und Widerrufen bewahren wir auf, solange das Gesetz
        es verlangt.
      </p>
      <TextField
        label="Zur Bestätigung dein Passwort"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={error instanceof ApiRequestError ? error.message : null}
      />
    </Dialog>
  );
}

export function AccountPage() {
  usePageMeta(META);
  const me = useMe();
  const config = useConfig();
  const logout = useLogout();
  const portal = usePortal();
  const remove = useDeleteAccount();
  const navigate = useNavigate();
  const toast = useToast();
  const [deleting, setDeleting] = useState(false);
  // While signing out or deleting, stay mounted until the navigation to the homepage.
  const [leaving, setLeaving] = useState(false);

  const signOut = () => {
    setLeaving(true);
    logout.mutate(undefined, {
      onSuccess: () => void navigate('/', { replace: true }),
      onError: () => setLeaving(false),
    });
  };

  const deleteAccount = (password: string) => {
    setLeaving(true);
    remove.mutate(password, {
      onSuccess: () => {
        toast.show('Dein Konto wurde gelöscht');
        void navigate('/', { replace: true });
      },
      onError: () => setLeaving(false),
    });
  };

  if (me.isPending) return <PageLoading />;
  if (!me.data?.user) {
    return leaving ? (
      <PageLoading />
    ) : (
      <Navigate to="/anmelden" state={{ returnTo: '/konto' }} replace />
    );
  }

  const { user, plan, usage, subscription, entitlements, contract } = me.data;
  const billing = config.data?.features.billing ?? false;
  const withdrawalOpen = contract !== null && berlinDate(new Date()) <= contract.withdrawalEndsAt;

  return (
    <div className="container page page--narrow">
      <h1>Dein Konto</h1>

      {withdrawalOpen && contract && (
        <Alert
          tone="info"
          title="Widerrufsrecht"
          actions={
            <ButtonLink to={WITHDRAW_PATH} variant="secondary" size="sm">
              {WITHDRAW_BUTTON_LABEL}
            </ButtonLink>
          }
        >
          <p>
            Deinen Vertrag über KaufCheck Pro (Bestellung {contract.orderNumber}, geschlossen am{' '}
            {formatDate(contract.concludedAt)}) kannst du binnen 14 Tagen ab Vertragsschluss ohne
            Angabe von Gründen widerrufen.
          </p>
        </Alert>
      )}

      <section className="card" aria-labelledby="account-data">
        <h2 id="account-data">Zugang</h2>
        <dl className="definition-list">
          <div>
            <dt>E-Mail-Adresse</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>Dabei seit</dt>
            <dd>{formatDate(user.createdAt)}</dd>
          </div>
        </dl>
        <Button variant="secondary" loading={logout.isPending} onClick={signOut}>
          Abmelden
        </Button>
      </section>

      <section className="card" aria-labelledby="account-plan">
        <h2 id="account-plan">Tarif: {PLAN_LABELS[plan]}</h2>
        <dl className="definition-list">
          <div>
            <dt>Prüfungen in diesem Monat</dt>
            <dd>
              {usage.used} von {usage.limit} · neue ab {formatDate(usage.resetsAt)}
            </dd>
          </div>
          <div>
            <dt>Gespeicherte Angebote</dt>
            <dd>
              bis zu {entitlements.savedListingsMax} ·{' '}
              <Link to="/meine-angebote">Meine Angebote</Link>
            </dd>
          </div>
          {entitlements.history && (
            <div>
              <dt>Verlauf</dt>
              <dd>
                <Link to="/verlauf">Alle Prüfungen ansehen</Link>
              </dd>
            </div>
          )}
          {subscription && (
            <div>
              <dt>Abo</dt>
              <dd>
                {SUBSCRIPTION_STATUS[subscription.status] ?? subscription.status}
                {subscription.currentPeriodEnd &&
                  (subscription.cancelAtPeriodEnd
                    ? ` · endet am ${formatDate(subscription.currentPeriodEnd)}`
                    : ` · verlängert sich am ${formatDate(subscription.currentPeriodEnd)}`)}
              </dd>
            </div>
          )}
        </dl>
        {portal.error instanceof ApiRequestError && (
          <Alert tone="error">{portal.error.message}</Alert>
        )}
        <div className="button-row">
          {plan !== 'pro' && billing && (
            <ButtonLink
              to="/pro/bestellen"
              onClick={() => track('pro_clicked', { placement: 'account' })}
            >
              Pro bestellen
            </ButtonLink>
          )}
          {subscription && (
            <Button
              variant="secondary"
              loading={portal.isPending}
              onClick={() =>
                portal.mutate(undefined, { onSuccess: ({ url }) => window.location.assign(url) })
              }
            >
              Abo verwalten
            </Button>
          )}
          {subscription && (
            <ButtonLink to={CANCEL_PATH} variant="secondary">
              {CANCEL_BUTTON_LABEL}
            </ButtonLink>
          )}
        </div>
        {plan !== 'pro' && !billing && (
          <p className="muted">
            Die Bezahlung ist noch nicht freigeschaltet. Bis dahin kannst du KaufCheck kostenlos
            nutzen.
          </p>
        )}
      </section>

      <section className="card card--danger" aria-labelledby="account-delete">
        <h2 id="account-delete">Konto löschen</h2>
        <p>Löscht dein Konto mit allen gespeicherten Angeboten und Prüfungen.</p>
        <Button variant="danger" onClick={() => setDeleting(true)}>
          Konto löschen
        </Button>
      </section>

      {deleting && (
        <DeleteAccountDialog
          pending={remove.isPending}
          error={remove.error}
          onConfirm={deleteAccount}
          onClose={() => setDeleting(false)}
        />
      )}
    </div>
  );
}
