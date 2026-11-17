import { useId } from 'react';
import { useConfig } from '../api/queries';
import { track } from '../lib/analytics';
import { useHydrated } from '../lib/use-hydrated';

export type HistoryPlacement = 'result' | 'guide_checklist';

/**
 * A partner link to vehicle history reports by VIN (affiliate), configured on the
 * server; Pro members see it too (it is a possibility, not an advertisement banner).
 * A plain link: nothing is loaded from the partner before the click. Only a FIN that
 * the listing names goes with the link, when the partner has a link for it; the note
 * says so. KaufCheck does not check the reports; the note says what they can miss.
 * Placed between sections, never inside the recall check, its steps or
 * warnings, so that it does not read as part of the free official checks.
 */
export function VehicleHistoryLink({
  placement,
  vin = null,
}: {
  placement: HistoryPlacement;
  /** The FIN named in the listing, if any. */
  vin?: string | null;
}) {
  const id = useId();
  // Not part of the prerendered page: it appears once the configuration is loaded.
  const hydrated = useHydrated();
  const config = useConfig();
  // A configuration cached before this field existed (HTTP cache, offline copy) lacks it.
  const partner = config.data?.affiliates?.vehicleHistory ?? null;
  if (!hydrated || !partner) return null;
  const withVin = vin !== null && partner.vinUrl ? partner.vinUrl.replace('{vin}', vin) : null;
  return (
    <aside className="affiliate" aria-label="Werbung: Affiliate-Link" data-placement={placement}>
      <span className="ad-slot__label" aria-hidden>
        Werbung
      </span>
      <p className="affiliate__link">
        <a
          href={withVin ?? partner.url}
          target="_blank"
          rel="sponsored noopener"
          aria-describedby={`${id}-note`}
          onClick={() => track('affiliate_clicked', { placement })}
        >
          Kostenpflichtigen Bericht zur Fahrzeughistorie bei {partner.name} abrufen*
          <span className="visually-hidden"> (öffnet in neuem Tab)</span>
        </a>
      </p>
      <p className="affiliate__note" id={`${id}-note`}>
        *Affiliate-Link: Kauft jemand über diesen Link einen Bericht, erhält KaufCheck eine
        Provision. Für dich entstehen keine Mehrkosten. Ein solcher Bericht enthält nur, was in den
        Datenquellen des Anbieters erfasst ist. KaufCheck prüft die Berichte nicht; sie ersetzen
        keine Besichtigung.
        {withVin && (
          <>
            {' '}
            Der Link gibt die FIN aus dem Inserat ({vin}) an {partner.name} weiter, damit du sie
            dort nicht abtippen musst.
          </>
        )}
      </p>
    </aside>
  );
}
