import type { OwnedCarDto, OwnedCarInput } from '@kaufcheck/shared';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
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
import { carTitle, EMPTY_CAR_FORM, formFromCar, formFromListing } from './car';
import { CarCard } from './CarCard';
import { CarForm } from './CarForm';

const META = appPageMeta('Mein Auto');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const errorText = (error: unknown) =>
  error instanceof ApiRequestError
    ? error.message
    : 'Das hat nicht geklappt. Bitte versuch es noch einmal.';

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
  onDone,
  onCancel,
}: {
  analysisId: string | null;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const toast = useToast();
  const add = useAddOwnedCar();
  const analysis = useAnalysis(analysisId ?? '', analysisId !== null);

  if (analysisId && analysis.isPending) return <PageLoading label="Angaben aus der Prüfung …" />;
  const initial = analysis.data ? formFromListing(analysis.data.listing.vehicle) : EMPTY_CAR_FORM;

  const submit = (input: OwnedCarInput) =>
    add.mutate(input, {
      onSuccess: (car) => {
        toast.show(`${carTitle(car)} angelegt`);
        onDone();
      },
    });

  return (
    <section className="card my-car__add" aria-labelledby="add-car-title">
      <h2 id="add-car-title">Auto anlegen</h2>
      {analysis.data && (
        <p className="muted">
          Vorausgefüllt mit den Angaben aus dem Inserat – prüf sie mit dem Fahrzeugschein.
        </p>
      )}
      <CarForm
        key={analysis.data?.id ?? 'empty'}
        initial={initial}
        submitLabel="Auto anlegen"
        busy={add.isPending}
        serverError={add.isError ? errorText(add.error) : null}
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

  if (me.isPending) return <PageLoading />;
  const items = cars.data?.items ?? [];
  const limit = cars.data?.limit ?? 0;
  const full = items.length >= limit;

  const closeForm = () => {
    setAdding(false);
    if (param !== null) setParams({}, { replace: true });
  };

  const save = (car: OwnedCarDto, input: OwnedCarInput) =>
    update.mutate(
      { id: car.id, input },
      {
        onSuccess: () => {
          setEditing(null);
          toast.show('Änderungen gespeichert');
        },
      },
    );

  const confirmDelete = () => {
    if (!deleting) return;
    remove.mutate(deleting.id, {
      onSuccess: () => {
        toast.show(`${carTitle(deleting)} gelöscht`);
        setDeleting(null);
      },
      onError: (error) => toast.show(errorText(error)),
    });
  };

  return (
    <div className="container page my-car">
      <div className="page__header">
        <div>
          <h1>Mein Auto</h1>
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
              <section key={car.id} className="card" aria-label={`${carTitle(car)} bearbeiten`}>
                <CarForm
                  initial={formFromCar(car)}
                  submitLabel="Speichern"
                  busy={update.isPending}
                  serverError={update.isError ? errorText(update.error) : null}
                  onSubmit={(input) => save(car, input)}
                  onCancel={() => {
                    update.reset();
                    setEditing(null);
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
                }}
                onDelete={() => setDeleting(car)}
              />
            ),
          )}

          {full ? (
            <p className="my-car__limit">
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
              onDone={closeForm}
              onCancel={items.length > 0 ? closeForm : undefined}
            />
          ) : (
            <Button
              variant="secondary"
              icon={<Plus aria-hidden size={18} />}
              onClick={() => setAdding(true)}
            >
              Weiteres Auto anlegen
            </Button>
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
          {deleting ? carTitle(deleting) : ''} und alle Angaben dazu werden gelöscht. Das lässt sich
          nicht rückgängig machen.
        </p>
      </Dialog>
    </div>
  );
}
