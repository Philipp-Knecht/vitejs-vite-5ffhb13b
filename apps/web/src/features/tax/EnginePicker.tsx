import { makeById } from '@kaufcheck/catalog';
import {
  ENGINE_SOURCE,
  engineKey,
  engineLabels,
  engineYear,
  engineYears,
  enginesOfYear,
  type EngineIndex,
  type EngineRecord,
} from '@kaufcheck/catalog/engines';
import { SelectField } from '../../components/ui/Field';
import { formatNumber } from '../../lib/format';
import type { EnginePick } from './engines';

const day = (iso: string) => iso.split('-').reverse().join('.');

/**
 * Make, model and engine from the EU's registration data. Picking an engine
 * fills displacement, CO₂ and consumption with typical values; the figures
 * in the registration certificate stay binding.
 */
export function EnginePicker({
  index,
  engines,
  enginesFailed,
  firstRegistration,
  currentYear,
  value,
  missing,
  onChange,
}: {
  index: EngineIndex | undefined;
  /** The engines of the picked model, while loaded. */
  engines: readonly EngineRecord[] | undefined;
  enginesFailed: boolean;
  firstRegistration: string;
  currentYear: number;
  value: EnginePick;
  /** Values the EU data lacks for the picked engine. */
  missing: readonly string[];
  onChange: (pick: EnginePick, engine: EngineRecord | null) => void;
}) {
  const makes = index
    ? Object.keys(index.makes)
        .map((id) => ({ id, name: makeById(id)?.name ?? id }))
        .sort((a, b) => a.name.localeCompare(b.name, 'de'))
    : [];
  const models = (index && value.makeId && index.makes[value.makeId]) || [];
  const year = engines ? engineYear(engines, firstRegistration, currentYear) : null;
  const options = engines && year !== null ? enginesOfYear(engines, year) : [];
  const labels = engineLabels(options);
  const picked = options.find((engine) => engineKey(engine) === value.engineKey) ?? null;
  const range = engines ? engineYears(engines) : null;
  const registrationYear = Number(firstRegistration.slice(0, 4));
  const provisional = year !== null && index?.provisionalYears.includes(year);

  let hint: string;
  if (!value.modelId) hint = 'Wähl Marke und Modell, dann den Motor.';
  else if (!firstRegistration)
    hint = 'Trag oben die Erstzulassung ein, dann zeigt KaufCheck die Motoren dieses Jahrgangs.';
  else if (enginesFailed) hint = 'Die Motoren ließen sich nicht laden. Bitte lade die Seite neu.';
  else if (!engines) hint = 'Motoren werden geladen …';
  else if (year === null)
    hint = range
      ? `Für ${registrationYear || 'dieses Jahr'} hat dieses Modell keine Daten; vorhanden sind ${range.first} bis ${range.last}.`
      : 'Für dieses Modell gibt es keine Daten.';
  else if (year !== registrationYear)
    hint = `Die EU-Daten für dieses Modell reichen bis ${year}; gezeigt sind die Motoren von ${year}.`;
  else hint = `Motoren der Neuzulassungen ${year} in Deutschland, die häufigsten zuerst.`;
  if (provisional) hint += ` Für ${year} gibt es nur vorläufige Zahlen.`;

  return (
    <fieldset className="engine-picker">
      <legend>Werte aus dem Modell übernehmen</legend>
      <SelectField
        label="Marke"
        value={value.makeId}
        disabled={!index}
        onChange={(event) =>
          onChange({ makeId: event.target.value, modelId: '', engineKey: '' }, null)
        }
      >
        <option value="">{index ? 'Bitte wählen' : 'Wird geladen …'}</option>
        {makes.map((make) => (
          <option key={make.id} value={make.id}>
            {make.name}
          </option>
        ))}
      </SelectField>
      <SelectField
        label="Modell"
        value={value.modelId}
        disabled={models.length === 0}
        onChange={(event) =>
          onChange({ ...value, modelId: event.target.value, engineKey: '' }, null)
        }
      >
        <option value="">Bitte wählen</option>
        {models.map((model) => (
          <option key={model.id} value={model.id}>
            {model.name}
          </option>
        ))}
      </SelectField>
      <SelectField
        label="Motor"
        hint={hint}
        value={picked ? value.engineKey : ''}
        disabled={options.length === 0}
        onChange={(event) => {
          const engine = options.find((option) => engineKey(option) === event.target.value) ?? null;
          onChange({ ...value, engineKey: event.target.value }, engine);
        }}
      >
        <option value="">Bitte wählen</option>
        {options.map((engine) => (
          <option key={engineKey(engine)} value={engineKey(engine)}>
            {labels.get(engineKey(engine))}
          </option>
        ))}
      </SelectField>
      {picked && (
        <div className="field__hint engine-picker__source" aria-live="polite">
          <p>
            Eingetragen sind typische Werte von {formatNumber(picked.registrations)} Neuzulassungen;
            verbindlich ist dein Fahrzeugschein (P.1, V.7).
            {picked.fuel === 'electric' &&
              ' Die kW sind die an die EU gemeldete Leistung; im Inserat steht oft eine höhere Spitzenleistung.'}
            {missing.length > 0 &&
              ` In den EU-Daten fehlt ${missing.join(' und ')}: bitte aus dem Fahrzeugschein eintragen.`}
          </p>
          <p>
            Quelle:{' '}
            <a href={ENGINE_SOURCE.url} target="_blank" rel="noopener noreferrer">
              {ENGINE_SOURCE.name}
            </a>
            , © {ENGINE_SOURCE.holder}, Lizenz{' '}
            <a href={ENGINE_SOURCE.licenceUrl} target="_blank" rel="noopener noreferrer">
              {ENGINE_SOURCE.licence}
            </a>
            ; von KaufCheck zusammengefasst (Median je Motor), abgerufen am{' '}
            {index && day(index.retrieved)}.
          </p>
        </div>
      )}
    </fieldset>
  );
}
