import {
  BODY_TYPE_LABELS,
  BODY_TYPES,
  cleanModelText,
  findModel,
  MAKES,
  makeById,
  modelById,
  modelsOfMake,
  SEARCH_FUEL_LABELS,
  SEARCH_FUELS,
  SEARCH_RADII,
  SEARCH_TRANSMISSION_LABELS,
  SEARCH_TRANSMISSIONS,
  type BodyType,
  type SearchFuel,
  type SearchQuery,
  type SearchTransmission,
} from '@kaufcheck/catalog';
import { Search } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { Button } from '../../components/ui/Button';
import { SelectField, TextField } from '../../components/ui/Field';
import { cn, formatNumber } from '../../lib/format';

const POPULAR_MAKES = MAKES.slice(0, 16);
const OTHER_MAKES = [...MAKES.slice(16)].sort((a, b) => a.name.localeCompare(b.name, 'de'));

const PRICES = [
  1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 12500, 15000, 17500, 20000, 25000,
  30000, 35000, 40000, 50000, 60000, 75000, 100000,
];
const MILEAGES = [
  10000, 20000, 30000, 50000, 75000, 100000, 125000, 150000, 175000, 200000, 250000,
];

function years(now = new Date()): number[] {
  const current = now.getFullYear();
  return Array.from({ length: current - 1989 }, (_, index) => current - index);
}

/** The steps plus the current value, so a value from a shared link stays visible. */
function withValue(steps: readonly number[], value: string, descending = false): number[] {
  const current = value === '' ? null : Number(value);
  const values = current === null || steps.includes(current) ? [...steps] : [...steps, current];
  return values.sort((a, b) => (descending ? b - a : a - b));
}

interface FormState {
  makeId: string;
  model: string;
  priceMin: string;
  priceMax: string;
  yearMin: string;
  yearMax: string;
  kmMax: string;
  fuel: string;
  transmission: string;
  body: string;
  zip: string;
  radius: string;
}

function toState(query: SearchQuery): FormState {
  const model = query.modelId ? (modelById(query.modelId)?.model ?? '') : (query.modelText ?? '');
  const text = (value: number | string | null) => (value === null ? '' : String(value));
  return {
    makeId: query.makeId ?? '',
    model,
    priceMin: text(query.priceMin),
    priceMax: text(query.priceMax),
    yearMin: text(query.yearMin),
    yearMax: text(query.yearMax),
    kmMax: text(query.kmMax),
    fuel: query.fuel ?? '',
    transmission: query.transmission ?? '',
    body: query.body ?? '',
    zip: query.zip ?? '',
    radius: text(query.radiusKm ?? 50),
  };
}

const number = (value: string): number | null => (value === '' ? null : Number(value));

function toQuery(state: FormState): SearchQuery {
  let makeId = makeById(state.makeId)?.id ?? null;
  const typed = state.model.trim();
  // "Golf" without a make still finds the VW Golf.
  const model = typed ? findModel(makeId, typed) : null;
  if (model && !makeId) makeId = model.makeId;
  const zip = /^\d{5}$/.test(state.zip.trim()) ? state.zip.trim() : null;
  return {
    makeId,
    modelId: model?.id ?? null,
    modelText: model ? null : cleanModelText(typed),
    priceMin: number(state.priceMin),
    priceMax: number(state.priceMax),
    yearMin: number(state.yearMin),
    yearMax: number(state.yearMax),
    kmMax: number(state.kmMax),
    fuel: (state.fuel || null) as SearchFuel | null,
    transmission: (state.transmission || null) as SearchTransmission | null,
    body: (state.body || null) as BodyType | null,
    zip,
    radiusKm: zip ? number(state.radius) : null,
  };
}

interface SearchFormProps {
  initial: SearchQuery;
  onSearch: (query: SearchQuery) => void;
  /** Compact: make, model, price and ZIP only (homepage). */
  variant?: 'compact' | 'full';
}

/** The car search. It only builds links – KaufCheck never searches the platforms itself. */
export function SearchForm({ initial, onSearch, variant = 'full' }: SearchFormProps) {
  const [state, setState] = useState<FormState>(() => toState(initial));
  const [zipError, setZipError] = useState<string | null>(null);
  const listId = useId();
  const set = (key: keyof FormState) => (value: string) => {
    setState((current) => ({ ...current, [key]: value }));
    if (key === 'zip') setZipError(null);
  };
  const suggestions = state.makeId ? modelsOfMake(state.makeId) : [];
  const full = variant === 'full';

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (state.zip.trim() && !/^\d{5}$/.test(state.zip.trim())) {
      setZipError('Bitte gib eine fünfstellige Postleitzahl ein.');
      return;
    }
    onSearch(toQuery(state));
  };

  return (
    <form
      className={cn('search-form', full ? 'search-form--full' : 'search-form--compact')}
      onSubmit={submit}
      role="search"
      aria-label="Gebrauchtwagen suchen"
      noValidate
    >
      <div className="search-form__grid">
        <SelectField
          label="Marke"
          value={state.makeId}
          onChange={(event) => {
            set('makeId')(event.target.value);
            // A model of another make no longer fits.
            if (state.model && !findModel(event.target.value || null, state.model))
              set('model')('');
          }}
        >
          <option value="">Alle Marken</option>
          <optgroup label="Häufig gesucht">
            {POPULAR_MAKES.map((make) => (
              <option key={make.id} value={make.id}>
                {make.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Weitere Marken">
            {OTHER_MAKES.map((make) => (
              <option key={make.id} value={make.id}>
                {make.name}
              </option>
            ))}
          </optgroup>
        </SelectField>
        <TextField
          label="Modell"
          value={state.model}
          onChange={(event) => set('model')(event.target.value)}
          list={suggestions.length > 0 ? listId : undefined}
          placeholder={state.makeId ? 'Alle Modelle' : 'z. B. Golf'}
          autoComplete="off"
          maxLength={40}
        />
        {suggestions.length > 0 && (
          <datalist id={listId}>
            {suggestions.map((model) => (
              <option key={model.id} value={model.model} />
            ))}
          </datalist>
        )}
        {full && (
          <SelectField
            label="Preis ab"
            value={state.priceMin}
            onChange={(event) => set('priceMin')(event.target.value)}
          >
            <option value="">beliebig</option>
            {withValue(PRICES, state.priceMin).map((price) => (
              <option key={price} value={price}>
                {formatNumber(price)} €
              </option>
            ))}
          </SelectField>
        )}
        <SelectField
          label="Preis bis"
          value={state.priceMax}
          onChange={(event) => set('priceMax')(event.target.value)}
        >
          <option value="">beliebig</option>
          {withValue(PRICES, state.priceMax).map((price) => (
            <option key={price} value={price}>
              {formatNumber(price)} €
            </option>
          ))}
        </SelectField>
        {full && (
          <>
            <SelectField
              label="Erstzulassung ab"
              value={state.yearMin}
              onChange={(event) => set('yearMin')(event.target.value)}
            >
              <option value="">beliebig</option>
              {withValue(years(), state.yearMin, true).map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Kilometer bis"
              value={state.kmMax}
              onChange={(event) => set('kmMax')(event.target.value)}
            >
              <option value="">beliebig</option>
              {withValue(MILEAGES, state.kmMax).map((km) => (
                <option key={km} value={km}>
                  {formatNumber(km)} km
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Kraftstoff"
              value={state.fuel}
              onChange={(event) => set('fuel')(event.target.value)}
            >
              <option value="">beliebig</option>
              {SEARCH_FUELS.map((fuel) => (
                <option key={fuel} value={fuel}>
                  {SEARCH_FUEL_LABELS[fuel]}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Getriebe"
              value={state.transmission}
              onChange={(event) => set('transmission')(event.target.value)}
            >
              <option value="">beliebig</option>
              {SEARCH_TRANSMISSIONS.map((transmission) => (
                <option key={transmission} value={transmission}>
                  {SEARCH_TRANSMISSION_LABELS[transmission]}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Karosserie"
              value={state.body}
              onChange={(event) => set('body')(event.target.value)}
            >
              <option value="">beliebig</option>
              {BODY_TYPES.map((body) => (
                <option key={body} value={body}>
                  {BODY_TYPE_LABELS[body]}
                </option>
              ))}
            </SelectField>
          </>
        )}
        <TextField
          label="PLZ"
          value={state.zip}
          onChange={(event) => set('zip')(event.target.value.replace(/\D/g, '').slice(0, 5))}
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="z. B. 79098"
          error={zipError}
        />
        {full && (
          <SelectField
            label="Umkreis"
            value={state.radius}
            onChange={(event) => set('radius')(event.target.value)}
            disabled={!/^\d{5}$/.test(state.zip)}
          >
            {SEARCH_RADII.map((radius) => (
              <option key={radius} value={radius}>
                {radius} km
              </option>
            ))}
          </SelectField>
        )}
      </div>
      <Button
        type="submit"
        size="lg"
        className="search-form__submit"
        icon={<Search aria-hidden size={20} />}
      >
        Angebote finden
      </Button>
    </form>
  );
}
