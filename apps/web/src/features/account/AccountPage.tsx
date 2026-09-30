import { PLAN_LABELS } from '@kaufcheck/shared';
import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { ApiRequestError } from '../../api/client';
import {
  useCheckout,
  useConfig,
  useDeleteAccount,
  useLogout,
  useMe,
  usePortal,
} from '../../api/queries';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
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

function DeleteAccountDialog({ onClose }: { onClose: () => void }) {
  const remove = useDeleteAccount();
  const navigate = useNavigate();
  const toast = useToast();
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
            loading={remove.isPending}
            disabled={!password}
            onClick={() =>
              remove.mutate(password, {
                onSuccess: () => {
                  toast.show('Dein Konto wurde gelöscht');
                  void navigate('/', { replace: true });
                },
              })
            }
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
        Dein Konto, alle gespeicherten Angebote und deine Prüfungen werden sofort gelöscht. Ein
        laufendes Abo wird gekündigt. Das lässt sich nicht rückgängig machen.
      </p>
      <TextField
        label="Zur Bestätigung dein Passwort"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={remove.error instanceof ApiRequestError ? remove.error.message : null}
      />
    </Dialog>
  );
}

export function AccountPage() {
  usePageMeta(META);
  const [params] = useSearchParams();
  const checkoutDone = params.get('checkout') === 'erfolgreich';
  // After checkout the plan changes once the payment provider confirms it (webhook): poll briefly.
  const me = useMe({
    poll: checkoutDone
      ? (data, updates) => (data?.plan === 'pro' || updates > 20 ? false : 3000)
      : undefined,
  });
  const config = useConfig();
  const logout = useLogout();
  const checkout = useCheckout();
  const portal = usePortal();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);

  if (me.isPending) return <PageLoading />;
  if (!me.data?.user) return <Navigate to="/anmelden" state={{ returnTo: '/konto' }} replace />;

  const { user, plan, usage, subscription, entitlements } = me.data;
  const billing = config.data?.features.billing ?? false;
  const billingError = [checkout.error, portal.error].find(
    (error) => error instanceof ApiRequestError,
  );

  return (
    <div className="container page page--narrow">
      <h1>Dein Konto</h1>

      {checkoutDone && (
        <Alert
          tone={plan === 'pro' ? 'success' : 'info'}
          title={plan === 'pro' ? 'KaufCheck Pro ist aktiv' : 'Danke für deine Buchung'}
        >
          <p>
            {plan === 'pro'
              ? 'Viel Erfolg bei der Suche nach dem passenden Auto.'
              : 'Sobald die Zahlung bestätigt ist, wird Pro freigeschaltet. Das dauert meist nur wenige Sekunden.'}
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
        <Button
          variant="secondary"
          loading={logout.isPending}
          onClick={() => logout.mutate(undefined, { onSuccess: () => void navigate('/') })}
        >
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
        {billingError instanceof ApiRequestError && (
          <Alert tone="error">{billingError.message}</Alert>
        )}
        <div className="button-row">
          {plan !== 'pro' && billing && (
            <Button
              loading={checkout.isPending}
              onClick={() => {
                track('pro_clicked', { placement: 'account' });
                checkout.mutate(undefined, { onSuccess: ({ url }) => window.location.assign(url) });
              }}
            >
              Pro buchen
            </Button>
          )}
          {subscription && billing && (
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

      {deleting && <DeleteAccountDialog onClose={() => setDeleting(false)} />}
    </div>
  );
}
