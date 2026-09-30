import type { AnalysisDto } from '@kaufcheck/shared';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { useState } from 'react';
import { useLocation } from 'react-router';
import { ApiRequestError } from '../../api/client';
import { useMe, useSaveListing } from '../../api/queries';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { useToast } from '../../components/ui/toast-context';
import { track } from '../../lib/analytics';

export function SaveButton({ dto }: { dto: AnalysisDto }) {
  const me = useMe();
  const save = useSaveListing();
  const toast = useToast();
  const location = useLocation();
  const [dialog, setDialog] = useState<'login' | 'limit' | null>(null);
  const [limitMessage, setLimitMessage] = useState('');

  if (dto.savedListingId) {
    return (
      <ButtonLink
        to="/meine-angebote"
        variant="secondary"
        icon={<BookmarkCheck aria-hidden size={18} />}
      >
        Gespeichert
      </ButtonLink>
    );
  }

  const onSave = () => {
    if (!me.data?.user) {
      setDialog('login');
      return;
    }
    save.mutate(dto.id, {
      onSuccess: () => toast.show('In „Meine Angebote“ gespeichert'),
      onError: (error) => {
        if (error instanceof ApiRequestError && error.code === 'PLAN_LIMIT_REACHED') {
          setLimitMessage(error.message);
          setDialog('limit');
        } else {
          toast.show(
            error instanceof ApiRequestError ? error.message : 'Speichern hat nicht geklappt',
          );
        }
      },
    });
  };

  const returnState = { returnTo: location.pathname };

  return (
    <>
      <Button onClick={onSave} loading={save.isPending} icon={<Bookmark aria-hidden size={18} />}>
        Speichern
      </Button>
      <Dialog
        open={dialog === 'login'}
        onClose={() => setDialog(null)}
        title="Angebot speichern"
        footer={
          <>
            <ButtonLink to="/registrieren" state={returnState}>
              Kostenloses Konto erstellen
            </ButtonLink>
            <ButtonLink to="/anmelden" state={returnState} variant="secondary">
              Anmelden
            </ButtonLink>
          </>
        }
      >
        <p>
          Mit einem kostenlosen Konto kannst du Angebote speichern, später erneut prüfen und
          nebeneinander vergleichen. Diese Prüfung wird deinem Konto automatisch zugeordnet.
        </p>
      </Dialog>
      <Dialog
        open={dialog === 'limit'}
        onClose={() => setDialog(null)}
        title="Speicherplatz voll"
        footer={
          <>
            <ButtonLink to="/pro" onClick={() => track('pro_clicked', { placement: 'save_limit' })}>
              KaufCheck Pro ansehen
            </ButtonLink>
            <ButtonLink to="/meine-angebote" variant="secondary">
              Meine Angebote
            </ButtonLink>
          </>
        }
      >
        <p>{limitMessage}</p>
      </Dialog>
    </>
  );
}
