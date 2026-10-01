import type { SavedListingDto } from '@kaufcheck/shared';
import { Columns3, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ApiRequestError } from '../../api/client';
import {
  useDeleteSavedListing,
  useMe,
  useRenameSavedListing,
  useSavedListings,
} from '../../api/queries';
import { Alert } from '../../components/ui/Alert';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { TextField } from '../../components/ui/Field';
import { PageLoading } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/toast-context';
import { formatDateTime } from '../../lib/format';
import { appPageMeta } from '../../seo/pages';
import { usePageMeta } from '../../seo/use-page-meta';
import { AnalysisErrorPanel } from '../analysis/AnalysisErrorPanel';
import { AnalysisProgress } from '../analysis/AnalysisProgress';
import { useAnalysisRunner } from '../analysis/use-analysis-runner';

const META = appPageMeta('Meine Angebote');

function SignedOut() {
  return (
    <div className="empty-state">
      <h2>Angebote speichern und vergleichen</h2>
      <p>
        Mit einem kostenlosen Konto merkst du dir interessante Angebote, prüfst sie später erneut
        und vergleichst sie nebeneinander.
      </p>
      <div className="button-row">
        <ButtonLink to="/registrieren" state={{ returnTo: '/meine-angebote' }}>
          Kostenloses Konto erstellen
        </ButtonLink>
        <ButtonLink to="/anmelden" state={{ returnTo: '/meine-angebote' }} variant="secondary">
          Anmelden
        </ButtonLink>
      </div>
    </div>
  );
}

function RenameDialog({ item, onClose }: { item: SavedListingDto; onClose: () => void }) {
  const rename = useRenameSavedListing();
  const [title, setTitle] = useState(item.customTitle ?? '');
  return (
    <Dialog
      open
      onClose={onClose}
      title="Angebot umbenennen"
      footer={
        <>
          <Button
            loading={rename.isPending}
            onClick={() =>
              rename.mutate({ id: item.id, title: title.trim() || null }, { onSuccess: onClose })
            }
          >
            Speichern
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Abbrechen
          </Button>
        </>
      }
    >
      <TextField
        label="Eigener Name"
        value={title}
        maxLength={120}
        onChange={(event) => setTitle(event.target.value)}
        placeholder={item.listingTitle ?? 'z. B. „Der Blaue aus Leipzig“'}
        hint="Leer lassen, um den Titel aus dem Inserat zu verwenden."
        error={rename.error instanceof ApiRequestError ? rename.error.message : null}
      />
    </Dialog>
  );
}

function DeleteDialog({ item, onClose }: { item: SavedListingDto; onClose: () => void }) {
  const remove = useDeleteSavedListing();
  const toast = useToast();
  return (
    <Dialog
      open
      onClose={onClose}
      title="Angebot löschen?"
      footer={
        <>
          <Button
            variant="danger"
            loading={remove.isPending}
            onClick={() =>
              remove.mutate(item.id, {
                onSuccess: () => {
                  toast.show('Angebot gelöscht');
                  onClose();
                },
              })
            }
          >
            Löschen
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Abbrechen
          </Button>
        </>
      }
    >
      <p>„{item.title}“ wird aus deinen gespeicherten Angeboten entfernt.</p>
    </Dialog>
  );
}

function SavedCard({
  item,
  selected,
  selectable,
  onToggle,
  onRename,
  onDelete,
  onReanalyze,
  busy,
}: {
  item: SavedListingDto;
  selected: boolean;
  selectable: boolean;
  onToggle: () => void;
  onRename: () => void;
  onDelete: () => void;
  onReanalyze: () => void;
  busy: boolean;
}) {
  const checkboxId = `compare-${item.id}`;
  return (
    <li className="saved-card">
      <div className="saved-card__select">
        <input
          id={checkboxId}
          type="checkbox"
          className="checkbox"
          checked={selected}
          disabled={!selected && !selectable}
          onChange={onToggle}
        />
        <label htmlFor={checkboxId} className="visually-hidden">
          „{item.title}“ zum Vergleich auswählen
        </label>
      </div>
      <div className="saved-card__body">
        <Link to={`/analyse/${item.analysisId}`} className="saved-card__title">
          {item.title}
        </Link>
        {item.customTitle && item.listingTitle && (
          <p className="saved-card__subtitle">{item.listingTitle}</p>
        )}
        <p className="saved-card__price">{item.priceDisplay ?? 'Kein Preis angegeben'}</p>
        {item.chips.length > 0 && (
          <ul className="chips chips--small">
            {item.chips.map((chip) => (
              <li key={chip} className="chip">
                {chip}
              </li>
            ))}
          </ul>
        )}
        <p className="saved-card__meta">
          {item.completenessScore} % der wichtigen Angaben vorhanden · geprüft am{' '}
          {formatDateTime(item.analyzedAt)}
          {item.isExample
            ? ' · fiktives Beispiel'
            : item.sourceType === 'text'
              ? ' · aus eingefügtem Text'
              : ''}
        </p>
        <div className="saved-card__actions">
          <Button
            variant="quiet"
            size="sm"
            icon={<RefreshCw aria-hidden size={16} />}
            onClick={onReanalyze}
            disabled={busy || !item.canReanalyze}
          >
            Neu prüfen
          </Button>
          <Button
            variant="quiet"
            size="sm"
            icon={<Pencil aria-hidden size={16} />}
            onClick={onRename}
          >
            Umbenennen
          </Button>
          <Button
            variant="quiet"
            size="sm"
            icon={<Trash2 aria-hidden size={16} />}
            onClick={onDelete}
          >
            Löschen
          </Button>
        </div>
      </div>
    </li>
  );
}

export function SavedListingsPage() {
  usePageMeta(META);
  const me = useMe();
  const signedIn = Boolean(me.data?.user);
  const saved = useSavedListings(signedIn);
  const runner = useAnalysisRunner();
  const navigate = useNavigate();
  const [selection, setSelection] = useState<readonly string[]>([]);
  const [dialog, setDialog] = useState<{ type: 'rename' | 'delete'; item: SavedListingDto } | null>(
    null,
  );

  if (me.isPending) return <PageLoading />;
  const compareMax = me.data?.entitlements.compareMax ?? 0;
  const items = saved.data?.items ?? [];
  const selected = selection.filter((id) => items.some((item) => item.id === id));

  const toggle = (id: string) =>
    setSelection((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );

  return (
    <div className="container page">
      <div className="page__header">
        <div>
          <h1>Meine Angebote</h1>
          {signedIn && saved.data && saved.data.limit < 500 && (
            <p className="page__lead">
              {items.length} von {saved.data.limit} Plätzen belegt
            </p>
          )}
        </div>
        {signedIn && <ButtonLink to="/">Neues Inserat prüfen</ButtonLink>}
      </div>

      {!signedIn ? (
        <SignedOut />
      ) : saved.isPending ? (
        <PageLoading />
      ) : saved.isError ? (
        <Alert
          tone="error"
          title="Deine Angebote konnten nicht geladen werden"
          actions={<Button onClick={() => void saved.refetch()}>Erneut versuchen</Button>}
        />
      ) : items.length === 0 ? (
        <div className="empty-state">
          <h2>Noch keine Angebote gespeichert</h2>
          <p>
            Prüfe ein Inserat und tippe auf „Speichern“. Hier kannst du es dann später erneut prüfen
            oder mit anderen vergleichen.
          </p>
          <ButtonLink to="/">Inserat prüfen</ButtonLink>
        </div>
      ) : (
        <>
          {runner.state.phase === 'running' && (
            <AnalysisProgress
              stages={runner.state.stages}
              kind="reanalysis"
              onCancel={runner.cancel}
            />
          )}
          {runner.state.phase === 'failed' && (
            <AnalysisErrorPanel
              error={runner.state.error}
              request={runner.state.request}
              onRetry={() =>
                runner.state.phase === 'failed' && void runner.start(runner.state.request)
              }
              onDismiss={runner.reset}
            />
          )}
          <p className="muted">
            {compareMax > 0
              ? `Wähle zwei bis ${compareMax} Angebote aus, um sie zu vergleichen.`
              : 'Vergleiche sind mit einem Konto verfügbar.'}
          </p>
          <ul className="saved-list">
            {items.map((item) => (
              <SavedCard
                key={item.id}
                item={item}
                selected={selected.includes(item.id)}
                selectable={selected.length < compareMax}
                onToggle={() => toggle(item.id)}
                onRename={() => setDialog({ type: 'rename', item })}
                onDelete={() => setDialog({ type: 'delete', item })}
                onReanalyze={() =>
                  void runner.start({ kind: 'reanalysis', savedListingId: item.id })
                }
                busy={runner.state.phase === 'running'}
              />
            ))}
          </ul>
          {selected.length > 0 && (
            <div className="compare-bar" role="region" aria-label="Vergleich">
              <p>
                {selected.length} ausgewählt
                {selected.length < 2 ? ' – wähle mindestens noch eins' : ''}
              </p>
              <Button
                icon={<Columns3 aria-hidden size={18} />}
                disabled={selected.length < 2}
                onClick={() =>
                  void navigate(`/vergleich?ids=${selected.map(encodeURIComponent).join(',')}`)
                }
              >
                Vergleichen
              </Button>
            </div>
          )}
        </>
      )}

      {dialog?.type === 'rename' && (
        <RenameDialog item={dialog.item} onClose={() => setDialog(null)} />
      )}
      {dialog?.type === 'delete' && (
        <DeleteDialog item={dialog.item} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}
