import {
  formatDutchPlate,
  normalizeDutchPlate,
  ODOMETER_EXPLANATIONS,
  ODOMETER_VERDICT_LABELS,
  RDW_FUEL_LABELS,
  RDW_KIND_LABELS,
  RDW_SOURCE,
  type RdwLookupResponse,
  type RdwVehicle,
} from '@kaufcheck/shared';
import { useMutation } from '@tanstack/react-query';
import { useId, useState, type FormEvent } from 'react';
import { api, toApiRequestError } from '../../api/client';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/Field';
import { formatEuro } from '../../lib/format';

const day = (iso: string | null) => (iso ? iso.split('-').reverse().join('.') : '–');
const external = { target: '_blank', rel: 'noopener noreferrer' } as const;
const fuelName = (fuel: string) => RDW_FUEL_LABELS[fuel] ?? fuel;

function Result({ vehicle, checkedAt }: { vehicle: RdwVehicle; checkedAt: string }) {
  const open = vehicle.recalls.filter((recall) => recall.open);
  const odometer = vehicle.odometer;
  const explanation = odometer.code ? ODOMETER_EXPLANATIONS[odometer.code] : undefined;
  const kind = RDW_KIND_LABELS[vehicle.kind] ?? vehicle.kind;
  return (
    <div className="rdw-result">
      <h3>
        {vehicle.make} {vehicle.model}{' '}
        <span className="rdw-result__plate">{formatDutchPlate(vehicle.plate)}</span>
      </h3>
      {vehicle.kind && vehicle.kind !== 'Personenauto' && (
        <p className="rdw-result__kind">Fahrzeugart laut RDW: {kind}</p>
      )}
      <dl className="rdw-result__facts">
        <div>
          <dt>Erstzulassung</dt>
          <dd>{day(vehicle.firstAdmission)}</dd>
        </div>
        <div>
          <dt>Erste Zulassung in den Niederlanden</dt>
          <dd>{day(vehicle.firstRegistrationNl)}</dd>
        </div>
        {vehicle.lastKeeperChange && (
          <div>
            <dt>Letzter Halterwechsel in den Niederlanden</dt>
            <dd>{day(vehicle.lastKeeperChange)}</dd>
          </div>
        )}
        <div>
          <dt>Ausgeführt</dt>
          <dd>{vehicle.exported ? 'Ja, laut RDW aus den Niederlanden ausgeführt' : 'Nein'}</dd>
        </div>
        <div>
          <dt>Niederländische Hauptuntersuchung (APK) gültig bis</dt>
          <dd>{day(vehicle.apkUntil)}</dd>
        </div>
        <div>
          <dt>Taxi-Kennzeichnung der RDW</dt>
          <dd>{vehicle.taxi ? 'Ja' : 'Nein'}</dd>
        </div>
        {vehicle.listPriceEur !== null && vehicle.listPriceEur > 0 && (
          <div>
            <dt>Listenpreis (Katalogpreis)</dt>
            <dd>{formatEuro(vehicle.listPriceEur)}</dd>
          </div>
        )}
        {vehicle.fuels.length > 0 && (
          <div>
            <dt>Kraftstoff und Leistung</dt>
            <dd>
              {vehicle.fuels
                .map((fuel) =>
                  fuel.kw ? `${fuelName(fuel.fuel)}, ${fuel.kw} kW` : fuelName(fuel.fuel),
                )
                .join('; ')}
            </dd>
          </div>
        )}
      </dl>

      <h4>Kilometerstand</h4>
      <p className={`rdw-result__verdict rdw-result__verdict--${odometer.verdict}`}>
        Urteil der RDW: <strong>{ODOMETER_VERDICT_LABELS[odometer.verdict]}</strong>
        {odometer.lastReadingYear && ` · Stand zuletzt gemeldet: ${odometer.lastReadingYear}`}
      </p>
      {explanation && <p>{explanation}</p>}
      <p className="field__hint">
        Die RDW nennt keine Kilometerstände, nur ihr Urteil über den Verlauf. Nach der Ausfuhr
        meldet niemand mehr Stände an die RDW; vergleiche den Tacho mit Serviceheft und
        Prüfberichten.
      </p>

      <h4>Rückrufe</h4>
      {vehicle.recalls.length === 0 ? (
        <p>Die RDW kennt für dieses Kennzeichen keine Rückrufe.</p>
      ) : (
        <>
          <p>
            {open.length === 0
              ? vehicle.recalls.length === 1
                ? 'Den Rückruf hat der Hersteller als erledigt gemeldet.'
                : `Alle ${vehicle.recalls.length} Rückrufe hat der Hersteller als erledigt gemeldet.`
              : `${open.length} von ${vehicle.recalls.length} ${vehicle.recalls.length === 1 ? 'Rückruf ist' : 'Rückrufen sind'} laut RDW noch offen. Lass offene Rückrufe in einer Vertragswerkstatt der Marke erledigen.`}
          </p>
          <ul className="rdw-result__list">
            {vehicle.recalls.map((recall) => (
              <li key={recall.reference}>
                {recall.reference}: {recall.open ? 'offen' : 'vom Hersteller als erledigt gemeldet'}
              </li>
            ))}
          </ul>
        </>
      )}

      <h4>Befunde bei der APK</h4>
      <p className="field__hint">
        Die offenen Daten nennen Mängel und Hinweise der APK aus etwa den letzten drei Jahren;
        ältere Prüfungen und Prüfungen ohne Befund stehen nicht darin. Die Beschreibungen sind die
        der RDW (niederländisch).
      </p>
      {vehicle.inspections.length === 0 ? (
        <p>Für dieses Kennzeichen nennt die RDW seitdem keine Befunde.</p>
      ) : (
        <ul className="rdw-result__list">
          {vehicle.inspections.map((inspection) => (
            <li key={inspection.date}>
              <strong>{day(inspection.date)}:</strong>{' '}
              {inspection.defects
                .map(
                  (defect) =>
                    `${defect.advisory ? 'Hinweis (kein Mangel): ' : 'Mangel: '}${defect.count > 1 ? `${defect.count} × ` : ''}${defect.description ?? defect.code}`,
                )
                .join('; ')}
            </li>
          ))}
        </ul>
      )}
      <p className="field__hint">
        Unfälle und Schäden stehen nicht in den offenen Daten der RDW. Abgefragt am{' '}
        {new Date(checkedAt).toLocaleString('de-DE')}. Quelle:{' '}
        <a href={RDW_SOURCE.url} {...external}>
          {RDW_SOURCE.name}
        </a>{' '}
        ({RDW_SOURCE.licence}); Übersetzung und Zusammenfassung von KaufCheck.
      </p>
    </div>
  );
}

/** A short sentence for screen readers when an answer arrives. */
function summary(response: RdwLookupResponse | undefined): string {
  if (!response) return '';
  const vehicle = response.vehicle;
  // „Not found“ is announced by its own message.
  if (!vehicle) return '';
  const open = vehicle.recalls.filter((recall) => recall.open).length;
  return `Ergebnis für ${vehicle.make} ${vehicle.model}: Kilometerstand ${ODOMETER_VERDICT_LABELS[vehicle.odometer.verdict]}, ${open === 1 ? 'ein offener Rückruf' : `${open} offene Rückrufe`}.`;
}

/** The lookup of a Dutch registration number at RDW Open Data, through KaufCheck's server. */
export function RdwCheck() {
  const inputId = useId();
  const [plate, setPlate] = useState('');
  const [error, setError] = useState<string | undefined>();
  const lookup = useMutation({
    mutationFn: (normalized: string) =>
      api.post<RdwLookupResponse>('/api/rdw', { plate: normalized }),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const normalized = normalizeDutchPlate(plate);
    if (!normalized) {
      setError('Bitte gib ein niederländisches Kennzeichen ein, zum Beispiel AB-123-C.');
      document.getElementById(inputId)?.focus();
      return;
    }
    setError(undefined);
    lookup.mutate(normalized);
  };

  return (
    <div className="rdw-check">
      <form className="tax-form" onSubmit={submit} noValidate>
        <TextField
          id={inputId}
          label="Niederländisches Kennzeichen"
          hint="Steht auf dem niederländischen Fahrzeugschein (kentekenbewijs), zum Beispiel AB-123-C"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={12}
          error={error}
          value={plate}
          onChange={(event) => setPlate(event.target.value)}
        />
        <Button type="submit" loading={lookup.isPending}>
          Bei der RDW abfragen
        </Button>
        <p className="field__hint">
          KaufCheck fragt die RDW von seinem Server aus ab; deine IP-Adresse erfährt die RDW nicht.
        </p>
      </form>
      <p className="visually-hidden" aria-live="polite">
        {lookup.isSuccess ? summary(lookup.data) : ''}
      </p>
      {lookup.isError && <Alert tone="error">{toApiRequestError(lookup.error).message}</Alert>}
      {lookup.data && !lookup.data.vehicle && (
        <Alert tone="info">
          Unter diesem Kennzeichen kennt die RDW kein Fahrzeug. Prüf die Schreibweise – oder das
          Auto ist schon länger ausgeführt: Dann steht es nicht mehr in den offenen Daten.
        </Alert>
      )}
      {lookup.data?.vehicle && (
        <Result vehicle={lookup.data.vehicle} checkedAt={lookup.data.checkedAt} />
      )}
    </div>
  );
}
