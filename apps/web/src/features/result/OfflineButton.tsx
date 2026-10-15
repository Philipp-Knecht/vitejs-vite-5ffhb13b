import { CloudDownload, CloudOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/toast-context';
import {
  isSavedForOffline,
  offlineSupported,
  OutdatedPageError,
  refreshOfflineApp,
  removeOfflineCopy,
  saveForOffline,
} from '../../lib/offline';

/**
 * Saves this check on the device for the inspection, where there is often no
 * reception – only when the user asks for it.
 */
export function OfflineButton({ analysisId }: { analysisId: string }) {
  const toast = useToast();
  const [saved, setSaved] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void isSavedForOffline(analysisId).then((value) => {
      if (!active) return;
      setSaved(value);
      // After an update of KaufCheck the stored app files are brought up to date.
      if (value) void refreshOfflineApp(analysisId);
    });
    return () => {
      active = false;
    };
  }, [analysisId]);

  if (!offlineSupported() || saved === null) return null;

  const save = async () => {
    setBusy(true);
    try {
      await saveForOffline(analysisId);
      setSaved(true);
      toast.show(
        'Gespeichert – diese Prüfung öffnet sich in diesem Browser jetzt auch ohne Empfang.',
      );
    } catch (error) {
      console.warn('Offline copy not saved', error);
      toast.show(
        error instanceof OutdatedPageError
          ? 'KaufCheck wurde gerade aktualisiert. Lade die Seite bitte neu und speichere dann noch einmal.'
          : 'Offline speichern hat nicht geklappt. Bitte versuch es noch einmal.',
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await removeOfflineCopy(analysisId);
      setSaved(false);
      toast.show('Offline-Kopie gelöscht');
    } catch (error) {
      console.warn('Offline copy not removed', error);
      toast.show('Löschen hat nicht geklappt. Bitte versuch es noch einmal.');
    } finally {
      setBusy(false);
    }
  };

  return saved ? (
    <Button
      variant="secondary"
      loading={busy}
      icon={<CloudOff aria-hidden size={18} />}
      onClick={() => void remove()}
    >
      Offline-Kopie löschen
    </Button>
  ) : (
    <Button
      variant="secondary"
      loading={busy}
      icon={<CloudDownload aria-hidden size={18} />}
      onClick={() => void save()}
    >
      Offline verfügbar machen
    </Button>
  );
}
