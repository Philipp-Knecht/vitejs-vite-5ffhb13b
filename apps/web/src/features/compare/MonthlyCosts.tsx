import {
  cheapestCar,
  COST_PART_LABELS,
  COST_PARTS,
  ENERGY_GROUP_LABELS,
  ENERGY_GROUPS,
  ENERGY_UNITS,
  energyGroup,
  monthlyCosts,
  type ComparisonDto,
  type EnergyGroup,
} from '@kaufcheck/shared';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useMe } from '../../api/queries';
import { SelectField, TextField } from '../../components/ui/Field';
import { track } from '../../lib/analytics';
import { cn } from '../../lib/format';
import { readJson, writeJson } from '../../lib/storage';
import { taxCalculatorLink } from '../tax/tax-link';
import { toDecimal, toNumber } from '../tax/numbers';
import { MONTHLY_COSTS_STORAGE_KEY } from './monthly-costs-storage';

const STORAGE_KEY = MONTHLY_COSTS_STORAGE_KEY;
const MAX_STORED_CARS = 50;

interface SharedInput {
  kmPerYear: string;
  years: string;
  prices: Partial<Record<EnergyGroup, string>>;
}

interface CarInput {
  energy: EnergyGroup | '';
  consumption: string;
  tax: string;
  insurance: string;
  workshop: string;
  other: string;
  purchasePrice: string;
  resaleValue: string;
}

interface Stored {
  shared: SharedInput;
  /** By saved listing id; the most recently used last. */
  cars: Record<string, CarInput>;
}

const EMPTY_SHARED: SharedInput = { kmPerYear: '', years: '', prices: {} };
const EMPTY: Stored = { shared: EMPTY_SHARED, cars: {} };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isStored = (value: unknown): value is Stored =>
  isRecord(value) &&
  isRecord(value.shared) &&
  typeof value.shared.kmPerYear === 'string' &&
  typeof value.shared.years === 'string' &&
  isRecord(value.shared.prices) &&
  isRecord(value.cars) &&
  Object.values(value.cars).every(
    (car) => isRecord(car) && Object.values(car).every((field) => typeof field === 'string'),
  );

const euros = (value: number) =>
  value.toLocaleString('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  });

/** A typed value checked against an upper limit; empty means „not given“. */
function parse(raw: string, read: (value: string) => number | null, max: number) {
  if (/^\s*[.,]?\s*$/.test(raw ?? '')) return { value: null, error: undefined };
  const value = read(raw);
  if (value === null) return { value: null, error: 'Bitte gib nur eine Zahl ein.' };
  if (value > max) return { value: null, error: 'Bitte prüf den Wert.' };
  return { value, error: undefined };
}

type Item = ComparisonDto['items'][number];

function initialCar(item: Item): CarInput {
  return {
    energy: energyGroup(item.vehicle?.fuel) ?? '',
    consumption: '',
    tax: '',
    insurance: '',
    workshop: '',
    other: '',
    purchasePrice: item.askingPriceEur ? String(item.askingPriceEur) : '',
    resaleValue: '',
  };
}

function Teaser() {
  return (
    <div className="monthly-costs__teaser">
      <p>
        Mit KaufCheck Pro rechnest du hier aus, was jedes Angebot dich im Monat kostet: Wertverlust,
        Kraftstoff oder Strom, Steuer, Versicherung und Werkstatt – nebeneinander, aus deinen
        eigenen Annahmen.
      </p>
      <p>
        <Link to="/pro" onClick={() => track('pro_clicked', { placement: 'monthly_costs' })}>
          KaufCheck Pro ansehen
        </Link>{' '}
        · Für ein einzelnes Auto rechnest du kostenlos mit dem{' '}
        <Link to="/kfz-steuer-rechner#unterhalt">Kostenrechner</Link>.
      </p>
    </div>
  );
}

/**
 * Monthly costs of the compared offers (Pro), in the blocks the ADAC uses:
 * depreciation, energy, tax, insurance and workshop. Only the buyer's own
 * figures – KaufCheck has no price data. What is typed stays in this browser.
 */
export function MonthlyCosts({ comparison }: { comparison: ComparisonDto }) {
  const me = useMe();
  const pro = me.data?.entitlements.monthlyCosts ?? false;
  const items = comparison.items;
  const [stored, setStored] = useState<Stored>(() => readJson(STORAGE_KEY, EMPTY, isStored));
  const shared = stored.shared;
  const cars = items.map((item) => stored.cars[item.savedListingId] ?? initialCar(item));

  useEffect(() => {
    writeJson(STORAGE_KEY, stored);
  }, [stored]);

  const setShared = (change: Partial<SharedInput>) =>
    setStored((current) => ({ ...current, shared: { ...current.shared, ...change } }));
  const setCar = (index: number, change: Partial<CarInput>) =>
    setStored((current) => {
      const id = items[index]!.savedListingId;
      const { [id]: previous, ...others } = current.cars;
      const entries = Object.entries({
        ...others,
        [id]: { ...(previous ?? initialCar(items[index]!)), ...change },
      });
      // Only the most recent cars are kept.
      return { ...current, cars: Object.fromEntries(entries.slice(-MAX_STORED_CARS)) };
    });

  const km = parse(shared.kmPerYear, toNumber, 300_000);
  const years = parse(shared.years, toDecimal, 30);
  const groups = ENERGY_GROUPS.filter((group) => cars.some((car) => car.energy === group));
  const prices = Object.fromEntries(
    groups.map((group) => [group, parse(shared.prices[group] ?? '', toDecimal, 20)]),
  ) as Record<EnergyGroup, ReturnType<typeof parse>>;

  const parsedCars = cars.map((car) => ({
    consumption: parse(car.consumption, toDecimal, car.energy === 'electric' ? 100 : 50),
    tax: parse(car.tax, toNumber, 100_000),
    insurance: parse(car.insurance, toNumber, 100_000),
    workshop: parse(car.workshop, toNumber, 100_000),
    other: parse(car.other, toNumber, 100_000),
    purchasePrice: parse(car.purchasePrice, toNumber, 10_000_000),
    resaleValue: parse(car.resaleValue, toNumber, 10_000_000),
  }));

  const costs = cars.map((car, index) => {
    const parsed = parsedCars[index]!;
    return monthlyCosts(
      {
        energy: car.energy || null,
        consumption: parsed.consumption.value,
        taxPerYear: parsed.tax.value,
        insurancePerYear: parsed.insurance.value,
        workshopPerYear: parsed.workshop.value,
        otherPerYear: parsed.other.value,
        purchasePrice: parsed.purchasePrice.value,
        resaleValue: parsed.resaleValue.value,
      },
      {
        kmPerYear: km.value,
        years: years.value,
        prices: Object.fromEntries(
          groups
            .map((group) => [group, prices[group].value] as const)
            .filter(([, value]) => value !== null),
        ),
      },
    );
  });
  const cheapest = cheapestCar(costs);
  const started = costs.some((cost) => cost.totalEur > 0);

  return (
    <section className="page__section monthly-costs" aria-labelledby="monthly-costs-title">
      <h2 id="monthly-costs-title">
        Kosten pro Monat {me.data && !pro && <span className="tag tag--pro">Pro</span>}
      </h2>
      {!me.data ? null : !pro ? (
        <Teaser />
      ) : (
        <>
          <p className="muted">
            KaufCheck hat keine Preis- oder Verbrauchsdaten: Trag deine eigenen Annahmen ein, etwa
            den Verbrauch aus dem Inserat oder einem Test, Angebote deiner Versicherung und die
            Steuer aus dem Rechner. Was du einträgst, bleibt in diesem Browser.
          </p>

          <fieldset className="sale-contract__group">
            <legend>Für alle Angebote</legend>
            <div className="sale-contract__grid">
              <TextField
                label="Fahrleistung in km pro Jahr"
                inputMode="numeric"
                value={shared.kmPerYear}
                onChange={(event) => setShared({ kmPerYear: event.target.value })}
                error={km.error}
              />
              <TextField
                label="Haltedauer in Jahren"
                hint="Für den Wertverlust"
                inputMode="decimal"
                value={shared.years}
                onChange={(event) => setShared({ years: event.target.value })}
                error={years.error}
              />
              {groups.map((group) => (
                <TextField
                  key={group}
                  label={`Preis ${ENERGY_GROUP_LABELS[group]} in Euro je ${ENERGY_UNITS[group]}`}
                  inputMode="decimal"
                  value={shared.prices[group] ?? ''}
                  onChange={(event) =>
                    setShared({ prices: { ...shared.prices, [group]: event.target.value } })
                  }
                  error={prices[group].error}
                />
              ))}
            </div>
          </fieldset>

          {items.map((item, index) => {
            const car = cars[index]!;
            const parsed = parsedCars[index]!;
            const unit = car.energy ? ENERGY_UNITS[car.energy] : null;
            const vehicle = item.vehicle;
            const taxLink = taxCalculatorLink({
              firstRegistration:
                vehicle?.firstRegistrationYear != null
                  ? {
                      year: vehicle.firstRegistrationYear,
                      month: vehicle.firstRegistrationMonth ?? null,
                    }
                  : null,
              fuel: vehicle?.fuel ?? null,
            });
            return (
              <fieldset key={item.savedListingId} className="sale-contract__group">
                <legend>{item.title}</legend>
                <div className="sale-contract__grid">
                  <SelectField
                    label="Antrieb"
                    value={car.energy}
                    onChange={(event) =>
                      setCar(index, {
                        energy: event.target.value as EnergyGroup | '',
                        consumption: '',
                      })
                    }
                  >
                    <option value="">Bitte wählen</option>
                    {ENERGY_GROUPS.map((group) => (
                      <option key={group} value={group}>
                        {ENERGY_GROUP_LABELS[group]}
                      </option>
                    ))}
                  </SelectField>
                  <TextField
                    label={unit ? `Verbrauch in ${unit} je 100 km` : 'Verbrauch je 100 km'}
                    inputMode="decimal"
                    disabled={!unit}
                    value={car.consumption}
                    onChange={(event) => setCar(index, { consumption: event.target.value })}
                    error={parsed.consumption.error}
                  />
                  <TextField
                    label="Kfz-Steuer in Euro pro Jahr"
                    hint={
                      <Link to={taxLink} target="_blank" rel="noopener">
                        Steuer berechnen
                        <span className="visually-hidden"> (öffnet in neuem Tab)</span>
                      </Link>
                    }
                    inputMode="numeric"
                    value={car.tax}
                    onChange={(event) => setCar(index, { tax: event.target.value })}
                    error={parsed.tax.error}
                  />
                  <TextField
                    label="Versicherung in Euro pro Jahr"
                    inputMode="numeric"
                    value={car.insurance}
                    onChange={(event) => setCar(index, { insurance: event.target.value })}
                    error={parsed.insurance.error}
                  />
                  <TextField
                    label="Werkstatt und Reifen in Euro pro Jahr"
                    hint="Inspektionen, Verschleißteile, Reparaturen"
                    inputMode="numeric"
                    value={car.workshop}
                    onChange={(event) => setCar(index, { workshop: event.target.value })}
                    error={parsed.workshop.error}
                  />
                  <TextField
                    label="Sonstiges in Euro pro Jahr"
                    hint="Zum Beispiel Pflege, Parken"
                    inputMode="numeric"
                    value={car.other}
                    onChange={(event) => setCar(index, { other: event.target.value })}
                    error={parsed.other.error}
                  />
                  <TextField
                    label="Kaufpreis in Euro"
                    hint="Aus dem Inserat übernommen, falls genannt"
                    inputMode="numeric"
                    value={car.purchasePrice}
                    onChange={(event) => setCar(index, { purchasePrice: event.target.value })}
                    error={parsed.purchasePrice.error}
                  />
                  <TextField
                    label="Erwarteter Wert beim Verkauf in Euro"
                    hint="Deine Schätzung für das Ende der Haltedauer"
                    inputMode="numeric"
                    value={car.resaleValue}
                    onChange={(event) => setCar(index, { resaleValue: event.target.value })}
                    error={
                      parsed.resaleValue.error ??
                      (parsed.resaleValue.value !== null &&
                      parsed.purchasePrice.value !== null &&
                      parsed.resaleValue.value > parsed.purchasePrice.value
                        ? 'Höher als der Kaufpreis – so gibt es keinen Wertverlust.'
                        : undefined)
                    }
                  />
                </div>
              </fieldset>
            );
          })}

          {started && (
            <div
              className="table-scroll"
              tabIndex={0}
              role="region"
              aria-label="Kosten pro Monat im Vergleich"
            >
              <table className="compare-table">
                <thead>
                  <tr>
                    <th scope="col" className="compare-table__corner">
                      <span className="visually-hidden">Kosten pro Monat</span>
                    </th>
                    {items.map((item) => (
                      <th key={item.savedListingId} scope="col">
                        {item.title}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COST_PARTS.map((part) => (
                    <tr key={part}>
                      <th scope="row">{COST_PART_LABELS[part]}</th>
                      {costs.map((cost, index) => (
                        <td key={index}>
                          {cost.parts[part] === null ? (
                            <span className="not-stated">Keine Angabe</span>
                          ) : (
                            euros(cost.parts[part])
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr className="monthly-costs__total">
                    <th scope="row">Im Monat, ohne fehlende Posten</th>
                    {costs.map((cost, index) => (
                      <td key={index} className={cn(index === cheapest && 'monthly-costs__best')}>
                        {euros(cost.totalEur)}
                        {index === cheapest && <span className="marker">günstigstes Angebot</span>}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          {started && cheapest === null && items.length > 1 && (
            <p className="muted">
              Die Summen sind erst vergleichbar, wenn für alle Angebote dieselben Posten ausgefüllt
              sind.
            </p>
          )}
        </>
      )}
    </section>
  );
}
