import { toSearchParams, type SearchQuery } from '@kaufcheck/catalog';
import { Bookmark } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { ApiRequestError } from '../../api/client';
import { useMe, useSaveSearch } from '../../api/queries';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/Field';
import { describeSearch } from './describe-search';

/** Saving the current search (Pro): to open it again later on all marketplaces. */
export function SaveSearch({ query }: { query: SearchQuery }) {
  const me = useMe();
  const save = useSaveSearch();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(() => describeSearch(query).slice(0, 80));

  if (!me.data) return null;
  if (me.data.entitlements.savedSearchesMax === 0) {
    return (
      <p className="save-search__hint">
        Suche speichern und später mit einem Klick wieder öffnen?{' '}
        <Link to="/pro">Das geht mit KaufCheck Pro.</Link>
      </p>
    );
  }
  if (save.isSuccess) {
    return (
      <p className="save-search__hint" role="status">
        Gespeichert – du findest die Suche unter{' '}
        <Link to="/meine-angebote#suchen">Meine Angebote</Link>.
      </p>
    );
  }
  if (!open) {
    return (
      <Button
        variant="secondary"
        icon={<Bookmark aria-hidden size={18} />}
        onClick={() => setOpen(true)}
      >
        Suche speichern
      </Button>
    );
  }
  return (
    <form
      className="save-search"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate({ name: name.trim(), query: toSearchParams(query).toString() });
      }}
    >
      <TextField
        label="Name der Suche"
        value={name}
        maxLength={80}
        required
        onChange={(event) => setName(event.target.value)}
        error={
          save.error
            ? save.error instanceof ApiRequestError
              ? save.error.message
              : 'Die Suche konnte nicht gespeichert werden.'
            : undefined
        }
      />
      <div className="button-row">
        <Button type="submit" loading={save.isPending}>
          Speichern
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Abbrechen
        </Button>
      </div>
    </form>
  );
}
