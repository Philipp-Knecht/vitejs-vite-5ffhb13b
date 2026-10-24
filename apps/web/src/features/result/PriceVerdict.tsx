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

const checkedOn = (iso: string) =>
  new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

/**
 * The answer to „Is the price worth it?“ at the top of the result: the price
 * level on a fixed scale and what to do, with the data it rests on. Rules
 * only, the same for everyone.
 */
export function PriceVerdict({
  price,
  vehicle,
  checkedAt,
}: {
  price: PriceContext;
  vehicle: Vehicle | null;
  /** When the check ran: the comparison is as of then. */
  checkedAt: string;
}) {
  const { advice, market } = price;
  if (!advice) return null;
  // With warning signs the level would read as praise; the title says what matters.
  const verdict =
    market.status === 'available' && advice.action !== 'caution' ? market.verdict : undefined;
  const similar =
    advice.action === 'compare' &&
    market.status === 'insufficient_data' &&
    market.reason !== 'not_comparable'
      ? similarOffersLink(vehicle)
      : null;
  return (
    <section
      className={`price-verdict price-verdict--${advice.action}`}
      aria-labelledby="price-verdict-eyebrow price-verdict-title"
    >
      <p id="price-verdict-eyebrow" className="price-verdict__eyebrow">
        Preis-Check
      </p>
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
              {level === verdict && <span className="visually-hidden"> – dieses Angebot</span>}
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
      {market.status === 'available' && (
        <p className="price-verdict__meta">
          {market.method === 'valuation'
            ? `Grundlage: übliche Preise laut ${market.source}. Ausstattung und Zustand zählen nicht.`
            : `Grundlage: ${formatNumber(market.sampleSize)} vergleichbare Inserate, die bei KaufCheck geprüft wurden – Angebotspreise, abgerufen oder eingefügt und nicht überprüft. Keine repräsentative Marktanalyse; Ausstattung und Zustand zählen nicht.`}{' '}
          Stand: {checkedOn(checkedAt)}. <a href="#preis">Details zur Rechnung</a>
        </p>
      )}
      {similar && (
        <p className="price-verdict__meta">
          <Link to={similar}>Vergleichbare Angebote auf den Börsen ansehen</Link>
        </p>
      )}
    </section>
  );
}
