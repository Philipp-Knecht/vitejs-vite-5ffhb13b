import {
  cheapestCar,
  COST_PART_LABELS,
  COST_PARTS,
  ENERGY_GROUP_LABELS,
  ENERGY_GROUPS,
  ENERGY_UNITS,
  energyGroup,
  isPluginHybrid,
  monthlyCosts,
  PRICES_NEEDED,
  type ComparisonDto,
  type EnergyGroup,
  type PriceGroup,
} from '@kaufcheck/shared';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys, useMe } from '../../api/queries';
import { SelectField, TextField } from '../../components/ui/Field';
import { track } from '../../lib/analytics';
import { taxCalculatorLink } from '../tax/tax-link';
import { toDecimal, toNumber } from '../tax/numbers';
import { monthlyCostsStorageKey } from './monthly-costs-storage';

const MAX_STORED_CARS = 50;

interface SharedInput {
  kmPerYear: string;
  years: string;
  prices: Partial<Record<PriceGroup, string>>;
}

interface CarInput {
  energy: EnergyGroup | '';
  consumption: string;
  electricConsumption: string;
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
const CAR_FIELDS = [
  'consumption',
  'electricConsumption',
  'tax',
  'insurance',
  'workshop',
  'other',
  'purchasePrice',
  'resaleValue',
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** What the browser holds; `ok` is false when storage is blocked. */
function readRaw(key: string): { ok: boolean; value: unknown } {
  try {
    const raw = window.localStorage.getItem(key);
    return { ok: true, value: raw === null ? null : (JSON.parse(raw) as unknown) };
  } catch (error) {
    // Unreadable JSON is a value to drop, blocked storage is not.
    return { ok: error instanceof SyntaxError, value: null };
  }
}

/** Checked field by field; anything else is dropped. */
function parseStored(raw: unknown): Stored {
  if (!isRecord(raw) || !isRecord(raw.shared) || !isRecord(raw.cars)) return EMPTY;
  const text = (value: unknown) => (typeof value === 'string' ? value.slice(0, 20) : '');
  const prices = isRecord(raw.shared.prices) ? raw.shared.prices : {};
  const cars: Record<string, CarInput> = {};
  for (const [id, car] of Object.entries(raw.cars).slice(-MAX_STORED_CARS)) {
    if (!isRecord(car)) continue;
    const energy = ENERGY_GROUPS.find((group) => group === car.energy) ?? '';
    cars[id] = {
      energy,
      ...(Object.fromEntries(CAR_FIELDS.map((field) => [field, text(car[field])])) as Omit<
        CarInput,
        'energy'
      >),
    };
  }
  return {
    shared: {
      kmPerYear: text(raw.shared.kmPerYear),
      years: text(raw.shared.years),
      prices: Object.fromEntries(
        PRICE_GROUPS.filter((group) => typeof prices[group] === 'string').map((group) => [
          group,
          text(prices[group]),
        ]),
      ),
    },
    cars,
  };
}

const readStored = (key: string): Stored => parseStored(readRaw(key).value);

/** The unit of the consumption field; for a plug-in hybrid the litres of fuel. */
function unitOf(energy: EnergyGroup | ''): 'l' | 'kWh' | 'kg' | null {
  if (energy === '') return null;
  if (isPluginHybrid(energy)) return 'l';
  return ENERGY_UNITS[energy];
}

const UNIT_WORDS: Record<'l' | 'kWh' | 'kg', string> = { l: 'Liter', kWh: 'kWh', kg: 'kg' };

const euros = (value: number) =>
  value.toLocaleString('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  });

/** A typed value checked against an upper limit; empty means „not given“. */
function parse(
  raw: string,
  read: (value: string) => number | null,
  max: number,
  tooHigh: string,
  min = 0,
) {
  if (/^\s*[.,]?\s*$/.test(raw ?? '')) return { value: null, error: undefined };
  const value = read(raw);
  if (value === null) return { value: null, error: 'Bitte gib nur eine Zahl ein.' };
  if (value > max || value < min) return { value: null, error: tooHigh };
  return { value, error: undefined };
}

/** Plausible upper limits per unit: hydrogen costs well over 10 € per kg. */
const PRICE_GROUPS = ENERGY_GROUPS.filter((group): group is PriceGroup => !isPluginHybrid(group));

const PRICE_LIMITS: Record<PriceGroup, number> = {
  petrol: 5,
  diesel: 5,
  electric: 2,
  lpg: 5,
  cng: 5,
  hydrogen: 30,
  ethanol: 5,
};

const PRICE_EXAMPLES: Record<'l' | 'kWh' | 'kg', string> = {
  l: 'zum Beispiel 1,79 je Liter',
  kWh: 'zum Beispiel 0,35 je kWh',
  kg: 'zum Beispiel 1,50 je kg',
};

type Item = ComparisonDto['items'][number];

function initialCar(item: Item): CarInput {
  return {
    energy: energyGroup(item.vehicle?.fuel) ?? '',
    consumption: '',
    electricConsumption: '',
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
        Mit KaufCheck Pro überschlägst du hier, was jedes Angebot dich im Monat kosten würde:
        Wertverlust, Kraftstoff oder Strom, Steuer, Versicherung und Werkstatt – nebeneinander, nach
        deinen eigenen Annahmen.
      </p>
      <p>
        <Link to="/pro" onClick={() => track('pro_clicked', { placement: 'monthly_costs' })}>
          KaufCheck Pro ansehen
        </Link>{' '}
        · Die laufenden Kosten eines einzelnen Autos (ohne Wertverlust) rechnest du kostenlos mit
        dem <Link to="/kfz-steuer-rechner#unterhalt">Kostenrechner</Link>.
      </p>
    </div>
  );
}

/**
 * Estimated monthly costs of the compared offers (Pro), in blocks modelled on
 * the ADAC's cost comparisons: depreciation, energy, tax, insurance and
 * workshop. Only the buyer's own figures – KaufCheck has no price data.
 * What is typed stays in this browser.
 */
export function MonthlyCosts({ comparison }: { comparison: ComparisonDto }) {
  const me = useMe();
  const pro = me.data?.entitlements.monthlyCosts ?? false;
  const items = comparison.items;
  // Per account: another person on this browser does not see the figures.
  const queryClient = useQueryClient();
  const key = monthlyCostsStorageKey(me.data?.user?.id ?? '');
  const [stored, setStored] = useState<Stored>(() => readStored(key));
  // Another account signed in while the page is open: read its figures.
  const [storedKey, setStoredKey] = useState(key);
  if (storedKey !== key) {
    setStoredKey(key);
    setStored(readStored(key));
  }
  // Logged out in another tab: no writes until the session is checked again.
  const [clearedAt, setClearedAt] = useState<number | null>(null);
  const writable =
    clearedAt === null || me.dataUpdatedAt > clearedAt || me.errorUpdatedAt > clearedAt;
  // Storage refused a write: from then on the screen is the only copy.
  const writeFailed = useRef(false);
  const shared = stored.shared;
  const cars = items.map((item) => stored.cars[item.savedListingId] ?? initialCar(item));

  // Another tab changed or deleted the figures (e.g. on logout): take that over.
  useEffect(() => {
    const listen = (event: StorageEvent) => {
      if (event.key !== key && event.key !== null) return;
      setStored(readStored(key));
      if (event.key === null || event.newValue === null) {
        setClearedAt(Date.now());
        void queryClient.invalidateQueries({ queryKey: queryKeys.me });
      }
    };
    window.addEventListener('storage', listen);
    return () => window.removeEventListener('storage', listen);
  }, [key, queryClient]);

  /** Changes what this browser holds now, so that another tab's changes are kept. */
  const change = (apply: (current: Stored) => Stored) => {
    if (!me.data?.user || !writable) return;
    const read = readRaw(key);
    // Storage blocked: build on what is on screen.
    const next = apply(read.ok && !writeFailed.current ? parseStored(read.value) : stored);
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      writeFailed.current = true;
    }
    setStored(next);
  };
  const setShared = (update: Partial<SharedInput>) =>
    change((current) => ({ ...current, shared: { ...current.shared, ...update } }));
  const setCar = (index: number, update: Partial<CarInput>) =>
    change((current) => {
      const id = items[index]!.savedListingId;
      const { [id]: previous, ...others } = current.cars;
      const entries = Object.entries({
        ...others,
        [id]: { ...(previous ?? initialCar(items[index]!)), ...update },
      });
      // Only the most recent cars are kept.
      return { ...current, cars: Object.fromEntries(entries.slice(-MAX_STORED_CARS)) };
    });

  const km = parse(shared.kmPerYear, toNumber, 300_000, 'Bitte prüfe die Fahrleistung.', 100);
  const years = parse(
    shared.years,
    toDecimal,
    30,
    'Bitte gib die Haltedauer in Jahren an, zum Beispiel 4.',
    0.5,
  );
  const groups = PRICE_GROUPS.filter((group) =>
    cars.some((car) => car.energy && PRICES_NEEDED[car.energy].includes(group)),
  );
  const prices = Object.fromEntries(
    groups.map((group) => [
      group,
      parse(
        shared.prices[group] ?? '',
        toDecimal,
        PRICE_LIMITS[group],
        `Bitte prüfe den Preis, ${PRICE_EXAMPLES[ENERGY_UNITS[group]]}.`,
      ),
    ]),
  ) as Record<PriceGroup, ReturnType<typeof parse>>;

  const yearly = 'Bitte prüfe den Betrag pro Jahr.';
  const parsedCars = cars.map((car) => ({
    consumption: parse(
      car.consumption,
      toDecimal,
      car.energy === 'electric' ? 100 : 50,
      'Bitte prüfe den Verbrauch je 100 km.',
    ),
    electricConsumption: parse(
      car.electricConsumption,
      toDecimal,
      100,
      'Bitte prüfe den Verbrauch je 100 km.',
    ),
    tax: parse(car.tax, toNumber, 100_000, yearly),
    insurance: parse(car.insurance, toNumber, 100_000, yearly),
    workshop: parse(car.workshop, toNumber, 100_000, yearly),
    other: parse(car.other, toNumber, 100_000, yearly),
    purchasePrice: parse(car.purchasePrice, toNumber, 10_000_000, 'Bitte prüfe den Kaufpreis.'),
    resaleValue: parse(car.resaleValue, toNumber, 10_000_000, 'Bitte prüfe den Betrag.'),
  }));

  const costs = cars.map((car, index) => {
    const parsed = parsedCars[index]!;
    return monthlyCosts(
      {
        energy: car.energy || null,
        consumption: parsed.consumption.value,
        electricConsumption: parsed.electricConsumption.value,
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
  const lowest = cheapestCar(costs);
  // Column and group names that tell offers with the same title apart.
  const titles = items.map((item, index) => {
    const same = items.filter((other) => other.title === item.title).length > 1;
    return `${item.title}${item.isExample ? ' (Beispiel)' : ''}${same ? ` (${index + 1})` : ''}`;
  });
  const started = costs.some((cost) => cost.missing.length < COST_PARTS.length);
  const sameParts = costs.every((cost) => cost.missing.join() === costs[0]!.missing.join());

  return (
    <section className="page__section monthly-costs" aria-labelledby="monthly-costs-title">
      <h2 id="monthly-costs-title">Kosten pro Monat</h2>
      {me.data && !pro && <p className="tag tag--pro monthly-costs__tag">Pro</p>}
      {!me.data ? null : !pro ? (
        <Teaser />
      ) : (
        <>
          <p className="muted">
            Eine Schätzung nach deinen Annahmen: KaufCheck hat keine Preis- oder Verbrauchsdaten.
            Trag zum Beispiel den Verbrauch aus dem Inserat, Angebote deiner Versicherung und die
            Steuer aus dem Rechner ein. Was du einträgst, bleibt nur in diesem Browser – auf anderen
            Geräten siehst du es nicht. Meldest du dich in diesem Browser ab, löschen wir es.
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
                hint="Wie lange du das Auto fahren willst – für den Wertverlust"
                inputMode="decimal"
                value={shared.years}
                onChange={(event) => setShared({ years: event.target.value })}
                error={years.error}
              />
              {groups.map((group) => (
                <TextField
                  key={group}
                  label={`Preis ${ENERGY_GROUP_LABELS[group]} in Euro je ${UNIT_WORDS[ENERGY_UNITS[group]]}`}
                  inputMode="decimal"
                  value={shared.prices[group] ?? ''}
                  onChange={(event) => {
                    const value = event.target.value;
                    change((current) => ({
                      ...current,
                      shared: {
                        ...current.shared,
                        prices: { ...current.shared.prices, [group]: value },
                      },
                    }));
                  }}
                  error={prices[group].error}
                />
              ))}
            </div>
            {groups.length === 0 && (
              <p className="field__hint">
                Sobald du bei einem Angebot Kraftstoff oder Strom wählst, trägst du hier den Preis
                ein.
              </p>
            )}
          </fieldset>

          {items.map((item, index) => {
            const car = cars[index]!;
            const parsed = parsedCars[index]!;
            const phev = isPluginHybrid(car.energy);
            const unit = unitOf(car.energy);
            const vehicle = item.vehicle;
            const hybrid = vehicle?.fuel === 'hybrid' && !car.energy;
            const pluginHybrid = vehicle?.fuel === 'plugin_hybrid' && !car.energy;
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
            const cost = costs[index]!;
            return (
              <fieldset key={item.savedListingId} className="sale-contract__group">
                <legend>{titles[index]}</legend>
                <div className="sale-contract__grid">
                  <TextField
                    label="Kaufpreis in Euro"
                    hint="Aus dem Inserat übernommen, falls genannt – trag den Preis ein, den du nach der Verhandlung erwartest; Zulassung und Überführung kannst du dazurechnen"
                    inputMode="numeric"
                    value={car.purchasePrice}
                    onChange={(event) => setCar(index, { purchasePrice: event.target.value })}
                    error={parsed.purchasePrice.error}
                  />
                  <TextField
                    label="Erwarteter Wert beim Verkauf in Euro"
                    hint="Deine Schätzung am Ende der Haltedauer. Wertverlust: Kaufpreis minus dieser Wert, verteilt auf die Haltedauer, ohne Zinsen"
                    inputMode="numeric"
                    value={car.resaleValue}
                    onChange={(event) => setCar(index, { resaleValue: event.target.value })}
                    error={
                      parsed.resaleValue.error ??
                      (parsed.resaleValue.value !== null &&
                      parsed.purchasePrice.value !== null &&
                      parsed.resaleValue.value > parsed.purchasePrice.value
                        ? 'Höher als der Kaufpreis – einen Wertzuwachs rechnen wir nicht ein. Trag höchstens den Kaufpreis ein.'
                        : undefined)
                    }
                  />
                  <SelectField
                    label="Kraftstoff oder Strom"
                    hint={
                      hybrid
                        ? 'Hybrid: Wähl den Kraftstoff des Verbrennungsmotors.'
                        : pluginHybrid
                          ? 'Plug-in-Hybrid: Wähl, ob er Benzin oder Diesel tankt.'
                          : undefined
                    }
                    value={car.energy}
                    onChange={(event) =>
                      setCar(index, {
                        energy: event.target.value as EnergyGroup | '',
                        consumption: '',
                        electricConsumption: '',
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
                    label={
                      phev
                        ? `${car.energy === 'pluginHybridDiesel' ? 'Diesel' : 'Benzin'} in Litern je 100 km`
                        : unit
                          ? `Verbrauch in ${unit === 'l' ? 'Litern' : unit} je 100 km`
                          : 'Verbrauch je 100 km'
                    }
                    hint={
                      phev
                        ? 'Was du im Schnitt über alle Fahrten erwartest, nicht der WLTP-Wert aus dem Inserat – der ist bei Plug-in-Hybriden meist viel zu niedrig. Lädst du selten, brauchst du fast so viel Kraftstoff wie ein Auto ohne Elektromotor'
                        : unit
                          ? 'Laut Inserat oder Hersteller (WLTP); im Alltag meist etwas mehr'
                          : 'Erst Kraftstoff oder Strom wählen'
                    }
                    inputMode="decimal"
                    disabled={!unit}
                    value={car.consumption}
                    onChange={(event) => setCar(index, { consumption: event.target.value })}
                    error={parsed.consumption.error}
                  />
                  {phev && (
                    <TextField
                      label="Strom in kWh je 100 km"
                      hint="Ebenfalls im Durchschnitt über alle Fahrten; lädst du selten, ist es wenig"
                      inputMode="decimal"
                      value={car.electricConsumption}
                      onChange={(event) =>
                        setCar(index, { electricConsumption: event.target.value })
                      }
                      error={parsed.electricConsumption.error}
                    />
                  )}
                  <TextField
                    label="Kfz-Steuer in Euro pro Jahr"
                    hint={
                      <Link to={taxLink} target="_blank" rel="noopener">
                        Steuer berechnen
                        <span className="visually-hidden"> (öffnet in neuem Tab)</span>
                      </Link>
                    }
                    inputMode="decimal"
                    value={car.tax}
                    onChange={(event) => setCar(index, { tax: event.target.value })}
                    error={parsed.tax.error}
                  />
                  <TextField
                    label="Versicherung in Euro pro Jahr"
                    hint="Beitrag laut Angebot deines Versicherers; wähl für alle Autos denselben Umfang (Haftpflicht, Teil- oder Vollkasko). Er hängt unter anderem von Typklasse, Regionalklasse und Schadenfreiheitsklasse ab"
                    inputMode="decimal"
                    value={car.insurance}
                    onChange={(event) => setCar(index, { insurance: event.target.value })}
                    error={parsed.insurance.error}
                  />
                  <TextField
                    label="Werkstatt und Reifen in Euro pro Jahr"
                    hint="Inspektion, HU/AU, Reifen, Verschleißteile und Reparaturen; ältere Autos brauchen mehr Rücklage"
                    inputMode="decimal"
                    value={car.workshop}
                    onChange={(event) => setCar(index, { workshop: event.target.value })}
                    error={parsed.workshop.error}
                  />
                  <TextField
                    label="Sonstiges in Euro pro Jahr"
                    hint="Zum Beispiel Pflege, Parken oder Zinsen einer Finanzierung"
                    inputMode="decimal"
                    value={car.other}
                    onChange={(event) => setCar(index, { other: event.target.value })}
                    error={parsed.other.error}
                  />
                </div>
                {cost.missing.length < COST_PARTS.length && (
                  <p className="monthly-costs__car-total">
                    Rund {euros(cost.totalEur)} im Monat
                    {cost.missing.length > 0 &&
                      ` – ohne ${cost.missing.map((part) => COST_PART_LABELS[part]).join(', ')}`}
                  </p>
                )}
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
                    {items.map((item, index) => (
                      <th key={item.savedListingId} scope="col">
                        {titles[index]}
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
                    <th scope="row">Summe im Monat, geschätzt</th>
                    {costs.map((cost, index) => (
                      <td key={index}>
                        {cost.missing.length === COST_PARTS.length ? (
                          <span className="not-stated">Keine Angabe</span>
                        ) : (
                          <>
                            rund {euros(cost.totalEur)}
                            {index === lowest && <span className="marker">niedrigste Summe</span>}
                            {cost.missing.length > 0 && (
                              <span className="monthly-costs__missing">
                                ohne {cost.missing.map((part) => COST_PART_LABELS[part]).join(', ')}
                              </span>
                            )}
                          </>
                        )}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          {started && !sameParts && (
            <p className="muted">
              Die Summen sind erst vergleichbar, wenn für alle Angebote dieselben Posten ausgefüllt
              sind. Fällt ein Posten weg, etwa die Steuer, trag 0 ein.
            </p>
          )}
        </>
      )}
    </section>
  );
}
