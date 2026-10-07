import { Search, Trash2 } from 'lucide-react';
import { Link } from 'react-router';
import { useDeleteSavedSearch, useSavedSearches } from '../../api/queries';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/toast-context';
import { describeSavedQuery } from '../search/describe-search';

/** The Pro member's saved car searches, each opened again on all marketplaces. */
export function SavedSearchesSection() {
  const searches = useSavedSearches(true);
  const remove = useDeleteSavedSearch();
  const toast = useToast();
  const items = searches.data?.items ?? [];

  return (
    <section id="suchen" className="page__section" aria-labelledby="searches-title">
      <h2 id="searches-title">Gespeicherte Suchen</h2>
      {searches.isPending ? null : items.length === 0 ? (
        <p className="muted">
          Noch keine Suche gespeichert. Starte eine Suche unter{' '}
          <Link to="/auto-finden">Auto finden</Link> und tippe auf „Suche speichern“.
        </p>
      ) : (
        <ul className="saved-searches">
          {items.map((item) => (
            <li key={item.id} className="saved-search">
              <div>
                <p className="saved-search__name">{item.name}</p>
                <p className="muted">{describeSavedQuery(item.query)}</p>
              </div>
              <div className="button-row">
                <Link to={`/auto-finden?${item.query}`} className="btn btn--primary btn--sm">
                  <Search aria-hidden size={16} />
                  <span>Suche öffnen</span>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Trash2 aria-hidden size={16} />}
                  aria-label={`Suche „${item.name}“ löschen`}
                  loading={remove.isPending && remove.variables === item.id}
                  onClick={() =>
                    remove.mutate(item.id, { onSuccess: () => toast.show('Suche gelöscht') })
                  }
                >
                  Löschen
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
