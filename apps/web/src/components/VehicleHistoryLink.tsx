import { useId } from 'react';
import { useConfig, useMe } from '../api/queries';
import { track } from '../lib/analytics';
import { useHydrated } from '../lib/use-hydrated';

export type HistoryPlacement = 'result_recalls' | 'guide_checklist';

/**
 * A partner link to vehicle history reports by VIN (affiliate), for visitors
 * without Pro, configured on the server. A plain link: nothing is loaded from
 * the partner before the click, and no VIN or other data is handed over.
 * KaufCheck does not check the reports; the note says what they can miss.
 */
export function VehicleHistoryLink({ placement }: { placement: HistoryPlacement }) {
  const id = useId();
  // Not part of the prerendered page: it appears only once the plan is known.
  const hydrated = useHydrated();
  const me = useMe();
  const config = useConfig();
  // A configuration cached before this field existed (HTTP cache, offline copy) lacks it.
  const partner = config.data?.affiliates?.vehicleHistory ?? null;
  if (!hydrated || !partner || me.data?.entitlements.showAds !== true) return null;
  return (
    <aside className="affiliate" aria-label="Werbung: Affiliate-Link" data-placement={placement}>
      <span className="ad-slot__label" aria-hidden>
        Werbung
      </span>
      <p className="affiliate__link">
        <a
          href={partner.url}
          target="_blank"
          rel="sponsored noopener"
          aria-describedby={`${id}-note`}
          onClick={() => track('affiliate_clicked', { placement })}
        >
          Fahrzeughistorie mit der FIN bei {partner.name} abfragen*
          <span className="visually-hidden"> (öffnet in neuem Tab)</span>
        </a>
      </p>
      <p className="affiliate__note" id={`${id}-note`}>
        *Affiliate-Link: Kauft jemand über diesen Link einen Bericht, erhält KaufCheck eine
        Provision. Für dich entstehen keine Mehrkosten. Ein solcher Bericht enthält nur, was in den
        Datenquellen des Anbieters erfasst ist. KaufCheck prüft die Berichte nicht; sie ersetzen
        keine Besichtigung.
      </p>
    </aside>
  );
}
