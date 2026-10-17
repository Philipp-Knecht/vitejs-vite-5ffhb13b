import type { AdPlacement, SponsorAd } from '@kaufcheck/shared';
import { useEffect, useId, useRef, useState } from 'react';
import { useConfig, useMe } from '../api/queries';
import { track } from '../lib/analytics';
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
 * An ad sold directly: text and image come from our own server, the link
 * goes to the advertiser. Views (half of the ad on screen) and clicks are
 * counted without personal data, like any other event.
 */
function SponsorUnit({ ads, placement }: { ads: SponsorAd[]; placement: AdPlacement }) {
  // One of the running ads per page view; ads are never prerendered, so no hydration mismatch.
  const [index] = useState(() => Math.floor(Math.random() * ads.length));
  const ad = ads[index % ads.length]!;
  const ref = useRef<HTMLElement>(null);
  const labelId = useId();
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        track('sponsor_ad_viewed', { placement, campaign: ad.id });
        observer.disconnect();
      },
      { threshold: 0.5 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ad.id, placement]);
  return (
    <aside
      ref={ref}
      className="ad-slot ad-slot--sponsor"
      aria-labelledby={labelId}
      data-placement={placement}
    >
      <span className="ad-slot__label" id={labelId}>
        Werbung von {ad.advertiser}
      </span>
      <a
        className="sponsor-ad"
        href={ad.url}
        target="_blank"
        rel="sponsored noopener"
        onClick={() => track('sponsor_ad_clicked', { placement, campaign: ad.id })}
      >
        {ad.image && (
          <img className="sponsor-ad__image" src={ad.image.src} alt={ad.image.alt} loading="lazy" />
        )}
        <span className="sponsor-ad__title">{ad.title}</span>
        {ad.text && <span className="sponsor-ad__text">{ad.text}</span>}
        <span className="visually-hidden"> (öffnet in neuem Tab)</span>
      </a>
    </aside>
  );
}

/**
 * Shows an ad sold directly when one runs for this placement, otherwise a
 * Google AdSense unit (configured on the server) to visitors
 * without Pro. Nothing is loaded for Pro, while the plan is unknown, or when
 * the browser sends Do Not Track / Global Privacy Control. Unfilled units –
 * for example without consent – stay invisible.
 */
export function AdSlot({ placement }: { placement: AdPlacement }) {
  // Never part of a prerendered page: ads appear once the plan is known.
  const hydrated = useHydrated();
  const me = useMe();
  const config = useConfig();
  const ads = config.data?.ads ?? null;
  const sponsors = (config.data?.sponsors ?? []).filter((ad) => ad.placements.includes(placement));
  if (!hydrated || me.data?.entitlements.showAds !== true) return null;
  if (sponsors.length > 0) return <SponsorUnit ads={sponsors} placement={placement} />;
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
