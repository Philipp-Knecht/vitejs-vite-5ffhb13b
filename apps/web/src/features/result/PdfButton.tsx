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

  const download = async () => {
    if (!me.data?.entitlements.pdfExport) {
      setUpsell(true);
      return;
    }
    setBusy(true);
    try {
      const modelId = knownModelId(dto.listing.vehicle);
      const [{ buildAnalysisPdf, analysisPdfFileName }, model] = await Promise.all([
        import('../pdf/analysis-pdf'),
        modelId ? loadKnowledge(modelId) : Promise.resolve(null),
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
    } catch {
      toast.show('Das PDF konnte nicht erstellt werden. Bitte versuch es noch einmal.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        variant="secondary"
        loading={busy}
        icon={<FileDown aria-hidden size={18} />}
        onClick={() => void download()}
      >
        PDF-Mappe
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
