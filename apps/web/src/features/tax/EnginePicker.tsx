import { makeById } from '@kaufcheck/catalog';
import {
  ENGINE_SOURCE,
  engineLabel,
  type EngineIndex,
  type EngineRecord,
} from '@kaufcheck/catalog/engines';
import { SelectField } from '../../components/ui/Field';
import { formatNumber } from '../../lib/format';
import { enginesOfYear, engineKey, engineYear, type EnginePick } from './engines';

/**
 * Make, model and engine from the EU's registration data. Picking an engine
 * fills displacement, CO₂ and consumption with typical values; the figures
 * in the registration certificate stay binding.
 */
export function EnginePicker({
  index,
  engines,
  firstRegistration,
  value,
  onChange,
}: {
  index: EngineIndex | undefined;
  /** The engines of the picked model, while loaded. */
  engines: readonly EngineRecord[] | undefined;
  firstRegistration: string;
  value: EnginePick;
  onChange: (pick: EnginePick, engine: EngineRecord | null) => void;
}) {
  const makes = index
    ? Object.keys(index.makes)
        .map((id) => ({ id, name: makeById(id)?.name ?? id }))
        .sort((a, b) => a.name.localeCompare(b.name, 'de'))
    : [];
  const models = (index && value.makeId && index.makes[value.makeId]) || [];
  const year = engines ? engineYear(engines, firstRegistration) : null;
  const options = engines && year !== null ? enginesOfYear(engines, year) : [];
  const picked = options.find((engine) => engineKey(engine) === value.engineKey) ?? null;
  const registrationYear = Number(firstRegistration.slice(0, 4)) || null;

  let hint: string;
  if (!value.modelId) hint = 'Wähl Marke und Modell, dann den Motor.';
  else if (!firstRegistration)
    hint = 'Trag oben die Erstzulassung ein, dann zeigt KaufCheck die Motoren dieses Jahrgangs.';
  else if (!engines) hint = 'Motoren werden geladen …';
  else if (year === null)
    hint = `Für ${registrationYear} gibt es keine Motoren in den EU-Daten; sie beginnen mit 2010.`;
  else if (year !== registrationYear)
    hint = `Neuere Jahrgänge fehlen noch in den EU-Daten; gezeigt sind die Motoren von ${year}.`;
  else hint = `Motoren der Neuzulassungen ${year} in Deutschland, die häufigsten zuerst.`;

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
            {engineLabel(engine)}
          </option>
        ))}
      </SelectField>
      {picked && (
        <p className="field__hint engine-picker__source">
          Typische Werte von {formatNumber(picked.registrations)} Neuzulassungen; verbindlich ist
          dein Fahrzeugschein (P.1, V.7). Quelle:{' '}
          <a href={ENGINE_SOURCE.url} target="_blank" rel="noopener noreferrer">
            {ENGINE_SOURCE.name}
          </a>{' '}
          (
          <a href={ENGINE_SOURCE.licenceUrl} target="_blank" rel="noopener noreferrer">
            {ENGINE_SOURCE.licence}
          </a>
          ), zusammengefasst von KaufCheck, Stand {index?.retrieved.split('-').reverse().join('.')}.
        </p>
      )}
    </fieldset>
  );
}
