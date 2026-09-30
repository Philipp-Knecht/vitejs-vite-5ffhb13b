import { PRICE_KIND_LABELS, type PriceContext } from '@kaufcheck/shared';
import { EvidenceBadge } from '../../components/EvidenceBadge';
import { formatEuro, formatNumber } from '../../lib/format';
import { ResultSection } from './Section';

function MarketRange({
  lower,
  upper,
  median,
  asking,
}: {
  lower: number;
  upper: number;
  median: number;
  asking: number;
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
          <span className="market-range__swatch market-range__swatch--band" /> mittlere Hälfte der
          Vergleichsangebote
        </span>
        <span>
          <span className="market-range__swatch market-range__swatch--asking" /> dieses Angebot
        </span>
      </div>
    </div>
  );
}

export function PriceSection({ price }: { price: PriceContext }) {
  const { askingPrice, metrics, market, notes } = price;
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
                lower={market.lowerQuartileEur}
                upper={market.upperQuartileEur}
                median={market.medianEur}
                asking={askingPrice.amountEur}
              />
            )}
            <dl className="market__facts">
              <div>
                <dt>Median</dt>
                <dd>{formatEuro(market.medianEur)}</dd>
              </div>
              <div>
                <dt>Mittlere Hälfte</dt>
                <dd>
                  {formatEuro(market.lowerQuartileEur)} bis {formatEuro(market.upperQuartileEur)}
                </dd>
              </div>
              <div>
                <dt>Vergleichsangebote</dt>
                <dd>{formatNumber(market.sampleSize)}</dd>
              </div>
            </dl>
            <p className="market__source">
              Auswahl: {market.criteria}. {market.source}
            </p>
            <EvidenceBadge evidence="calculation" />
          </>
        ) : (
          <>
            <p className="market__insufficient">{market.message}</p>
            <p className="market__hint">
              KaufCheck nennt einen Vergleich erst, wenn genügend ähnliche Inserate vorliegen, die
              tatsächlich abgerufen wurden.
            </p>
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
    </ResultSection>
  );
}
