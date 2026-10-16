import {
  CAR_LOG_KIND_LABELS,
  carLogCsv,
  carLogSummary,
  formatCents,
  QUANTITY_UNITS,
  SERVICE_LOG_KINDS,
  type CarLogEntryDto,
  type CarLogEntryInput,
} from '@kaufcheck/shared';
import { Download, FileText, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ApiRequestError } from '../../api/client';
import {
  useCarLog,
  useDeleteCarLogEntry,
  useMe,
  useOwnedCars,
  useSaveCarLogEntry,
} from '../../api/queries';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { SelectField } from '../../components/ui/Field';
import { PageLoading } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/toast-context';
import { track } from '../../lib/analytics';
import { downloadTextFile } from '../../lib/download';
import { formatNumber } from '../../lib/format';
import { appPageMeta } from '../../seo/pages';
import { usePageMeta } from '../../seo/use-page-meta';
import { carName, carTitle } from '../my-car/car';
import { emptyEntry, formFromEntry, localDay } from './entry-form';
import { EntryForm, type EntryFormError } from './EntryForm';

const META = appPageMeta('Kostenbuch');
const PAGE_TITLE_ID = 'car-log-title';
const FORM_TITLE_ID = 'car-log-form-title';
const entryId = (id: string) => `entry-${id}`;

type Filter = 'all' | 'service' | 'energy' | 'costs';
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Alle Einträge' },
  { value: 'service', label: 'Serviceheft: Wartung, Reparaturen, Reifen, HU' },
  { value: 'energy', label: 'Tanken und Laden' },
  { value: 'costs', label: 'Andere Kosten' },
];

function matches(entry: CarLogEntryDto, filter: Filter): boolean {
  if (filter === 'service') return SERVICE_LOG_KINDS.has(entry.kind);
  if (filter === 'energy') return entry.kind === 'fuel' || entry.kind === 'charging';
  if (filter === 'costs')
    return !SERVICE_LOG_KINDS.has(entry.kind) && entry.kind !== 'fuel' && entry.kind !== 'charging';
  return true;
}

function formError(error: unknown): EntryFormError | null {
  if (!error) return null;
  if (error instanceof ApiRequestError) {
    const fields = error.details?.fieldErrors ?? {};
    const map: Record<string, EntryFormError['field']> = {
      date: 'date',
      odometerKm: 'odometerKm',
      amountCents: 'amount',
      quantity: 'quantity',
      workshop: 'workshop',
      note: 'note',
    };
    for (const [key, messages] of Object.entries(fields)) {
      const field = map[key];
      if (field) return { field, message: messages[0] ?? error.message };
    }
    return { field: null, message: error.message };
  }
  return { field: null, message: 'Das hat nicht geklappt. Bitte versuch es noch einmal.' };
}

const germanDate = (date: string) => date.split('-').reverse().join('.');
const decimal = (value: number) => value.toLocaleString('de-DE', { maximumFractionDigits: 2 });

function Summary({ entries, today }: { entries: CarLogEntryDto[]; today: string }) {
  const summary = useMemo(() => carLogSummary(entries, today), [entries, today]);
  const costs = summary.months > 0;
  const fuel = summary.fuelPer100Km !== null;
  if (!costs && !fuel && summary.yearKm === null) return null;
  return (
    <section className="card car-log__summary" aria-labelledby="car-log-summary-title">
      <h2 id="car-log-summary-title">Auswertung</h2>
      {(costs || summary.yearKm !== null) && (
        <>
          <h3 className="car-log__summary-period">
            {summary.months >= 12 || !costs
              ? 'Die letzten 12 Monate'
              : `Seit deiner ersten Ausgabe (${summary.months === 1 ? '1 Monat' : `${summary.months} Monate`})`}
          </h3>
          <dl className="definition-list">
            {costs && (
              <>
                <div>
                  <dt>Kosten</dt>
                  <dd>{formatCents(summary.yearCents)}</dd>
                </div>
                <div>
                  <dt>Im Monat</dt>
                  <dd>{formatCents(Math.round(summary.yearCents / summary.months))}</dd>
                </div>
              </>
            )}
            {summary.yearKm !== null && (
              <div>
                <dt>Gefahren laut deinen Einträgen</dt>
                <dd>
                  {formatNumber(summary.yearKm)} km
                  {summary.centsPerKm !== null && (
                    <>, also {formatCents(summary.centsPerKm)} je km</>
                  )}
                </dd>
              </div>
            )}
          </dl>
          {summary.byKind.length > 0 && (
            <table className="car-log__kinds">
              <caption className="visually-hidden">Kosten nach Art</caption>
              <tbody>
                {summary.byKind.map((item) => (
                  <tr key={item.kind}>
                    <th scope="row">{CAR_LOG_KIND_LABELS[item.kind]}</th>
                    <td>{formatCents(item.cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
      {summary.fuelSkipped > 0 && (
        <p className="muted">
          {summary.fuelSkipped === 1
            ? 'Eine Strecke zwischen vollen Tankungen'
            : `${summary.fuelSkipped} Strecken zwischen vollen Tankungen`}{' '}
          ergäbe einen unrealistischen Verbrauch und zählt nicht mit. Prüf dort Liter und
          Kilometerstände.
        </p>
      )}
      {fuel && (
        <>
          <h3 className="car-log__summary-period">Verbrauch aus allen Einträgen</h3>
          <dl className="definition-list">
            <div>
              <dt>Kraftstoff</dt>
              <dd>
                {decimal(summary.fuelPer100Km!)} l/100 km{' '}
                <span className="muted">
                  (aus{' '}
                  {summary.fuelIntervals === 1
                    ? 'einer Strecke'
                    : `${summary.fuelIntervals} Strecken`}{' '}
                  zwischen vollen Tankungen)
                </span>
              </dd>
            </div>
            {summary.fuelCentsPer100Km !== null && (
              <div>
                <dt>Kraftstoffkosten</dt>
                <dd>{formatCents(summary.fuelCentsPer100Km)} je 100 km</dd>
              </div>
            )}
          </dl>
        </>
      )}
      <p className="muted car-log__note">
        Gezählt wird, was du eingetragen hast. Kosten je km: Kosten geteilt durch die Strecke
        zwischen dem niedrigsten und dem höchsten Kilometerstand, je Tag gerechnet – erst, wenn
        deine Kilometerstände mindestens ein halbes Jahr auseinanderliegen.
      </p>
    </section>
  );
}

function EntryItem({
  entry,
  editable,
  onEdit,
  onDelete,
}: {
  entry: CarLogEntryDto;
  editable: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const unit = QUANTITY_UNITS[entry.kind];
  const label = `${CAR_LOG_KIND_LABELS[entry.kind]} am ${germanDate(entry.date)}`;
  const details = [
    entry.odometerKm !== null ? `${formatNumber(entry.odometerKm)} km` : null,
    unit && entry.quantity !== null ? `${decimal(entry.quantity)} ${unit}` : null,
    entry.kind === 'fuel' && entry.quantity && entry.amountCents
      ? `${formatCents(Math.round(entry.amountCents / entry.quantity))}/l`
      : null,
    entry.kind === 'fuel' && entry.quantity !== null && !entry.fullTank
      ? 'nicht vollgetankt'
      : null,
    entry.kind === 'fuel' && entry.missedBefore ? 'Tankung davor nicht eingetragen' : null,
    entry.workshop,
    entry.invoice ? 'Rechnung oder Beleg vorhanden' : null,
  ].filter(Boolean);
  return (
    <li className="car-log__entry">
      <div className="car-log__entry-main">
        <h3 id={entryId(entry.id)} tabIndex={-1} className="car-log__entry-title">
          {label}
        </h3>
        {entry.amountCents !== null && (
          <span className="car-log__amount">{formatCents(entry.amountCents)}</span>
        )}
      </div>
      {details.length > 0 && <p className="muted">{details.join(' · ')}</p>}
      {entry.note && <p className="car-log__entry-note">{entry.note}</p>}
      <div className="button-row">
        {editable && (
          <Button
            variant="quiet"
            size="sm"
            icon={<Pencil aria-hidden size={16} />}
            onClick={onEdit}
          >
            Bearbeiten<span className="visually-hidden">: {label}</span>
          </Button>
        )}
        <Button
          variant="quiet"
          size="sm"
          icon={<Trash2 aria-hidden size={16} />}
          onClick={onDelete}
        >
          Löschen<span className="visually-hidden">: {label}</span>
        </Button>
      </div>
    </li>
  );
}

/** Kostenbuch and self-kept service history of one car (Pro). */
export function CarLogPage() {
  usePageMeta(META);
  const { id = '' } = useParams();
  const toast = useToast();
  const me = useMe();
  const signedIn = Boolean(me.data?.user);
  const cars = useOwnedCars(signedIn);
  const car = cars.data?.items.find((item) => item.id === id);
  const log = useCarLog(id, car !== undefined);
  const save = useSaveCarLogEntry(id);
  const remove = useDeleteCarLogEntry(id);
  const [form, setForm] = useState<{ entry: CarLogEntryDto | null } | null>(null);
  const [deleting, setDeleting] = useState<CarLogEntryDto | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [pdfBusy, setPdfBusy] = useState(false);
  // Taken again when the form opens: the page may stay open past midnight.
  const [today, setToday] = useState(() => localDay(new Date()));
  const saveError = useMemo(() => formError(save.error), [save.error]);

  const focusNext = useRef<string | null>(null);
  useEffect(() => {
    if (!focusNext.current) return;
    document.getElementById(focusNext.current)?.focus();
    focusNext.current = null;
  });

  if (me.isPending || (signedIn && cars.isPending)) return <PageLoading />;
  if (!signedIn)
    return (
      <div className="container page">
        <h1>Kostenbuch</h1>
        <p>
          Melde dich an, um das Kostenbuch deines Autos zu sehen.{' '}
          <Link to="/anmelden" state={{ returnTo: `/mein-auto/${id}/kostenbuch` }}>
            Anmelden
          </Link>
        </p>
      </div>
    );
  if (!car)
    return (
      <div className="container page">
        <h1>Kostenbuch</h1>
        <p>
          {cars.isError
            ? 'Deine Autos konnten nicht geladen werden.'
            : 'Dieses Auto gibt es nicht.'}{' '}
          <Link to="/mein-auto">Zu „Mein Auto“</Link>
        </p>
      </div>
    );

  const entries = log.data?.items ?? [];
  // For the file names: which car, with ten cars in Pro.
  const slug =
    carTitle(car)
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'auto';
  const editable = log.data?.editable ?? false;
  const shown = entries.filter((entry) => matches(entry, filter));
  const full = entries.length >= (log.data?.limit ?? Infinity);

  const submit = (input: CarLogEntryInput) => {
    const editing = form?.entry ?? null;
    save.mutate(
      { id: editing?.id ?? null, input },
      {
        onSuccess: (saved) => {
          toast.show(editing ? 'Eintrag gespeichert' : 'Eintrag hinzugefügt');
          setForm(null);
          // So that the saved entry is shown, whatever the filter.
          setFilter('all');
          focusNext.current = entryId(saved.id);
        },
        onError: (error) => {
          if (error instanceof ApiRequestError && error.code === 'NOT_FOUND') void log.refetch();
        },
      },
    );
  };

  const confirmDelete = () => {
    if (!deleting) return;
    remove.mutate(deleting.id, {
      onSuccess: () => {
        toast.show('Eintrag gelöscht');
        setDeleting(null);
        if (form?.entry?.id === deleting.id) setForm(null);
        focusNext.current = PAGE_TITLE_ID;
      },
      onError: (error) => {
        if (error instanceof ApiRequestError && error.code === 'NOT_FOUND') void log.refetch();
        toast.show(formError(error)?.message ?? '');
      },
    });
  };

  const exportCsv = () =>
    downloadTextFile(
      `kostenbuch-${slug}-${today}.csv`,
      carLogCsv(entries),
      'text/csv;charset=utf-8',
    );

  const exportPdf = async () => {
    setPdfBusy(true);
    try {
      const [{ buildServiceHistoryPdf }, fonts] = await Promise.all([
        import('./service-pdf'),
        import('../sale-contract/fonts').then((module) => module.loadContractFonts()),
      ]);
      buildServiceHistoryPdf(
        { title: carTitle(car), firstRegistration: car.firstRegistration },
        entries,
        fonts,
        new Date(),
      ).save(`serviceheft-${slug}-${today}.pdf`);
      track('service_history_pdf_downloaded');
    } catch (error) {
      console.error('Service history PDF failed', error);
      toast.show(
        'Das PDF konnte nicht erstellt werden. Prüf deine Verbindung und versuch es noch einmal.',
      );
    } finally {
      setPdfBusy(false);
    }
  };

  const openForm = (entry: CarLogEntryDto | null) => {
    save.reset();
    setToday(localDay(new Date()));
    setForm({ entry });
    focusNext.current = FORM_TITLE_ID;
  };

  return (
    <div className="container page car-log">
      <nav className="breadcrumbs" aria-label="Brotkrümelnavigation">
        <ol>
          <li>
            <Link to="/mein-auto">Mein Auto</Link>
          </li>
          <li>
            <span aria-current="page">Kostenbuch</span>
          </li>
        </ol>
      </nav>
      <div className="page__header">
        <div>
          <h1 id={PAGE_TITLE_ID} tabIndex={-1}>
            Kostenbuch: {carName(car)}
          </h1>
          <p className="page__lead">
            Halte Tankungen, Wartung, Reparaturen und andere Kosten fest. Einträge zu Wartung,
            Reparaturen, Reifen und HU/AU ergeben dein selbst geführtes Serviceheft. Es ersetzt
            weder Rechnungen noch das Serviceheft des Herstellers.
          </p>
        </div>
      </div>

      {log.isPending ? (
        <PageLoading />
      ) : log.isError ? (
        <Alert
          tone="error"
          title="Das Kostenbuch konnte nicht geladen werden"
          actions={<Button onClick={() => void log.refetch()}>Erneut versuchen</Button>}
        />
      ) : (
        <>
          {!editable && (
            <Alert tone="info" title="Das Kostenbuch gehört zu KaufCheck Pro">
              <p>
                {entries.length > 0
                  ? 'Deine Einträge bleiben: Du kannst sie ansehen, exportieren und löschen. Neue Einträge legst du mit Pro an.'
                  : 'Mit Pro hältst du Kosten und Wartung deines Autos fest, siehst, was es dich im Monat kostet, und erstellst ein Serviceheft für den Verkauf.'}
              </p>
              <p>
                <Link to="/pro" onClick={() => track('pro_clicked', { placement: 'car_log' })}>
                  KaufCheck Pro ansehen
                </Link>
              </p>
            </Alert>
          )}

          <Summary entries={entries} today={today} />

          {form ? (
            <section className="card" aria-labelledby={FORM_TITLE_ID}>
              <h2 id={FORM_TITLE_ID} tabIndex={-1}>
                {form.entry ? 'Eintrag bearbeiten' : 'Eintrag hinzufügen'}
              </h2>
              <EntryForm
                key={form.entry?.id ?? 'new'}
                initial={form.entry ? formFromEntry(form.entry) : emptyEntry(today)}
                today={today}
                entries={entries}
                firstRegistration={car.firstRegistration}
                editingId={form.entry?.id ?? null}
                submitLabel={form.entry ? 'Speichern' : 'Hinzufügen'}
                busy={save.isPending}
                serverError={saveError}
                onChange={() => {
                  if (save.error) save.reset();
                }}
                onSubmit={submit}
                onCancel={() => {
                  const back = form.entry ? entryId(form.entry.id) : PAGE_TITLE_ID;
                  setForm(null);
                  focusNext.current = back;
                }}
              />
            </section>
          ) : (
            <div className="button-row no-print">
              {editable && !full && (
                <Button icon={<Plus aria-hidden size={18} />} onClick={() => openForm(null)}>
                  Eintrag hinzufügen
                </Button>
              )}
              {entries.length > 0 && (
                <>
                  <Button
                    variant="secondary"
                    icon={<Download aria-hidden size={18} />}
                    onClick={exportCsv}
                  >
                    Als CSV exportieren
                  </Button>
                  <Button
                    variant="secondary"
                    icon={<FileText aria-hidden size={18} />}
                    loading={pdfBusy}
                    onClick={() => void exportPdf()}
                  >
                    Serviceheft als PDF
                  </Button>
                </>
              )}
            </div>
          )}
          {entries.length > 0 && !form && (
            <p className="muted car-log__note">
              Das Serviceheft als PDF ist kein Wartungsnachweis. Gib es nur weiter, wenn alle
              Einträge stimmen: Was darin steht, kann als vereinbart gelten – auch wenn du die
              Gewährleistung ausschließt. „Scheckheftgepflegt“ schreibst du nur, wenn alle Wartungen
              nach Herstellervorgabe im Serviceheft des Herstellers oder digital eingetragen sind,
              „Serviceheft vorhanden“ nur, wenn du dieses Heft hast.
            </p>
          )}
          {full && editable && (
            <p className="muted">
              Das Kostenbuch ist voll ({formatNumber(entries.length)} Einträge). Lösche ältere
              Einträge, um neue anzulegen.
            </p>
          )}

          {entries.length > 0 ? (
            <section aria-labelledby="car-log-entries-title">
              <div className="car-log__list-header">
                <h2 id="car-log-entries-title">Einträge</h2>
                <SelectField
                  label="Anzeigen"
                  value={filter}
                  onChange={(event) => setFilter(event.target.value as Filter)}
                >
                  {FILTERS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </SelectField>
              </div>
              {shown.length > 0 ? (
                <ul className="car-log__entries">
                  {shown.map((entry) => (
                    <EntryItem
                      key={entry.id}
                      entry={entry}
                      editable={editable}
                      onEdit={() => openForm(entry)}
                      onDelete={() => setDeleting(entry)}
                    />
                  ))}
                </ul>
              ) : (
                <p className="muted">Keine Einträge dieser Art.</p>
              )}
            </section>
          ) : (
            editable && (
              <p className="muted">
                Noch keine Einträge. Fang mit der nächsten Tankung oder der letzten Inspektion an.
              </p>
            )
          )}
        </>
      )}

      <Dialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Eintrag löschen?"
        footer={
          <>
            <Button variant="danger" loading={remove.isPending} onClick={confirmDelete}>
              Löschen
            </Button>
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              Abbrechen
            </Button>
          </>
        }
      >
        <p>
          {deleting
            ? `${CAR_LOG_KIND_LABELS[deleting.kind]} am ${germanDate(deleting.date)} wird gelöscht.`
            : ''}{' '}
          Das lässt sich nicht rückgängig machen.
        </p>
      </Dialog>
      <p className="muted car-log__note">
        Gespeichert wird nur, was du einträgst. Löschst du das Auto unter{' '}
        <Link to="/mein-auto">„Mein Auto“</Link> oder dein Konto, löscht KaufCheck auch das
        Kostenbuch.
      </p>
    </div>
  );
}
