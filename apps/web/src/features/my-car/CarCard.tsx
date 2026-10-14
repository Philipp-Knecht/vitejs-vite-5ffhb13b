import { hasKnowledge, loadKnowledge } from '@kaufcheck/catalog/knowledge';
import { FUEL_LABELS, huStatus, monthYear, type OwnedCarDto } from '@kaufcheck/shared';
import { useQuery } from '@tanstack/react-query';
import { CalendarPlus, Pencil, Trash2 } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '../../components/ui/Button';
import { formatNumber } from '../../lib/format';
import { RecallCheck } from '../recalls/RecallCheck';
import { ModelKnowledgeView } from '../search/ModelInsights';
import { taxCalculatorLink } from '../tax/tax-link';
import { carHuCalendarFile, carTitle } from './car';

function downloadCalendar(car: OwnedCarDto, hu: { year: number; month: number }) {
  const blob = new Blob([carHuCalendarFile(car, hu, new Date())], {
    type: 'text/calendar;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `hu-${hu.year}-${String(hu.month).padStart(2, '0')}.ics`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

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
  if (!knowledge.data) return null;
  const year = car.firstRegistration.year;
  return (
    <>
      <ModelKnowledgeView
        model={knowledge.data}
        yearMin={year}
        yearMax={year}
        initialGenerationId={car.generationId}
        generationHeading="h3"
        compact
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
  const title = carTitle(car);
  const hu = car.huUntil ? huStatus(car.huUntil, now) : null;
  const headingId = `car-${car.id}-title`;

  return (
    <article className="car-card" aria-labelledby={headingId}>
      <header className="car-card__header">
        <div>
          <h2 id={headingId} className="car-card__title">
            {car.nickname ?? title}
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
            Bearbeiten
          </Button>
          <Button
            variant="quiet"
            size="sm"
            icon={<Trash2 aria-hidden size={16} />}
            onClick={onDelete}
          >
            Löschen
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

      <section className="car-card__section" aria-labelledby={`${headingId}-hu`}>
        <h3 id={`${headingId}-hu`}>Hauptuntersuchung</h3>
        {car.huUntil && hu ? (
          <>
            <p className={`car-card__hu car-card__hu--${hu.tone}`}>{hu.text}</p>
            {hu.tone === 'overdue' && (
              <p className="muted">
                Vereinbare bald einen Termin. Ist die HU mehr als zwei Monate überzogen, wird eine
                teurere Ergänzungsuntersuchung fällig.
              </p>
            )}
            <Button
              variant="secondary"
              size="sm"
              icon={<CalendarPlus aria-hidden size={16} />}
              onClick={() => downloadCalendar(car, car.huUntil!)}
            >
              HU-Termin in den Kalender
            </Button>
            <p className="muted car-card__note">
              Der Kalendereintrag erinnert dich vier Wochen vorher – in deinem eigenen Kalender.
            </p>
          </>
        ) : (
          <p className="muted">
            Trag Monat und Jahr von der Prüfplakette ein, dann siehst du hier, wann die nächste HU
            fällig ist.
          </p>
        )}
      </section>

      <section className="car-card__section" aria-labelledby={`${headingId}-issues`}>
        <h3 id={`${headingId}-issues`}>Bekannte Schwachstellen</h3>
        <Knowledge car={car} />
      </section>

      <section className="car-card__section" aria-labelledby={`${headingId}-recalls`}>
        <h3 id={`${headingId}-recalls`}>Rückrufe</h3>
        <RecallCheck makeId={car.makeId} placement="my_car" />
      </section>

      <section className="car-card__section" aria-labelledby={`${headingId}-costs`}>
        <h3 id={`${headingId}-costs`}>Kosten</h3>
        <p>
          <Link to={taxCalculatorLink(car)}>Kfz-Steuer und laufende Kosten berechnen</Link>
        </p>
      </section>
    </article>
  );
}
