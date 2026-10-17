import { useId } from 'react';
import { useConfig, useMe } from '../api/queries';
import { track } from '../lib/analytics';
import { useHydrated } from '../lib/use-hydrated';

export type AffiliatePlacement = 'guide_buying' | 'guide_registration' | 'guide_costs';

/**
 * A partner link to a car insurance comparison (affiliate), for visitors
 * without Pro, configured on the server. A plain link: nothing is loaded from
 * the partner before the click. KaufCheck only points to the comparison – no
 * insurers, prices or advice and no data handed over (§ 34d GewO). Placed at
 * the end of a section that fits, never next to warnings, legal duties or
 * step-by-step instructions; one per page.
 */
export function InsuranceComparisonLink({ placement }: { placement: AffiliatePlacement }) {
  const id = useId();
  // Not part of the prerendered page: it appears only once the plan is known.
  const hydrated = useHydrated();
  const me = useMe();
  const config = useConfig();
  const partner = config.data?.affiliates.carInsurance ?? null;
  if (!hydrated || !partner || me.data?.entitlements.showAds !== true) return null;
  return (
    <aside className="affiliate" aria-labelledby={`${id}-label`} data-placement={placement}>
      <span className="ad-slot__label" id={`${id}-label`}>
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
          Kfz-Versicherungen bei {partner.name} vergleichen*
          <span className="visually-hidden"> (öffnet in neuem Tab)</span>
        </a>
      </p>
      <p className="affiliate__note" id={`${id}-note`}>
        *Affiliate-Link: Kommt über diesen Link ein Vertrag zustande, erhält KaufCheck eine
        Provision. Für dich entstehen keine Mehrkosten. Der Vergleich zeigt nicht alle Versicherer
        und Tarife; KaufCheck berät nicht zu Versicherungen und empfiehlt keinen Tarif.
      </p>
    </aside>
  );
}
