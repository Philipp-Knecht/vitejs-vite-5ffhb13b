import { useConfig, useMe } from '../api/queries';
import { track } from '../lib/analytics';

export type AffiliatePlacement = 'guide_buying' | 'guide_registration' | 'guide_costs';

/**
 * A partner link to a car insurance comparison (affiliate), for visitors
 * without Pro, configured on the server. A plain link: nothing is loaded from
 * the partner before the click. KaufCheck only points to the comparison – no
 * insurers, prices or advice and no data handed over (§ 34d GewO).
 */
export function InsuranceComparisonLink({ placement }: { placement: AffiliatePlacement }) {
  const me = useMe();
  const config = useConfig();
  const partner = config.data?.affiliates.carInsurance ?? null;
  if (!partner || me.data?.entitlements.showAds !== true) return null;
  return (
    <aside className="affiliate" aria-label="Anzeige" data-placement={placement}>
      <span className="ad-slot__label">Anzeige</span>
      <p className="affiliate__link">
        <a
          href={partner.url}
          target="_blank"
          rel="sponsored noopener"
          onClick={() => track('affiliate_clicked', { placement })}
        >
          Kfz-Versicherungen vergleichen bei {partner.name}*
          <span className="visually-hidden"> (öffnet in neuem Tab)</span>
        </a>
      </p>
      <p className="affiliate__note">
        *Affiliate-Link: Kommt über diesen Link ein Vertrag zustande, erhält KaufCheck eine
        Provision. Für dich entstehen keine Mehrkosten. Vergleichsportale zeigen nicht alle
        Versicherer; KaufCheck berät nicht zu Versicherungen.
      </p>
    </aside>
  );
}
