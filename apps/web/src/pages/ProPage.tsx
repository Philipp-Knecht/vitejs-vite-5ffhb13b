import {
  CANCEL_BUTTON_LABEL,
  CANCEL_PATH,
  DEFAULT_ENTITLEMENTS,
  formatCents,
  paymentMethodsText,
  vatNote,
  WITHDRAW_BUTTON_LABEL,
  WITHDRAW_PATH,
  type Entitlements,
} from '@kaufcheck/shared';
import { Check, Minus } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useConfig, useMe } from '../api/queries';
import { CONTRACT_DETAILS_COMPLETE } from './legal/site-info';
import { Button, ButtonLink } from '../components/ui/Button';
import { track } from '../lib/analytics';
import { STATIC_PAGE_META } from '../seo/pages';
import { usePageMeta } from '../seo/use-page-meta';

function Yes({ children }: { children?: ReactNode }) {
  return (
    <span className="plan-cell plan-cell--yes">
      <Check aria-hidden size={18} />
      {children ?? <span className="visually-hidden">enthalten</span>}
    </span>
  );
}

function No() {
  return (
    <span className="plan-cell plan-cell--no">
      <Minus aria-hidden size={18} />
      <span className="visually-hidden">nicht enthalten</span>
    </span>
  );
}

function rows(
  plans: Record<'anonymous' | 'free' | 'pro', Entitlements>,
  photoAnalysisAvailable: boolean,
) {
  const per = (entitlements: Entitlements) => `${entitlements.monthlyAnalyses} pro Monat`;
  const saved = (entitlements: Entitlements) =>
    entitlements.savedListingsMax > 0 ? <Yes>bis zu {entitlements.savedListingsMax}</Yes> : <No />;
  const compare = (entitlements: Entitlements) =>
    entitlements.compareMax > 0 ? <Yes>bis zu {entitlements.compareMax} Angebote</Yes> : <No />;
  const searches = (entitlements: Entitlements) =>
    entitlements.savedSearchesMax > 0 ? <Yes>bis zu {entitlements.savedSearchesMax}</Yes> : <No />;
  const flag = (value: boolean) => (value ? <Yes /> : <No />);
  return [
    { label: 'Inserate prüfen', cells: [per(plans.anonymous), per(plans.free), per(plans.pro)] },
    {
      label: 'Fragen, Checkliste, Preisrechnung',
      cells: [<Yes key="a" />, <Yes key="f" />, <Yes key="p" />],
    },
    {
      label: 'Angebote speichern',
      cells: [saved(plans.anonymous), saved(plans.free), saved(plans.pro)],
    },
    {
      label: 'Angebote vergleichen',
      cells: [compare(plans.anonymous), compare(plans.free), compare(plans.pro)],
    },
    {
      label: 'Suchen speichern',
      cells: [searches(plans.anonymous), searches(plans.free), searches(plans.pro)],
    },
    {
      label: 'Verlauf aller Prüfungen',
      cells: [flag(plans.anonymous.history), flag(plans.free.history), flag(plans.pro.history)],
    },
    {
      label: photoAnalysisAvailable ? 'Fotoanalyse' : 'Fotoanalyse (derzeit nicht verfügbar)',
      cells: [
        flag(plans.anonymous.photoAnalysis),
        flag(plans.free.photoAnalysis),
        flag(plans.pro.photoAnalysis && photoAnalysisAvailable),
      ],
    },
    {
      label: 'Ohne Werbung',
      cells: [flag(!plans.anonymous.showAds), flag(!plans.free.showAds), flag(!plans.pro.showAds)],
    },
  ];
}

export function ProPage() {
  const meta = STATIC_PAGE_META['/pro'];
  usePageMeta(meta ?? { title: 'KaufCheck Pro', description: '' });
  const config = useConfig();
  const me = useMe();
  const plans = config.data?.plans ?? DEFAULT_ENTITLEMENTS;
  // Orders also need the operator's full details in the order page and the terms.
  const offer = CONTRACT_DETAILS_COMPLETE ? (config.data?.pro.offer ?? null) : null;
  const photoAnalysis = config.data?.features.photoAnalysis ?? false;

  const cta = () => {
    if (!config.data || !me.data) return null;
    if (me.data.plan === 'pro') return <p className="plan-note">Du nutzt bereits KaufCheck Pro.</p>;
    if (!offer) {
      return (
        <>
          <Button disabled>Bald verfügbar</Button>
          <p className="plan-note">
            Die Bezahlung ist noch nicht freigeschaltet. Bis dahin kannst du KaufCheck kostenlos
            nutzen.
          </p>
        </>
      );
    }
    return (
      <>
        {me.data.user ? (
          <ButtonLink
            to="/pro/bestellen"
            onClick={() => track('pro_clicked', { placement: 'pro_page' })}
          >
            Weiter zur Bestellung
          </ButtonLink>
        ) : (
          <ButtonLink
            to="/registrieren"
            state={{ returnTo: '/pro/bestellen' }}
            onClick={() => track('pro_clicked', { placement: 'pro_page' })}
          >
            Konto erstellen und Pro bestellen
          </ButtonLink>
        )}
        {/* § 312j Abs. 1 BGB: payment methods and delivery restrictions before ordering. */}
        <p className="plan-note">
          Zahlungsarten: {paymentMethodsText(offer.paymentMethods)}. Bestellen kannst du, wenn du
          volljährig bist und in der EU wohnst.
          {!me.data.user && (
            <>
              {' '}
              Schon ein Konto?{' '}
              <Link to="/anmelden" state={{ returnTo: '/pro/bestellen' }}>
                Anmelden
              </Link>
            </>
          )}
        </p>
      </>
    );
  };

  return (
    <div className="container page">
      <div className="page__intro">
        <p className="eyebrow">KaufCheck Pro</p>
        <h1>Mehr Prüfungen für die heiße Phase der Autosuche</h1>
        <p className="page__lead">
          Wenn du viele Inserate vergleichst: mehr Prüfungen pro Monat, ein Verlauf aller Prüfungen,
          größere Vergleiche und keine Werbung. Monatlich kündbar.
        </p>
      </div>

      <div className="plan-cards">
        <article className="plan-card">
          <h2>Ohne Konto</h2>
          <p className="plan-card__price">0 €</p>
          <p>{plans.anonymous.monthlyAnalyses} Prüfungen im Monat, sofort und ohne Anmeldung.</p>
        </article>
        <article className="plan-card">
          <h2>Kostenlos</h2>
          <p className="plan-card__price">0 €</p>
          <p>
            {plans.free.monthlyAnalyses} Prüfungen im Monat, {plans.free.savedListingsMax}{' '}
            gespeicherte Angebote, Vergleiche mit bis zu {plans.free.compareMax} Angeboten.
          </p>
        </article>
        <article className="plan-card plan-card--highlight">
          <h2>Pro</h2>
          <p className="plan-card__price">
            {offer ? `${formatCents(offer.priceCents)} / Monat` : 'Preis folgt'}
          </p>
          {offer && <p className="plan-card__tax">{vatNote(offer.vatMode)}</p>}
          <p>
            {plans.pro.monthlyAnalyses} Prüfungen im Monat, Verlauf, Vergleiche mit bis zu{' '}
            {plans.pro.compareMax} Angeboten
            {photoAnalysis ? ', Fotoanalyse' : ''} und keine Werbung.
          </p>
          <div className="plan-card__cta">{cta()}</div>
        </article>
      </div>

      <div className="table-scroll" tabIndex={0} role="region" aria-label="Tarife im Vergleich">
        <table className="plan-table">
          <thead>
            <tr>
              <th scope="col">
                <span className="visually-hidden">Leistung</span>
              </th>
              <th scope="col">Ohne Konto</th>
              <th scope="col">Kostenlos</th>
              <th scope="col">Pro</th>
            </tr>
          </thead>
          <tbody>
            {rows(plans, photoAnalysis).map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                {row.cells.map((cell, index) => (
                  <td key={index}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="page__section faq" aria-labelledby="pro-faq">
        <h2 id="pro-faq">Fragen zu Pro</h2>
        <details className="faq__item">
          <summary>Wie kündige ich?</summary>
          <p>
            Jederzeit zum Ende des Abrechnungsmonats, ohne Frist: über „
            <Link to={CANCEL_PATH}>{CANCEL_BUTTON_LABEL}</Link>“ am Ende jeder Seite oder über „Abo
            verwalten“ in deinem Konto. Pro läuft bis zum Ende des bezahlten Monats weiter.
          </p>
        </details>
        <details className="faq__item">
          <summary>Kann ich den Vertrag widerrufen?</summary>
          <p>
            Ja, binnen 14 Tagen ab Vertragsschluss und ohne Angabe von Gründen – online über „
            <Link to={WITHDRAW_PATH}>{WITHDRAW_BUTTON_LABEL}</Link>“. Weil Pro sofort beginnt,
            zahlst du für die Tage bis zum Widerruf einen anteiligen Betrag; den Rest erstatten wir.
          </p>
        </details>
        <details className="faq__item">
          <summary>Wird Pro das Auto für mich bewerten?</summary>
          <p>
            Nein. Auch mit Pro ordnet KaufCheck nur die Angaben aus dem Inserat. Pro bedeutet mehr
            Umfang, keine andere Art von Aussage.
          </p>
        </details>
        <details className="faq__item">
          <summary>Wie funktioniert die Fotoanalyse?</summary>
          <p>
            Ein KI-Modell sieht sich einige Fotos des Inserats an und nennt, was darauf
            möglicherweise zu erkennen ist – etwa Kratzer oder eine Warnleuchte. Das sind Hinweise
            zum Nachsehen, keine Befunde.
          </p>
        </details>
      </section>
    </div>
  );
}
