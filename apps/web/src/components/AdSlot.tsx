import { useMe } from '../api/queries';

/**
 * Designated ad placements. Slots are only placed between content
 * sections – never next to warnings, input fields or action buttons.
 */
export type AdPlacement = 'result_bottom' | 'guide_bottom' | 'saved_listings_bottom';

const PROVIDER = import.meta.env.VITE_ADS_PROVIDER ?? 'none';

/**
 * Ad abstraction. No ad network is integrated yet: with `VITE_ADS_PROVIDER=placeholder`
 * a labelled box shows where an ad would appear (layout work), otherwise
 * nothing is rendered. Pro users never see ads, and nothing is shown until
 * the plan is known.
 */
export function AdSlot({ placement }: { placement: AdPlacement }) {
  const me = useMe();
  if (PROVIDER !== 'placeholder') return null;
  if (!me.data?.entitlements.showAds) return null;
  return (
    <aside className="ad-slot" aria-label="Anzeige" data-placement={placement}>
      <span className="ad-slot__label">Anzeige</span>
      <span className="ad-slot__placeholder">
        Platzhalter für eine Anzeige ({placement}) – nur in der Entwicklung sichtbar
      </span>
    </aside>
  );
}
