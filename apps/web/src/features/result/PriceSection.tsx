import { findListingModel, findMake } from '@kaufcheck/catalog';
import {
  LOAN_LIMITS,
  MIN_COMPARABLE_VISITORS,
  MIN_COMPARABLES,
  PRICE_KIND_LABELS,
  PRICE_VERDICT_LABELS,
  PRICE_VERDICT_LIMITS,
  UNUSUALLY_LOW_PERCENT,
  type PriceContext,
  type Vehicle,
} from '@kaufcheck/shared';
import { Link } from 'react-router';
import { EvidenceBadge } from '../../components/EvidenceBadge';
import { formatEuro, formatNumber } from '../../lib/format';
import { taxCalculatorLink } from '../tax/tax-link';
import { FinancingProposal } from './FinancingProposal';
import { similarOffersLink } from './similar-offers';
import { ResultSection } from './Section';

function MarketRange({
  lower,
  upper,
  median,
  asking,
  bandLabel,
}: {
  lower: number;
  upper: number;
  median: number;
  asking: number;
  bandLabel: string;
}) {
  const min = Math.min(lower, asking) * 0.9;
  const max = Math.max(upper, asking) * 1.1;
  const position = (value: number) => `${(((value - min) / (max - min)) * 100).toFixed(1)}%`;
  return (
    <div className="market-range" aria-hidden>
      <div className="market-range__track">
        <div
          className="market-range__band"
          style={{ left: position(lower), right: `calc(100% - ${position(upper)})` }}
        />
        <div className="market-range__median" style={{ left: position(median) }} />
        <div className="market-range__asking" style={{ left: position(asking) }} />
      </div>
      <div className="market-range__legend">
        <span>
          <span className="market-range__swatch market-range__swatch--band" /> {bandLabel}
        </span>
        <span>
          <span className="market-range__swatch market-range__swatch--asking" /> dieses Angebot
        </span>
      </div>
    </div>
  );
}

/** "+5 %", "−15 %": signed, with a non-breaking space. */
const percent = (value: number) => `${value > 0 ? '+' : '−'}${Math.abs(value)}\u00A0%`;

/** Make and model of the listing for the engine picker: the catalog model, or the name as listed. */
function listingModel(vehicle: Vehicle | null) {
  const make = findMake(vehicle?.make);
  if (!make || !vehicle?.model) return null;
  return {
    makeId: make.id,
    model: findListingModel(make, vehicle.model)?.id ?? vehicle.model,
    kw: vehicle.powerKw,
  };
}

export function PriceSection({ price, vehicle }: { price: PriceContext; vehicle: Vehicle | null }) {
  const { askingPrice, metrics, market, notes } = price;
  const similar = similarOffersLink(vehicle);
  const usualLabel =
    market.status === 'available' && market.method === 'median' ? 'Median' : 'üblichen Preis';
  return (
    <ResultSection id="preis" title="Preis einordnen">
      <div className="price-summary">
        {askingPrice ? (
          <>
            <p className="price-summary__amount">{askingPrice.display}</p>
            <p className="price-summary__kind">
              {PRICE_KIND_LABELS[askingPrice.kind]} <EvidenceBadge evidence="listing_fact" />
            </p>
          </>
        ) : (
          <p className="price-summary__kind">
            Im Inserat ist kein Preis angegeben. <EvidenceBadge evidence="unknown" />
          </p>
        )}
      </div>

      {metrics.length > 0 && (
        <ul className="metric-list">
          {metrics.map((metric) => (
            <li key={metric.key} className="metric">
              <div className="metric__head">
                <span className="metric__label">{metric.label}</span>
                <span className="metric__value">{metric.value}</span>
              </div>
              <p className="metric__explanation">{metric.explanation}</p>
              <EvidenceBadge evidence="calculation" />
            </li>
          ))}
        </ul>
      )}

      <div className="market">
        <h3 className="market__title">Vergleich mit anderen Angeboten</h3>
        {market.status === 'available' ? (
          <>
            <p>{market.message}</p>
            {askingPrice && (
              <MarketRange
                lower={market.typicalLowEur ?? market.lowerQuartileEur}
                upper={market.typicalHighEur ?? market.upperQuartileEur}
                median={market.expectedEur ?? market.medianEur}
                asking={askingPrice.amountEur}
                bandLabel={
                  market.method === 'valuation'
                    ? `übliche Spanne laut ${market.source}`
                    : 'mittlere Hälfte der Vergleichsangebote'
                }
              />
            )}
            <dl className="market__facts">
              {market.verdict && (
                <div>
                  <dt>Preisstufe</dt>
                  <dd>{PRICE_VERDICT_LABELS[market.verdict]}</dd>
                </div>
              )}
              <div>
                <dt>{market.method && market.method !== 'median' ? 'Üblicher Preis' : 'Median'}</dt>
                <dd>{formatEuro(market.expectedEur ?? market.medianEur)}</dd>
              </div>
              <div>
                <dt>Mittlere Hälfte</dt>
                <dd>
                  {formatEuro(market.typicalLowEur ?? market.lowerQuartileEur)} bis{' '}
                  {formatEuro(market.typicalHighEur ?? market.upperQuartileEur)}
                </dd>
              </div>
              {market.method !== 'valuation' && (
                <div>
                  <dt>Vergleichsangebote</dt>
                  <dd>{formatNumber(market.sampleSize)}</dd>
                </div>
              )}
            </dl>
            <p className="market__source">
              Auswahl: {market.criteria}. {market.source}
            </p>
            {market.verdict && (
              <p className="market__source">
                Preisstufen nach der Abweichung vom {usualLabel}: bis{' '}
                {percent(PRICE_VERDICT_LIMITS.veryGood)} sehr gut, bis{' '}
                {percent(PRICE_VERDICT_LIMITS.good)} gut, unter {percent(PRICE_VERDICT_LIMITS.fair)}{' '}
                fair, unter {percent(PRICE_VERDICT_LIMITS.increased)} erhöht, ab{' '}
                {percent(PRICE_VERDICT_LIMITS.increased)} hoch. Liegt der Preis in der mittleren
                Hälfte, gilt er immer als fair; ab {percent(UNUSUALLY_LOW_PERCENT)} heißt es
                „auffällig günstig“.
                {market.method === 'age_mileage' &&
                  ' Der übliche Preis ist auf Alter und Kilometerstand dieses Autos umgerechnet.'}
              </p>
            )}
            <EvidenceBadge evidence="calculation" />
          </>
        ) : (
          <>
            <p className="market__insufficient">{market.message}</p>
            {(market.reason === undefined || market.reason === 'few_comparables') && (
              <p className="market__hint">
                KaufCheck bewertet den Preis, sobald mindestens {MIN_COMPARABLES} vergleichbare
                Inserate von mindestens {MIN_COMPARABLE_VISITORS} Besuchern bei KaufCheck geprüft
                wurden.
                {similar && (
                  <>
                    {' '}
                    Bis dahin:{' '}
                    <Link to={similar}>vergleichbare Angebote auf den Börsen ansehen</Link>.
                  </>
                )}
              </p>
            )}
          </>
        )}
      </div>

      {notes.length > 0 && (
        <ul className="bullet-list">
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
      {askingPrice &&
        askingPrice.kind !== 'give_away' &&
        askingPrice.amountEur >= LOAN_LIMITS.amount.min &&
        askingPrice.amountEur <= LOAN_LIMITS.amount.max && (
          <FinancingProposal
            priceEur={askingPrice.amountEur}
            negotiable={askingPrice.kind === 'negotiable'}
          />
        )}
      <p className="price-costs">
        Zum Kaufpreis kommen laufende Kosten:{' '}
        <Link to={taxCalculatorLink(vehicle, listingModel(vehicle))}>
          Kfz-Steuer und laufende Kosten für dieses Auto berechnen
        </Link>
      </p>
    </ResultSection>
  );
}
