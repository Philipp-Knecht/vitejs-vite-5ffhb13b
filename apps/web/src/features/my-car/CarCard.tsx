import { hasKnowledge, loadKnowledge } from '@kaufcheck/catalog/knowledge';
import { FUEL_LABELS, huStatus, monthYear, type OwnedCarDto } from '@kaufcheck/shared';
import { useQuery } from '@tanstack/react-query';
import { CalendarPlus, Pencil, Trash2 } from 'lucide-react';
import { Link } from 'react-router';
import { useMe } from '../../api/queries';
import { Button } from '../../components/ui/Button';
import { downloadTextFile } from '../../lib/download';
import { formatNumber } from '../../lib/format';
import { RecallCheck } from '../recalls/RecallCheck';
import { ModelKnowledgeView } from '../search/ModelInsights';
import { taxCalculatorLink } from '../tax/tax-link';
import { carHeadingId, carHuCalendarFile, carName, carTitle } from './car';

function Knowledge({ car }: { car: OwnedCarDto }) {
  const modelId = car.modelId && hasKnowledge(car.modelId) ? car.modelId : null;
  const knowledge = useQuery({
    queryKey: ['model-knowledge', modelId],
    queryFn: () => loadKnowledge(modelId as string),
    enabled: modelId !== null,
    staleTime: Infinity,
  });
  if (!modelId) {
    return (
      <p className="muted">
        Zu diesem Modell hat KaufCheck noch keine recherchierten Schwachstellen.
      </p>
    );
  }
  if (knowledge.isError)
    return <p className="muted">Die Schwachstellen konnten nicht geladen werden.</p>;
  if (!knowledge.data) return null;
  const year = car.firstRegistration.year;
  return (
    <>
      <ModelKnowledgeView
        model={knowledge.data}
        yearMin={year}
        yearMax={year}
        initialGenerationId={car.generationId}
        generationHeading="h4"
        compact
        owner
      />
      <p>
        <Link to={`/modelle/${modelId}`}>
          Alle Infos zu {knowledge.data.make} {knowledge.data.model}
        </Link>
      </p>
    </>
  );
}

/** One car in „Mein Auto“: the facts, the next HU and what to keep an eye on. */
export function CarCard({
  car,
  now,
  onEdit,
  onDelete,
}: {
  car: OwnedCarDto;
  now: Date;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const me = useMe();
  const carLog = me.data?.entitlements.carLog ?? false;
  const reminders = me.data?.entitlements.reminders ?? false;
  const title = carTitle(car);
  const hu = car.huUntil ? huStatus(car.huUntil, now) : null;
  const headingId = carHeadingId(car.id);

  const downloadCalendar = (until: { year: number; month: number }) =>
    downloadTextFile(
      `hu-${until.year}-${String(until.month).padStart(2, '0')}.ics`,
      carHuCalendarFile(car, until, new Date()),
      'text/calendar;charset=utf-8',
    );

  return (
    <article className="car-card" aria-labelledby={headingId}>
      <header className="car-card__header">
        <div>
          <h2 id={headingId} className="car-card__title" tabIndex={-1}>
            {carName(car)}
          </h2>
          {car.nickname && <p className="car-card__subtitle">{title}</p>}
        </div>
        <div className="button-row">
          <Button
            variant="quiet"
            size="sm"
            icon={<Pencil aria-hidden size={16} />}
            onClick={onEdit}
          >
            Bearbeiten<span className="visually-hidden">: {carName(car)}</span>
          </Button>
          <Button
            variant="quiet"
            size="sm"
            icon={<Trash2 aria-hidden size={16} />}
            onClick={onDelete}
          >
            Löschen<span className="visually-hidden">: {carName(car)}</span>
          </Button>
        </div>
      </header>

      <dl className="definition-list car-card__facts">
        <div>
          <dt>Erstzulassung</dt>
          <dd>{monthYear(car.firstRegistration)}</dd>
        </div>
        {car.mileageKm !== null && (
          <div>
            <dt>Kilometerstand</dt>
            <dd>{formatNumber(car.mileageKm)} km</dd>
          </div>
        )}
        {car.fuel && (
          <div>
            <dt>Kraftstoff</dt>
            <dd>{FUEL_LABELS[car.fuel]}</dd>
          </div>
        )}
      </dl>

      <div className="car-card__section">
        <h3>Hauptuntersuchung</h3>
        {car.huUntil && hu ? (
          <>
            <p className={`car-card__hu car-card__hu--${hu.tone}`}>{hu.text}</p>
            {hu.tone === 'overdue' && (
              <p className="muted">
                Vereinbare bald einen Termin. Ist die HU mehr als zwei Monate überzogen, wird eine
                teurere Ergänzungsuntersuchung fällig.
              </p>
            )}
            {/* From this month on the calendar entry would lie in the past. */}
            {hu.monthsLeft >= 1 && (
              <div className="no-print">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<CalendarPlus aria-hidden size={16} />}
                  onClick={() => downloadCalendar(car.huUntil!)}
                >
                  HU-Frist in den Kalender
                </Button>
                <p className="muted car-card__note">
                  {hu.monthsLeft >= 2
                    ? 'Der Termin steht am Monatsersten; übernimmt dein Kalender die Erinnerung aus der Datei, meldet er sich vier Wochen vorher.'
                    : 'Der Termin steht am Monatsersten in deinem Kalender.'}
                </p>
              </div>
            )}
          </>
        ) : (
          <p className="muted">
            Trag Monat und Jahr von der Prüfplakette ein, dann siehst du hier, wann die nächste HU
            fällig ist.
          </p>
        )}
      </div>

      <div className="car-card__section">
        <h3>Erinnerungen</h3>
        <p>
          <Link to={`/mein-auto/${car.id}/erinnerungen`}>
            Erinnerungen einstellen<span className="visually-hidden"> für {carName(car)}</span>
          </Link>
          {' – '}
          per E-Mail oder im Kalender: HU, Inspektion, Bremsflüssigkeit und Reifenwechsel.
          {!reminders && <span className="tag tag--pro">Pro</span>}
        </p>
      </div>

      <div className="car-card__section">
        <h3>Bekannte Schwachstellen</h3>
        <Knowledge car={car} />
      </div>

      <div className="car-card__section">
        <h3>Rückrufe</h3>
        <RecallCheck makeId={car.makeId} placement="my_car" />
      </div>

      <div className="car-card__section">
        <h3>Kosten</h3>
        <p>
          <Link to={taxCalculatorLink(car)}>Kfz-Steuer und laufende Kosten berechnen</Link>
        </p>
        <p>
          <Link to="/kfz-steuer-rechner#typklasse">
            Typklasse für die Versicherung nachschlagen
          </Link>
          {' – '}
          sie wird jedes Jahr neu berechnet und beeinflusst deinen Beitrag.
        </p>
      </div>

      <div className="car-card__section">
        <h3>Kostenbuch und Serviceheft</h3>
        <p>
          <Link to={`/mein-auto/${car.id}/kostenbuch`}>
            Kostenbuch öffnen<span className="visually-hidden"> für {carName(car)}</span>
          </Link>
          {' – '}
          Tankungen, Wartung und Reparaturen festhalten und sehen, was das Auto im Monat kostet.
          {!carLog && <span className="tag tag--pro">Pro</span>}
        </p>
      </div>

      <div className="car-card__section">
        <h3>Verkaufen</h3>
        <p>
          <Link to={`/auto-verkaufen?auto=${car.id}#inserat`}>
            Inseratstext schreiben<span className="visually-hidden"> für {carName(car)}</span>
          </Link>
          {' – '}
          mit den Daten von hier. Dazu eine Checkliste für den Verkauf und was du danach abmelden
          und melden musst.
        </p>
      </div>
    </article>
  );
}
