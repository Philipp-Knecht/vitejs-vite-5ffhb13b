import type { AnalysisDto } from '@kaufcheck/shared';
import { useParams } from 'react-router';
import { ApiRequestError } from '../../api/client';
import { useAnalysis, useConfig } from '../../api/queries';
import { AdSlot } from '../../components/AdSlot';
import { EvidenceLegend } from '../../components/EvidenceBadge';
import { Alert } from '../../components/ui/Alert';
import { Button, ButtonLink } from '../../components/ui/Button';
import { PageLoading } from '../../components/ui/Spinner';
import { appPageMeta } from '../../seo/pages';
import { usePageMeta } from '../../seo/use-page-meta';
import { AttentionSection } from './AttentionSection';
import { ChecklistSection } from './ChecklistSection';
import { CompletenessSection } from './CompletenessSection';
import { OverviewSection } from './OverviewSection';
import { PhotosSection } from './PhotosSection';
import { PriceSection } from './PriceSection';
import { QuestionsSection } from './QuestionsSection';
import { SummarySection } from './SummarySection';
import { VehicleHeader } from './VehicleHeader';
import { vehicleTitle } from './vehicle-title';

const SECTIONS = [
  { id: 'zusammenfassung', label: 'Kurzfassung' },
  { id: 'ueberblick', label: 'Überblick' },
  { id: 'preis', label: 'Preis' },
  { id: 'was-wissen-wir', label: 'Was wissen wir?' },
  { id: 'darauf-achten', label: 'Darauf achten' },
  { id: 'fragen', label: 'Fragen' },
  { id: 'besichtigung', label: 'Besichtigung' },
  { id: 'fotos', label: 'Fotos' },
];

function SectionNav() {
  return (
    <nav className="section-nav" aria-label="Abschnitte der Prüfung">
      <ul>
        {SECTIONS.map((section) => (
          <li key={section.id}>
            <a href={`#${section.id}`}>{section.label}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function AnalysisMeta({ dto }: { dto: AnalysisDto }) {
  const { ai, disclaimer, rulesVersion } = dto.analysis;
  return (
    <footer className="analysis-meta">
      <p className="analysis-meta__disclaimer">{disclaimer}</p>
      <p className="analysis-meta__line">
        {ai.status === 'completed'
          ? ai.isMock
            ? 'Ergänzt um eine simulierte KI-Einschätzung (Entwicklungsmodus, kein echtes KI-Modell).'
            : `Ergänzt um eine KI-Einschätzung${ai.model ? ` (${ai.model})` : ''}. KI-Hinweise sind als „KI“ gekennzeichnet und automatisch mit dem Inserat abgeglichen.`
          : ai.status === 'not_configured'
            ? 'Alle Hinweise stammen aus festen Prüfregeln – ohne KI.'
            : (ai.message ??
              'Die KI-Einschätzung war nicht verfügbar; die Prüfregeln wurden vollständig angewendet.')}{' '}
        Regelwerk {rulesVersion}.
      </p>
      <details className="analysis-meta__legend">
        <summary>So liest du die Kennzeichnungen</summary>
        <EvidenceLegend />
      </details>
    </footer>
  );
}

function ResultView({ dto }: { dto: AnalysisDto }) {
  const config = useConfig();
  const title = vehicleTitle(dto);
  usePageMeta(appPageMeta(title));
  const { analysis, listing } = dto;

  return (
    <div className="container result">
      <VehicleHeader dto={dto} />
      <div className="result__layout">
        <aside className="result__aside">
          <SectionNav />
        </aside>
        <div className="result__content">
          <SummarySection analysis={analysis} />
          <OverviewSection items={analysis.overview} />
          <PriceSection price={analysis.priceContext} />
          <CompletenessSection completeness={analysis.completeness} />
          <AttentionSection observations={analysis.observations} checks={analysis.checks} />
          <QuestionsSection
            questions={analysis.sellerQuestions}
            vehicleTitle={analysis.vehicleSummary?.title ?? null}
            listingUrl={listing.source.url}
          />
          <ChecklistSection analysisId={dto.id} sections={analysis.inspectionChecklist} />
          <PhotosSection
            images={listing.images}
            photoAnalysis={analysis.photoAnalysis}
            showPhotos={config.data?.features.listingPhotos ?? false}
            listingUrl={listing.source.url}
            isText={listing.source.type === 'text'}
          />
          <AnalysisMeta dto={dto} />
          <AdSlot placement="result_bottom" />
        </div>
      </div>
    </div>
  );
}

export function ResultPage() {
  const { id = '' } = useParams();
  const query = useAnalysis(id);

  if (query.isPending) return <PageLoading label="Prüfung wird geladen …" />;
  if (query.isError) {
    const notFound = query.error instanceof ApiRequestError && query.error.code === 'NOT_FOUND';
    return <ResultError notFound={notFound} onRetry={() => void query.refetch()} />;
  }
  // Remount per analysis so local state (checklist, selections) never leaks between results.
  return <ResultView key={query.data.id} dto={query.data} />;
}

function ResultError({ notFound, onRetry }: { notFound: boolean; onRetry: () => void }) {
  usePageMeta(appPageMeta(notFound ? 'Prüfung nicht gefunden' : 'Prüfung'));
  return (
    <div className="container page page--narrow">
      {notFound ? (
        <Alert
          tone="info"
          title="Diese Prüfung gibt es nicht (mehr)"
          actions={<ButtonLink to="/inserat-pruefen">Neues Inserat prüfen</ButtonLink>}
        >
          <p>
            Prüfungen ohne Konto werden nach einiger Zeit gelöscht. Gespeicherte Angebote findest du
            unter „Meine Angebote“.
          </p>
        </Alert>
      ) : (
        <Alert
          tone="error"
          title="Die Prüfung konnte nicht geladen werden"
          actions={<Button onClick={onRetry}>Erneut versuchen</Button>}
        >
          <p>Bitte prüfe deine Verbindung und versuche es noch einmal.</p>
        </Alert>
      )}
    </div>
  );
}
