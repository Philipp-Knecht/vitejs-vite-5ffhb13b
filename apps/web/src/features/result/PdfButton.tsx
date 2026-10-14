import { loadKnowledge } from '@kaufcheck/catalog/knowledge';
import type { AnalysisDto } from '@kaufcheck/shared';
import { FileDown } from 'lucide-react';
import { useState } from 'react';
import { useMe } from '../../api/queries';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { useToast } from '../../components/ui/toast-context';
import { track } from '../../lib/analytics';
import { isBoolean, isStringArray, readJson } from '../../lib/storage';
import { knownModelId } from './known-model';
import { checklistStorageKey, FORMAL_ADDRESS_KEY } from './storage-keys';
import { vehicleTitle } from './vehicle-title';

/**
 * Downloads the analysis as a PDF ("Besichtigungsmappe", Pro). The PDF is built
 * in the browser; the PDF library is loaded only when it is needed.
 */
export function PdfButton({ dto }: { dto: AnalysisDto }) {
  const me = useMe();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [upsell, setUpsell] = useState(false);

  const isPro = me.data?.entitlements.pdfExport ?? false;

  const download = async () => {
    if (!me.data) {
      toast.show(
        me.isError
          ? 'Dein Konto konnte nicht geladen werden. Bitte lade die Seite neu.'
          : 'Dein Konto wird noch geladen. Bitte versuch es gleich noch einmal.',
      );
      return;
    }
    if (!isPro) {
      setUpsell(true);
      return;
    }
    setBusy(true);
    try {
      const modelId = knownModelId(dto.listing.vehicle);
      const [{ buildAnalysisPdf, analysisPdfFileName }, model] = await Promise.all([
        import('../pdf/analysis-pdf'),
        // Without the model knowledge the PDF is still useful.
        modelId ? loadKnowledge(modelId).catch(() => null) : Promise.resolve(null),
      ]);
      const createdAt = new Date();
      const doc = buildAnalysisPdf({
        dto,
        model,
        formal: readJson(FORMAL_ADDRESS_KEY, true, isBoolean),
        checked: new Set(readJson(checklistStorageKey(dto.id), [], isStringArray)),
        siteUrl: window.location.origin,
        createdAt,
      });
      doc.save(analysisPdfFileName(vehicleTitle(dto), createdAt));
      track('analysis_pdf_downloaded');
      toast.show('PDF erstellt');
    } catch (error) {
      console.error('PDF export failed', error);
      toast.show(
        'Das PDF konnte nicht erstellt werden. Bitte lade die Seite neu und versuch es noch einmal.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        variant="secondary"
        loading={busy || me.isPending}
        icon={<FileDown aria-hidden size={18} />}
        onClick={() => void download()}
      >
        Als PDF herunterladen
        {me.data && !isPro && <span className="tag tag--pro">Pro</span>}
      </Button>
      <Dialog
        open={upsell}
        onClose={() => setUpsell(false)}
        title="Prüfung als PDF-Mappe"
        footer={
          <>
            <ButtonLink to="/pro" onClick={() => track('pro_clicked', { placement: 'pdf_export' })}>
              KaufCheck Pro ansehen
            </ButtonLink>
            <Button variant="secondary" onClick={() => setUpsell(false)}>
              Schließen
            </Button>
          </>
        }
      >
        <p>
          Mit KaufCheck Pro lädst du jede Prüfung als PDF herunter: Kurzfassung, Auffälligkeiten,
          bekannte Schwachstellen, Fragen an den Verkäufer, Rückruf-Check und die Checkliste zum
          Abhaken – ideal zum Ausdrucken für die Besichtigung.
        </p>
        <p>Ohne Pro kannst du die Checkliste weiterhin über „Drucken“ ausdrucken.</p>
      </Dialog>
    </>
  );
}
