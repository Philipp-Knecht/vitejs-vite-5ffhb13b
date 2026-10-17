import type { AdPlacement, SponsorAdDto, SponsorAdResponse } from '@kaufcheck/shared';
import { useEffect, useId, useRef, useState } from 'react';
import { api } from '../api/client';
import { useConfig, useMe } from '../api/queries';
import { loadAdSense, requestAd } from '../lib/adsense';
import { privacySignal } from '../lib/privacy-signals';
import { useHydrated } from '../lib/use-hydrated';

/**
 * Designated ad placements: below editorial or analysis content – never next
 * to warnings, input fields or action buttons, and not on pages without
 * content of our own (account, sign-in, saved listings, errors).
 */
export type { AdPlacement };

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
 * An ad sold directly. The server picks it (and counts the delivery); text
 * and image come from our own server, and the link goes through our own
 * redirect, which counts the click. Nothing is measured in the browser.
 */
function SponsorUnit({ placement }: { placement: AdPlacement }) {
  const [ad, setAd] = useState<SponsorAdDto | null>(null);
  const labelId = useId();
  const noteId = useId();
  useEffect(() => {
    const controller = new AbortController();
    api
      .get<SponsorAdResponse>(`/api/sponsor-ads/${placement}`, controller.signal)
      .then((response) => setAd(response.ad))
      .catch(() => setAd(null));
    return () => controller.abort();
  }, [placement]);
  if (!ad) return null;
  return (
    <aside className="ad-slot sponsor-ad" aria-labelledby={labelId} data-placement={placement}>
      <p className="sponsor-ad__label" id={labelId}>
        <span className="sponsor-ad__badge">Werbung</span> von {ad.advertiser}
      </p>
      <a
        className="sponsor-ad__link"
        href={ad.href}
        target="_blank"
        rel="sponsored noopener"
        aria-describedby={`${labelId} ${noteId}`}
      >
        {ad.image && <img className="sponsor-ad__image" src={ad.image.src} alt={ad.image.alt} />}
        <span className="sponsor-ad__title">{ad.title}</span>
        {ad.text && <span className="sponsor-ad__text">{ad.text}</span>}
        <span className="visually-hidden"> (öffnet in neuem Tab)</span>
      </a>
      <p className="sponsor-ad__note" id={noteId}>
        Die Anzeige ist keine Empfehlung von KaufCheck und hat keinen Einfluss auf Prüfungen und
        Ratgeber.
      </p>
    </aside>
  );
}

/**
 * Shows an ad sold directly when one runs for this placement, otherwise a
 * Google AdSense unit (configured on the server), to visitors without Pro.
 * Nothing is shown for Pro or while the plan is unknown. Google AdSense is not
 * loaded when the browser sends Do Not Track / Global Privacy Control; ads
 * sold directly load nothing from others and are then not counted. Unfilled
 * AdSense units – for example without consent – stay invisible.
 */
export function AdSlot({ placement }: { placement: AdPlacement }) {
  // Never part of a prerendered page: ads appear once the plan is known.
  const hydrated = useHydrated();
  const me = useMe();
  const config = useConfig();
  const ads = config.data?.ads ?? null;
  // A configuration cached before ads sold directly existed has no `sponsors`.
  const sponsored = config.data?.sponsors?.placements.includes(placement) ?? false;
  if (!hydrated || me.data?.entitlements.showAds !== true) return null;
  if (sponsored) return <SponsorUnit placement={placement} />;
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
