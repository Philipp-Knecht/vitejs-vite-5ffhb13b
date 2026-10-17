import type { OwnedCarDto, OwnedCarInput } from '@kaufcheck/shared';
import { Plus } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { ApiRequestError } from '../../api/client';
import {
  useAddOwnedCar,
  useAnalysis,
  useDeleteOwnedCar,
  useMe,
  useOwnedCars,
  useUpdateOwnedCar,
} from '../../api/queries';
import { Alert } from '../../components/ui/Alert';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { PageLoading } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/toast-context';
import { track } from '../../lib/analytics';
import { appPageMeta } from '../../seo/pages';
import { usePageMeta } from '../../seo/use-page-meta';
import {
  carHeadingId,
  carName,
  EMPTY_CAR_FORM,
  formErrorFromServer,
  formFromCar,
  formFromListing,
  type CarFormError,
} from './car';
import { CarCard } from './CarCard';
import { CarForm } from './CarForm';

const META = appPageMeta('Mein Auto');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE_TITLE_ID = 'my-car-title';
const ADD_TITLE_ID = 'add-car-title';
const editTitleId = (id: string) => `car-${id}-edit`;

function formError(error: unknown): CarFormError | null {
  if (!error) return null;
  if (error instanceof ApiRequestError)
    return formErrorFromServer(error.message, error.details?.fieldErrors);
  return { field: null, message: 'Das hat nicht geklappt. Bitte versuch es noch einmal.' };
}

function SignedOut() {
  const location = useLocation();
  const returnTo = `${location.pathname}${location.search}`;
  return (
    <div className="empty-state">
      <h2>Dein Auto im Blick</h2>
      <p>
        Leg dein Auto mit einem kostenlosen Konto an: Du siehst, wann die nächste HU fällig ist,
        welche Schwachstellen für deine Modellgeneration bekannt sind und wie du Rückrufe prüfst.
      </p>
      <div className="button-row">
        <ButtonLink to="/registrieren" state={{ returnTo }}>
          Kostenloses Konto erstellen
        </ButtonLink>
        <ButtonLink to="/anmelden" state={{ returnTo }} variant="secondary">
          Anmelden
        </ButtonLink>
      </div>
    </div>
  );
}

/** The form for a new car, prefilled from a check when the page is opened with ?analyse=<id>. */
function AddCar({
  analysisId,
  onAdded,
  onCancel,
}: {
  analysisId: string | null;
  onAdded: (car: OwnedCarDto) => void;
  onCancel?: () => void;
}) {
  const toast = useToast();
  const add = useAddOwnedCar();
  const analysis = useAnalysis(analysisId ?? '', analysisId !== null);
  // Stable per error, so that the form moves the focus only for a new one.
  const addError = useMemo(() => formError(add.error), [add.error]);

  if (analysisId && analysis.isPending) return <PageLoading label="Angaben aus der Prüfung …" />;
  const vehicle = analysis.data?.listing.vehicle ?? null;
  const initial = vehicle ? formFromListing(vehicle) : EMPTY_CAR_FORM;

  const submit = (input: OwnedCarInput) =>
    add.mutate(input, {
      onSuccess: (car) => {
        toast.show(`${carName(car)} angelegt`);
        onAdded(car);
      },
    });

  return (
    <section className="card my-car__add" aria-labelledby={ADD_TITLE_ID}>
      <h2 id={ADD_TITLE_ID} tabIndex={-1}>
        Auto anlegen
      </h2>
      {vehicle ? (
        <p className="muted">
          Vorausgefüllt mit den Angaben aus dem Inserat – prüf sie mit dem Fahrzeugschein.
        </p>
      ) : (
        analysis.isError && (
          <p className="muted">
            Die Prüfung konnte nicht geladen werden. Trag die Angaben bitte selbst ein.
          </p>
        )
      )}
      <CarForm
        key={analysis.data?.id ?? 'empty'}
        initial={initial}
        submitLabel="Auto anlegen"
        busy={add.isPending}
        serverError={addError}
        onSubmit={submit}
        onCancel={onCancel}
      />
    </section>
  );
}

/** „Mein Auto“: the cars the user owns, with the next HU, known weaknesses, recalls and costs. */
export function MyCarPage() {
  usePageMeta(META);
  const toast = useToast();
  const me = useMe();
  const signedIn = Boolean(me.data?.user);
  const cars = useOwnedCars(signedIn);
  const update = useUpdateOwnedCar();
  const remove = useDeleteOwnedCar();
  const [params, setParams] = useSearchParams();
  const param = params.get('analyse');
  const analysisId = param && UUID.test(param) ? param : null;
  const [adding, setAdding] = useState(analysisId !== null);
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<OwnedCarDto | null>(null);
  const now = useMemo(() => new Date(), []);
  const updateError = useMemo(() => formError(update.error), [update.error]);

  // In-place changes remove the focused element; the focus moves to the matching heading.
  const focusNext = useRef<string | null>(null);
  useEffect(() => {
    if (!focusNext.current) return;
    document.getElementById(focusNext.current)?.focus();
    focusNext.current = null;
  });
  const moveFocus = (id: string) => {
    focusNext.current = id;
  };

  if (me.isPending) return <PageLoading />;
  const items = cars.data?.items ?? [];
  const limit = cars.data?.limit ?? 0;
  const full = items.length >= limit;

  const closeForm = () => {
    setAdding(false);
    if (param !== null) setParams({}, { replace: true });
  };

  const refetchIfGone = (error: unknown) => {
    if (error instanceof ApiRequestError && error.code === 'NOT_FOUND') void cars.refetch();
  };

  const save = (car: OwnedCarDto, input: OwnedCarInput) =>
    update.mutate(
      { id: car.id, input },
      {
        onSuccess: () => {
          setEditing(null);
          moveFocus(carHeadingId(car.id));
          toast.show('Änderungen gespeichert');
        },
        onError: refetchIfGone,
      },
    );

  const confirmDelete = () => {
    if (!deleting) return;
    const index = items.findIndex((item) => item.id === deleting.id);
    const next = items[index + 1] ?? items[index - 1];
    remove.mutate(deleting.id, {
      onSuccess: () => {
        toast.show(`${carName(deleting)} gelöscht`);
        setDeleting(null);
        moveFocus(next ? carHeadingId(next.id) : PAGE_TITLE_ID);
      },
      onError: (error) => {
        refetchIfGone(error);
        toast.show(formError(error)?.message ?? '');
      },
    });
  };

  return (
    <div className="container page my-car">
      <div className="page__header">
        <div>
          <h1 id={PAGE_TITLE_ID} tabIndex={-1}>
            Mein Auto
          </h1>
          <p className="page__lead">
            Nächste HU, bekannte Schwachstellen, Rückrufe und Kosten. Gespeichert wird nur, was du
            einträgst – keine FIN und kein Kennzeichen.
          </p>
        </div>
      </div>

      {!signedIn ? (
        <SignedOut />
      ) : cars.isPending ? (
        <PageLoading />
      ) : cars.isError ? (
        <Alert
          tone="error"
          title="Deine Autos konnten nicht geladen werden"
          actions={<Button onClick={() => void cars.refetch()}>Erneut versuchen</Button>}
        />
      ) : (
        <>
          {items.map((car) =>
            editing === car.id ? (
              <section key={car.id} className="card" aria-labelledby={editTitleId(car.id)}>
                <h2 id={editTitleId(car.id)} tabIndex={-1}>
                  {carName(car)} bearbeiten
                </h2>
                <CarForm
                  initial={formFromCar(car)}
                  submitLabel="Speichern"
                  busy={update.isPending}
                  serverError={updateError}
                  onSubmit={(input) => save(car, input)}
                  onCancel={() => {
                    update.reset();
                    setEditing(null);
                    moveFocus(carHeadingId(car.id));
                  }}
                />
              </section>
            ) : (
              <CarCard
                key={car.id}
                car={car}
                now={now}
                onEdit={() => {
                  update.reset();
                  setEditing(car.id);
                  moveFocus(editTitleId(car.id));
                }}
                onDelete={() => setDeleting(car)}
              />
            ),
          )}

          {full ? (
            <p className="my-car__limit">
              {analysisId &&
                'Um das Auto aus der Prüfung zu übernehmen, lösch zuerst ein angelegtes Auto – danach ist das Formular vorausgefüllt. '}
              {limit <= 1 ? (
                <>
                  Mit dem kostenlosen Konto kannst du ein Auto anlegen. Für mehrere Autos gibt es{' '}
                  <Link to="/pro" onClick={() => track('pro_clicked', { placement: 'my_car' })}>
                    KaufCheck Pro
                  </Link>
                  .
                </>
              ) : (
                `Du hast alle ${limit} Plätze belegt. Lösche ein Auto, um ein anderes anzulegen.`
              )}
            </p>
          ) : items.length === 0 || adding ? (
            <AddCar
              analysisId={analysisId}
              onAdded={(car) => {
                closeForm();
                moveFocus(carHeadingId(car.id));
              }}
              onCancel={
                items.length > 0
                  ? () => {
                      closeForm();
                      moveFocus(PAGE_TITLE_ID);
                    }
                  : undefined
              }
            />
          ) : (
            <div className="no-print">
              <Button
                variant="secondary"
                icon={<Plus aria-hidden size={18} />}
                onClick={() => {
                  setAdding(true);
                  moveFocus(ADD_TITLE_ID);
                }}
              >
                Weiteres Auto anlegen
              </Button>
            </div>
          )}
        </>
      )}

      <Dialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Auto löschen?"
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
          {deleting ? carName(deleting) : ''} und alle Angaben dazu werden gelöscht, auch das
          Kostenbuch – exportiere es vorher, wenn du es behalten willst. Das lässt sich nicht
          rückgängig machen.
        </p>
      </Dialog>
    </div>
  );
}
