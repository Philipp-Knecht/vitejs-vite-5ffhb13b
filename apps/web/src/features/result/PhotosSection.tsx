import { isAllowedImageUrl, type ListingImage, type PhotoAnalysis } from '@kaufcheck/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { EvidenceBadge } from '../../components/EvidenceBadge';
import { ButtonLink } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { track } from '../../lib/analytics';
import { ResultSection } from './Section';

const FINDING_LABELS = {
  exterior_damage: 'Karosserie',
  warning_light: 'Warnleuchte',
  odometer: 'Kilometerstand',
  corrosion: 'Rost',
  tires: 'Reifen',
  other: 'Sonstiges',
} as const;

function PhotoAnalysisResult({
  analysis,
  onOpen,
}: {
  analysis: PhotoAnalysis;
  onOpen: (index: number) => void;
}) {
  switch (analysis.status) {
    case 'completed':
      return (
        <div className="photo-analysis">
          <h3 className="subsection-title">Auf den Fotos möglicherweise erkennbar</h3>
          {analysis.findings.length === 0 ? (
            <p className="muted">
              Auf{' '}
              {analysis.analyzedImageCount === 1
                ? 'dem geprüften Foto'
                : `den ${analysis.analyzedImageCount} geprüften Fotos`}{' '}
              wurde nichts Auffälliges erkannt. Das ersetzt keinen Blick auf das Auto.
            </p>
          ) : (
            <ul className="finding-list">
              {analysis.findings.map((finding) => (
                <li
                  key={`${finding.imageIndex}-${finding.type}-${finding.description}`}
                  className="finding"
                >
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => onOpen(finding.imageIndex)}
                  >
                    Foto {finding.imageIndex + 1}
                  </button>
                  <span className="tag">{FINDING_LABELS[finding.type]}</span>
                  <p>Auf dem Foto möglicherweise erkennbar: {finding.description}</p>
                  <p className="finding__confidence">
                    Einschätzung:{' '}
                    {finding.confidence === 'low' ? 'unsicher' : 'mittlere Sicherheit'}
                  </p>
                  <EvidenceBadge evidence="inference" origin="ai" />
                </li>
              ))}
            </ul>
          )}
          <p className="finding__caveat">
            Die automatische Bildauswertung kann sich irren und sieht nur, was fotografiert wurde.
            Prüfe diese Punkte bei der Besichtigung selbst.
          </p>
        </div>
      );
    case 'not_in_plan':
      return (
        <div className="photo-analysis photo-analysis--upsell">
          <p>{analysis.message ?? 'Die Fotoanalyse ist in KaufCheck Pro enthalten.'}</p>
          <ButtonLink
            to="/pro"
            variant="secondary"
            size="sm"
            onClick={() => track('pro_clicked', { placement: 'photo_analysis' })}
          >
            Mehr zu Pro
          </ButtonLink>
        </div>
      );
    default:
      return analysis.message ? <p className="muted">{analysis.message}</p> : null;
  }
}

export function PhotosSection({
  images,
  photoAnalysis,
  showPhotos,
  listingUrl,
  isText,
}: {
  images: ListingImage[];
  photoAnalysis: PhotoAnalysis;
  showPhotos: boolean;
  listingUrl: string | null;
  isText: boolean;
}) {
  // Keep the listing's photo numbering: findings refer to positions in the listing.
  const photos = images
    .map((image, index) => ({ image, number: index + 1 }))
    .filter(({ image }) => isAllowedImageUrl(image.url));
  const [open, setOpen] = useState<number | null>(null);
  // Photos of changed or removed listings disappear from the CDN.
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  const markFailed = (url: string) => setFailed((current) => new Set(current).add(url));
  const current = open === null ? undefined : photos[open];
  const openByListingIndex = (listingIndex: number) => {
    const position = photos.findIndex((photo) => photo.number === listingIndex + 1);
    if (position !== -1 && showPhotos) setOpen(position);
  };

  return (
    <ResultSection id="fotos" title="Fotos">
      {photos.length === 0 ? (
        <p className="muted">
          {isText
            ? 'Beim eingefügten Text sind keine Fotos enthalten.'
            : 'Das Inserat enthält keine Fotos.'}
        </p>
      ) : showPhotos ? (
        <ul className="photo-grid">
          {photos.map(({ image, number }, position) => (
            <li key={image.url}>
              {failed.has(image.url) ? (
                <div className="photo-grid__button">
                  <span className="photo-grid__missing">Foto {number} nicht mehr verfügbar</span>
                </div>
              ) : (
                <button
                  type="button"
                  className="photo-grid__button"
                  onClick={() => setOpen(position)}
                >
                  <img
                    src={image.thumbnailUrl ?? image.url}
                    alt={`Foto ${number} von ${images.length} aus dem Inserat`}
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    onError={() => markFailed(image.url)}
                  />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">
          Das Inserat enthält {photos.length} {photos.length === 1 ? 'Foto' : 'Fotos'}. Sie werden
          hier nicht angezeigt
          {listingUrl ? ' – du findest sie im Inserat.' : '.'}
        </p>
      )}

      <PhotoAnalysisResult analysis={photoAnalysis} onOpen={openByListingIndex} />

      <Dialog
        open={current !== undefined}
        onClose={() => setOpen(null)}
        title={current ? `Foto ${current.number} von ${images.length}` : 'Foto'}
        size="lg"
      >
        {current && open !== null && (
          <div className="lightbox">
            <img
              src={current.image.url}
              alt={`Foto ${current.number} aus dem Inserat`}
              referrerPolicy="no-referrer"
            />
            <div className="lightbox__nav">
              <button
                type="button"
                className="icon-button"
                aria-label="Vorheriges Foto"
                disabled={open === 0}
                onClick={() => setOpen(Math.max(0, open - 1))}
              >
                <ChevronLeft aria-hidden />
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label="Nächstes Foto"
                disabled={open === photos.length - 1}
                onClick={() => setOpen(Math.min(photos.length - 1, open + 1))}
              >
                <ChevronRight aria-hidden />
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </ResultSection>
  );
}
