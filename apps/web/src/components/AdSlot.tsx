import { useEffect, useRef } from 'react';
import { useConfig, useMe } from '../api/queries';
import { loadAdSense, requestAd } from '../lib/adsense';
import { privacySignal } from '../lib/privacy-signals';

/**
 * Designated ad placements: below editorial or analysis content – never next
 * to warnings, input fields or action buttons, and not on pages without
 * content of our own (account, sign-in, saved listings, errors).
 */
export type AdPlacement = 'result_bottom' | 'guide_bottom';

/** `placeholder` shows labelled boxes for layout work (development only). */
const PLACEHOLDER = import.meta.env.VITE_ADS_PROVIDER === 'placeholder';

function AdSenseUnit({ client, slot }: { client: string; slot: string }) {
  const requested = useRef(false);
  useEffect(() => {
    loadAdSense(client);
    if (requested.current) return;
    requested.current = true;
    requestAd();
  }, [client]);
  return (
    <ins
      className="adsbygoogle"
      style={{ display: 'block' }}
      data-ad-client={client}
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
}

/**
 * Shows a Google AdSense unit (configured on the server) to visitors
 * without Pro. Nothing is loaded for Pro, while the plan is unknown, or when
 * the browser sends Do Not Track / Global Privacy Control. Unfilled units –
 * for example without consent – stay invisible.
 */
export function AdSlot({ placement }: { placement: AdPlacement }) {
  const me = useMe();
  const config = useConfig();
  const ads = config.data?.ads ?? null;
  if (me.data?.entitlements.showAds !== true) return null;
  if (ads) {
    if (privacySignal()) return null;
    return (
      <aside className="ad-slot ad-slot--adsense" aria-label="Werbung" data-placement={placement}>
        <span className="ad-slot__label">Werbung</span>
        <AdSenseUnit client={ads.client} slot={ads.slot} />
      </aside>
    );
  }
  if (!PLACEHOLDER) return null;
  return (
    <aside className="ad-slot ad-slot--placeholder" aria-label="Werbung" data-placement={placement}>
      <span className="ad-slot__label">Werbung</span>
      <span className="ad-slot__placeholder">
        Platzhalter für eine Anzeige ({placement}) – nur in der Entwicklung sichtbar
      </span>
    </aside>
  );
}
