import {
  PRICE_VERDICT_LABELS,
  PRICE_VERDICTS,
  type PriceAdviceAction,
  type PriceContext,
  type Vehicle,
} from '@kaufcheck/shared';
import { BadgeEuro, Handshake, Search, ShieldAlert, ThumbsUp } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { formatEuro, formatNumber } from '../../lib/format';
import { similarOffersLink } from './similar-offers';

const ICONS: Record<PriceAdviceAction, ReactNode> = {
  inspect: <ThumbsUp aria-hidden size={22} />,
  negotiate: <Handshake aria-hidden size={22} />,
  search_on: <Search aria-hidden size={22} />,
  caution: <ShieldAlert aria-hidden size={22} />,
  compare: <BadgeEuro aria-hidden size={22} />,
};

/**
 * The answer to „Is the price worth it?“ at the top of the result: the price
 * level on a fixed scale and what to do. Rules only, the same for everyone.
 */
export function PriceVerdict({ price, vehicle }: { price: PriceContext; vehicle: Vehicle | null }) {
  const { advice, market } = price;
  if (!advice) return null;
  const verdict = market.status === 'available' ? market.verdict : undefined;
  return (
    <section
      className={`price-verdict price-verdict--${advice.action}`}
      aria-labelledby="price-verdict-title"
    >
      <p className="price-verdict__eyebrow">Preis-Check</p>
      <h2 id="price-verdict-title" className="price-verdict__title">
        {ICONS[advice.action]} {advice.title}
      </h2>
      {verdict && (
        <ol className="price-scale" aria-label="Preisstufe">
          {PRICE_VERDICTS.map((level) => (
            <li
              key={level}
              className={`price-scale__step price-scale__step--${level}`}
              aria-current={level === verdict ? 'true' : undefined}
            >
              {PRICE_VERDICT_LABELS[level]}
            </li>
          ))}
        </ol>
      )}
      <p className="price-verdict__text">{advice.text}</p>
      {advice.targetPriceEur !== null && (
        <p className="price-verdict__target">
          Zielpreis für die Verhandlung: <strong>etwa {formatEuro(advice.targetPriceEur)}</strong>
        </p>
      )}
      <p className="price-verdict__meta">
        {market.status === 'available' ? (
          <>
            {market.method === 'valuation'
              ? `Üblicher Preis laut ${market.source}.`
              : `Verglichen mit ${formatNumber(market.sampleSize)} ähnlichen Inseraten, die bei KaufCheck geprüft wurden.`}{' '}
            <a href="#preis">So ist das gerechnet</a>
          </>
        ) : (
          advice.action === 'compare' &&
          market.reason !== 'not_comparable' && (
            <Link to={similarOffersLink(vehicle)}>Ähnliche Angebote auf den Börsen ansehen</Link>
          )
        )}
      </p>
    </section>
  );
}
