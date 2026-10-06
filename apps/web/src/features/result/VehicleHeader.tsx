import { PRICE_KIND_LABELS, SELLER_TYPE_LABELS, type AnalysisDto } from '@kaufcheck/shared';
import { ExternalLink, FileText, Link2, MapPin, Store, UserRound } from 'lucide-react';
import { useToast } from '../../components/ui/toast-context';
import { Button } from '../../components/ui/Button';
import { copyText } from '../../lib/clipboard';
import { formatDateTime, formatIsoDay } from '../../lib/format';
import { listingPlatformName } from '../../lib/platform';
import { SaveButton } from './SaveButton';
import { vehicleTitle } from './vehicle-title';

function locationText(dto: AnalysisDto): string | null {
  const location = dto.listing.location;
  if (!location) return null;
  const place = [location.postalCode, location.city].filter(Boolean).join(' ');
  if (!place) return location.raw || null;
  return location.district ? `${place} – ${location.district}` : place;
}

export function VehicleHeader({ dto }: { dto: AnalysisDto }) {
  const toast = useToast();
  const { listing, analysis } = dto;
  const title = vehicleTitle(dto);
  const chips = (analysis.vehicleSummary?.chips ?? []).filter((chip) => chip.key !== 'price');
  const price = analysis.priceContext.askingPrice;
  const place = locationText(dto);
  const sellerType = listing.seller.type ? SELLER_TYPE_LABELS[listing.seller.type] : null;
  const source = listing.source;
  const platformName = listingPlatformName(source.url);

  return (
    <header className="vehicle-header">
      {source.isExample && (
        <p className="example-banner">
          <strong>Fiktives Beispiel.</strong> Dieses Inserat ist ausgedacht und zeigt nur, wie eine
          Prüfung aussieht.
        </p>
      )}
      <div className="vehicle-header__top">
        <div className="vehicle-header__titles">
          {listing.status === 'reserved' && (
            <span className="status-badge status-badge--reserved">Reserviert</span>
          )}
          {listing.status === 'deleted' && (
            <span className="status-badge status-badge--deleted">Nicht mehr online</span>
          )}
          <h1 className="vehicle-header__title">{title}</h1>
          {listing.title && listing.title !== title && (
            <p className="vehicle-header__subtitle">Im Inserat: „{listing.title}“</p>
          )}
        </div>
        <div className="vehicle-header__price">
          {price ? (
            <>
              <span className="vehicle-header__amount">{price.display}</span>
              <span className="vehicle-header__price-kind">{PRICE_KIND_LABELS[price.kind]}</span>
            </>
          ) : (
            <span className="vehicle-header__price-kind">Kein Preis angegeben</span>
          )}
        </div>
      </div>

      {chips.length > 0 && (
        <ul className="chips" aria-label="Eckdaten">
          {chips.map((chip) => (
            <li key={chip.key} className="chip">
              {chip.text}
            </li>
          ))}
        </ul>
      )}

      <ul className="vehicle-header__meta">
        {place && (
          <li>
            <MapPin aria-hidden size={16} />
            {place}
          </li>
        )}
        {sellerType && (
          <li>
            {listing.seller.type === 'commercial' ? (
              <Store aria-hidden size={16} />
            ) : (
              <UserRound aria-hidden size={16} />
            )}
            {sellerType}
            {listing.seller.memberSince
              ? ` · aktiv seit ${formatIsoDay(listing.seller.memberSince)}`
              : ''}
          </li>
        )}
        <li>
          <FileText aria-hidden size={16} />
          {source.type === 'kleinanzeigen_url'
            ? `Abgerufen am ${formatDateTime(source.retrievedAt)}`
            : source.type === 'text'
              ? `Aus eingefügtem Text${platformName ? ` (${platformName})` : ''}, ${formatDateTime(source.retrievedAt)}`
              : 'Fiktives Beispiel'}
        </li>
      </ul>

      <div className="vehicle-header__actions">
        <SaveButton dto={dto} />
        {source.url && (
          <a
            className="btn btn--secondary btn--md"
            href={source.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
          >
            <ExternalLink aria-hidden size={18} />
            <span>{platformName ? `Inserat auf ${platformName} öffnen` : 'Inserat öffnen'}</span>
          </a>
        )}
        <Button
          variant="quiet"
          icon={<Link2 aria-hidden size={18} />}
          onClick={() => {
            void copyText(window.location.href).then((ok) =>
              toast.show(ok ? 'Link zur Prüfung kopiert' : 'Kopieren nicht möglich'),
            );
          }}
        >
          Link kopieren
        </Button>
      </div>
    </header>
  );
}
