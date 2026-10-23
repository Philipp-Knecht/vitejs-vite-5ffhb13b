import {
  formatDutchPlate,
  normalizeDutchPlate,
  ODOMETER_EXPLANATIONS,
  ODOMETER_VERDICT_LABELS,
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

/** An import: first admitted elsewhere, registered in the Netherlands later. */
function importedToNl(vehicle: RdwVehicle): boolean {
  return (
    !!vehicle.firstAdmission &&
    !!vehicle.firstRegistrationNl &&
    vehicle.firstRegistrationNl.slice(0, 7) > vehicle.firstAdmission.slice(0, 7)
  );
}

function Result({ vehicle, checkedAt }: { vehicle: RdwVehicle; checkedAt: string }) {
  const open = vehicle.recalls.filter((recall) => recall.open);
  const odometer = vehicle.odometer;
  const explanation = odometer.code ? ODOMETER_EXPLANATIONS[odometer.code] : undefined;
  return (
    <div className="rdw-result">
      <h3>
        {vehicle.make} {vehicle.model}{' '}
        <span className="rdw-result__plate">{formatDutchPlate(vehicle.plate)}</span>
      </h3>
      <dl className="rdw-result__facts">
        <div>
          <dt>Erstzulassung</dt>
          <dd>{day(vehicle.firstAdmission)}</dd>
        </div>
        <div>
          <dt>Erste Zulassung in den Niederlanden</dt>
          <dd>
            {day(vehicle.firstRegistrationNl)}
            {importedToNl(vehicle) && ' (in die Niederlande eingeführt)'}
          </dd>
        </div>
        <div>
          <dt>Letzter Halterwechsel in den Niederlanden</dt>
          <dd>{day(vehicle.lastKeeperChange)}</dd>
        </div>
        <div>
          <dt>Ausgeführt</dt>
          <dd>{vehicle.exported ? 'Ja, das Auto ist aus den Niederlanden ausgeführt' : 'Nein'}</dd>
        </div>
        <div>
          <dt>Niederländische Hauptuntersuchung (APK) gültig bis</dt>
          <dd>{day(vehicle.apkUntil)}</dd>
        </div>
        <div>
          <dt>Als Taxi genutzt</dt>
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
                .map((fuel) => (fuel.kw ? `${fuel.fuel}, ${fuel.kw} kW` : fuel.fuel))
                .join('; ')}
            </dd>
          </div>
        )}
      </dl>

      <h4>Kilometerstand</h4>
      <p className={`rdw-result__verdict rdw-result__verdict--${odometer.verdict}`}>
        Bewertung der RDW: <strong>{ODOMETER_VERDICT_LABELS[odometer.verdict]}</strong>
        {odometer.lastReadingYear && ` – letzter gemeldeter Stand ${odometer.lastReadingYear}`}
      </p>
      {explanation && <p>{explanation}</p>}
      <p className="field__hint">
        Die RDW nennt keine Kilometerstände, nur ihre Bewertung des Verlaufs. Nach der Ausfuhr
        meldet niemand mehr Stände an die RDW; vergleiche den Tacho mit Serviceheft und
        Prüfberichten.
      </p>

      <h4>Rückrufe</h4>
      {vehicle.recalls.length === 0 ? (
        <p>Die RDW kennt für dieses Kennzeichen keine Rückrufe.</p>
      ) : (
        <>
          <p>
            {open.length > 0
              ? `${open.length} von ${vehicle.recalls.length} Rückrufen sind laut RDW noch offen.`
              : `Alle ${vehicle.recalls.length} Rückrufe hat der Hersteller als erledigt gemeldet.`}{' '}
            Lass dir offene Rückrufe in einer Vertragswerkstatt der Marke erledigen.
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

      <h4>Mängel bei der APK</h4>
      {vehicle.inspections.length === 0 ? (
        <p>
          Die RDW nennt für dieses Kennzeichen keine festgestellten Mängel. Prüfungen ohne Mangel
          stehen nicht in diesen Daten.
        </p>
      ) : (
        <>
          <p>
            Festgestellte Mängel nach Prüfdatum, in der Beschreibung der RDW (niederländisch).
            Prüfungen ohne Mangel stehen nicht in diesen Daten.
          </p>
          <ul className="rdw-result__list">
            {vehicle.inspections.map((inspection) => (
              <li key={inspection.date}>
                <strong>{day(inspection.date)}:</strong>{' '}
                {inspection.defects
                  .map(
                    (defect) =>
                      `${defect.count > 1 ? `${defect.count} × ` : ''}${defect.description ?? `Mangel ${defect.code}`}`,
                  )
                  .join('; ')}
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="field__hint">
        Unfälle und Schäden stehen nicht in den offenen Daten der RDW. Stand der Abfrage:{' '}
        {new Date(checkedAt).toLocaleString('de-DE')}. Quelle:{' '}
        <a href={RDW_SOURCE.url} {...external}>
          {RDW_SOURCE.name}
        </a>{' '}
        ({RDW_SOURCE.licence}); Übersetzung und Zusammenfassung von KaufCheck.
      </p>
    </div>
  );
}

/** The lookup of a Dutch registration number at RDW Open Data, through KaufCheck's server. */
export function RdwCheck() {
  const resultId = useId();
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
      return;
    }
    setError(undefined);
    lookup.mutate(normalized);
  };

  return (
    <div className="rdw-check">
      <form className="tax-form" onSubmit={submit} noValidate>
        <TextField
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
      <section aria-live="polite" aria-labelledby={resultId}>
        <h3 id={resultId} className="visually-hidden">
          Ergebnis der Abfrage
        </h3>
        {lookup.isError && <Alert tone="error">{toApiRequestError(lookup.error).message}</Alert>}
        {lookup.data && !lookup.data.vehicle && (
          <Alert tone="info">
            Unter diesem Kennzeichen kennt die RDW kein Fahrzeug. Prüf die Schreibweise – Buchstaben
            und Ziffern genau wie auf dem Kennzeichen.
          </Alert>
        )}
        {lookup.data?.vehicle && (
          <Result vehicle={lookup.data.vehicle} checkedAt={lookup.data.checkedAt} />
        )}
      </section>
    </div>
  );
}
