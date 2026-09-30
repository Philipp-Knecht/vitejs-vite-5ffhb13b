import { Link } from 'react-router';
import { useHistory, useMe } from '../../api/queries';
import { Alert } from '../../components/ui/Alert';
import { Button, ButtonLink } from '../../components/ui/Button';
import { PageLoading } from '../../components/ui/Spinner';
import { track } from '../../lib/analytics';
import { formatDateTime } from '../../lib/format';
import { appPageMeta } from '../../seo/pages';
import { usePageMeta } from '../../seo/use-page-meta';

const META = appPageMeta('Verlauf');

export function HistoryPage() {
  usePageMeta(META);
  const me = useMe();
  const allowed = Boolean(me.data?.user && me.data.entitlements.history);
  const history = useHistory(allowed);

  if (me.isPending) return <PageLoading />;

  return (
    <div className="container page">
      <h1>Verlauf</h1>
      {!me.data?.user ? (
        <Alert
          tone="info"
          title="Melde dich an, um deinen Verlauf zu sehen"
          actions={
            <ButtonLink to="/anmelden" state={{ returnTo: '/verlauf' }}>
              Anmelden
            </ButtonLink>
          }
        />
      ) : !allowed ? (
        <Alert
          tone="info"
          title="Der Verlauf ist Teil von KaufCheck Pro"
          actions={
            <ButtonLink to="/pro" onClick={() => track('pro_clicked', { placement: 'history' })}>
              Mehr zu Pro
            </ButtonLink>
          }
        >
          <p>
            Mit Pro findest du alle Inserate wieder, die du geprüft hast – auch ohne sie zu
            speichern.
          </p>
        </Alert>
      ) : history.isPending ? (
        <PageLoading />
      ) : history.isError ? (
        <Alert
          tone="error"
          title="Der Verlauf konnte nicht geladen werden"
          actions={<Button onClick={() => void history.refetch()}>Erneut versuchen</Button>}
        />
      ) : history.data.items.length === 0 ? (
        <div className="empty-state">
          <h2>Noch keine Prüfungen</h2>
          <ButtonLink to="/">Inserat prüfen</ButtonLink>
        </div>
      ) : (
        <ul className="history-list">
          {history.data.items.map((item) => (
            <li key={item.id} className="history-item">
              <Link to={`/analyse/${item.id}`} className="history-item__title">
                {item.title}
              </Link>
              <p className="history-item__meta">
                {item.priceDisplay ?? 'Kein Preis'} · {item.completenessScore} % der Angaben ·{' '}
                {formatDateTime(item.createdAt)}
                {item.isExample ? ' · fiktives Beispiel' : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
