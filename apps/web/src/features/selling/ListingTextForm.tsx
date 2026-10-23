import {
  FUEL_LABELS,
  FUEL_TYPES,
  linkedPower,
  LISTING_LIMITS,
  LISTING_STATEMENT_TEXTS,
  LISTING_STATEMENTS,
  LISTING_TITLE_MAX,
  listingDescription,
  listingTitle,
  SERVICE_HISTORY_TEXTS,
  SMOKING_TEXTS,
  TRANSMISSION_LABELS,
  TRANSMISSION_TYPES,
  validateListingText,
  type ContractAnswer,
  type FuelType,
  type ListingTextErrors,
  type ListingTextField,
  type ListingTextValues,
  type TransmissionType,
} from '@kaufcheck/shared';
import { Copy, FileText } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useMe } from '../../api/queries';
import { Alert } from '../../components/ui/Alert';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { SelectField, TextAreaField, TextField } from '../../components/ui/Field';
import { useToast } from '../../components/ui/toast-context';
import { track } from '../../lib/analytics';
import { copyText } from '../../lib/clipboard';
import { RadioGroup } from '../sale-contract/SaleContractForm';
import { keepListingTextDraft, readListingTextDraft } from './draft';

const EV_FUELS: ReadonlySet<string> = new Set(['electric', 'plugin_hybrid']);
const ANSWER_ORDER: Exclude<ContractAnswer, ''>[] = ['yes', 'no', 'unknown'];
const ANSWER_LABELS = { yes: 'Ja', no: 'Nein', unknown: 'Weiß ich nicht' } as const;
const NO_STATEMENT = 'Keine Angabe im Inserat';
const RESULT_TITLE_ID = 'listing-text-result';

/**
 * The listing text for selling one's own car. What is typed stays in this
 * browser tab; the text is built on the device (Pro).
 */
export function ListingTextForm({
  initial,
  source,
}: {
  initial: ListingTextValues;
  /** The car from „Mein Auto“ the form was prefilled from, or empty. */
  source: string;
}) {
  const me = useMe();
  const toast = useToast();
  const [restored] = useState(() => readListingTextDraft(source));
  const [values, setValues] = useState(restored?.values ?? initial);
  // A text shown again after a link within the app shows its errors, too.
  const [submitted, setSubmitted] = useState(restored?.created ?? false);
  const [created, setCreated] = useState(restored?.created ?? false);
  const [busy, setBusy] = useState(false);
  const [upsell, setUpsell] = useState(false);
  const [typed, setTyped] = useState(restored !== null);
  const form = useRef<HTMLFormElement>(null);
  const result = useRef<HTMLHeadingElement>(null);
  const isPro = me.data?.entitlements.listingText ?? false;
  const errors: ListingTextErrors = useMemo(
    () => (submitted ? validateListingText(values) : {}),
    [submitted, values],
  );
  const hasErrors = Object.keys(errors).length > 0;

  useEffect(() => {
    // Also a text created from the prefill alone, without typing: the contract takes it over.
    if (typed || created) keepListingTextDraft({ source, values, created });
  }, [typed, created, source, values]);

  useEffect(() => {
    if (!typed) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [typed]);

  const update = (change: Partial<ListingTextValues>) => {
    setTyped(true);
    setValues((current) => ({ ...current, ...change }));
  };
  const errorFor = (field: ListingTextField) => errors[field];
  const text = (key: Exclude<ListingTextField, `details.${string}`>) => ({
    value: values[key],
    onChange: (event: { target: { value: string } }) => update({ [key]: event.target.value }),
    error: errorFor(key),
  });
  const electric = EV_FUELS.has(values.fuel);

  // Once created, the text follows the input.
  const title = useMemo(() => listingTitle(values), [values]);
  const description = useMemo(() => listingDescription(values), [values]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (Object.keys(validateListingText(values)).length > 0) {
      requestAnimationFrame(() =>
        form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
      return;
    }
    if (!me.data) {
      toast.show(
        me.isError
          ? 'Dein Konto konnte nicht geladen werden. Bitte lade die Seite neu.'
          : 'Dein Konto wird noch geladen. Bitte versuch es gleich noch einmal.',
      );
      return;
    }
    setBusy(true);
    try {
      if (!isPro) {
        const fresh = await me.refetch();
        if (fresh.isError) {
          toast.show('Dein Konto konnte nicht geladen werden. Bitte versuch es noch einmal.');
          return;
        }
        if (!fresh.data?.entitlements.listingText) {
          setUpsell(true);
          return;
        }
      }
      if (!created) track('listing_text_created');
      setCreated(true);
      requestAnimationFrame(() => result.current?.focus());
    } finally {
      setBusy(false);
    }
  };

  const copy = async (value: string, what: string) => {
    const ok = await copyText(value);
    toast.show(ok ? `${what} kopiert.` : 'Kopieren hat nicht geklappt – markier den Text selbst.');
  };

  return (
    <div className="sale-contract">
      <form
        ref={form}
        className="sale-contract__form"
        onSubmit={(event) => void submit(event)}
        autoComplete="off"
        noValidate
      >
        <p className="field__hint">
          Nur für Privatverkäufe – verkaufst du ein Auto aus deinem Betrieb, passt dieser Text
          nicht. Nur Marke und Modell sind Pflicht; was du leer lässt, steht nicht im Text. Schreib
          nur, was du sicher weißt: Was im Inserat steht, kann später als vereinbart gelten. Den
          fertigen Text erstellst du mit KaufCheck Pro.
        </p>

        <fieldset className="sale-contract__group">
          <legend>Fahrzeug</legend>
          <div className="sale-contract__grid">
            <TextField label="Marke" maxLength={LISTING_LIMITS.line} {...text('make')} />
            <TextField label="Modell" maxLength={LISTING_LIMITS.line} {...text('model')} />
            <TextField
              label="Version oder Ausstattungslinie"
              hint="Zum Beispiel „1.5 TSI Life“"
              maxLength={LISTING_LIMITS.line}
              {...text('variant')}
            />
            <TextField
              label="Erstzulassung"
              hint="Feld B im Fahrzeugschein, zum Beispiel 09.2016"
              maxLength={10}
              {...text('firstRegistration')}
            />
            <TextField
              label="Kilometerstand laut Tacho"
              inputMode="numeric"
              maxLength={9}
              {...text('odometerKm')}
            />
            <SelectField
              label="Kraftstoff oder Energiequelle"
              value={values.fuel}
              onChange={(event) => update({ fuel: event.target.value as FuelType | '' })}
            >
              <option value="">Keine Angabe</option>
              {FUEL_TYPES.map((fuel) => (
                <option key={fuel} value={fuel}>
                  {FUEL_LABELS[fuel]}
                </option>
              ))}
            </SelectField>
            <TextField
              label="Leistung in kW"
              hint="Feld P.2 im Fahrzeugschein"
              inputMode="numeric"
              maxLength={6}
              {...text('powerKw')}
              onChange={(event) => update(linkedPower('kw', event.target.value))}
            />
            <TextField
              label="Leistung in PS"
              hint="Oder in PS eintragen: KaufCheck rechnet in kW um"
              inputMode="numeric"
              maxLength={6}
              {...text('powerPs')}
              onChange={(event) => update(linkedPower('ps', event.target.value))}
            />
            <SelectField
              label="Getriebe"
              value={values.transmission}
              onChange={(event) =>
                update({ transmission: event.target.value as TransmissionType | '' })
              }
            >
              <option value="">Keine Angabe</option>
              {TRANSMISSION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {TRANSMISSION_LABELS[type]}
                </option>
              ))}
            </SelectField>
            <TextField label="Farbe" maxLength={LISTING_LIMITS.line} {...text('color')} />
            <TextField
              label="HU bis"
              hint="Monat und Jahr von der Prüfplakette, zum Beispiel 09.2027"
              maxLength={9}
              {...text('huUntil')}
            />
            <TextField
              label="Zahl der Halter"
              hint="Laut Zulassungsbescheinigung Teil II"
              inputMode="numeric"
              maxLength={2}
              {...text('keepers')}
            />
            <TextField
              label="Zahl der Schlüssel"
              inputMode="numeric"
              maxLength={2}
              {...text('keys')}
            />
          </div>
          <RadioGroup
            clearable
            clearLabel={NO_STATEMENT}
            legend="Zulassung"
            name="listing-registration"
            value={values.registration}
            onChange={(registration) => update({ registration })}
            hint="Ein abgemeldetes Auto darf nicht auf öffentlichen Straßen fahren; für eine Probefahrt braucht es ein Kurzzeitkennzeichen. Der Text bietet dann keine Probefahrt an."
            options={[
              { value: 'registered', label: 'Das Auto ist zugelassen' },
              { value: 'deregistered', label: 'Das Auto ist abgemeldet' },
            ]}
          />
          <RadioGroup
            clearable
            clearLabel={NO_STATEMENT}
            legend="Gesamtlaufleistung"
            name="listing-total-mileage"
            value={values.totalMileage}
            onChange={(totalMileage) => update({ totalMileage })}
            hint="Der Tacho kann getauscht oder verstellt worden sein. Schreib nur, was du weißt."
            options={[
              { value: 'matches', label: 'Entspricht nach meiner Kenntnis dem Tachostand' },
              { value: 'unknown', label: 'Ist mir nicht bekannt' },
              { value: 'differs', label: 'Weicht nach meiner Kenntnis ab' },
            ]}
          />
          {values.totalMileage === 'differs' && (
            <TextField
              label="Gesamtlaufleistung nach deiner Kenntnis, in km"
              inputMode="numeric"
              maxLength={9}
              {...text('totalMileageKm')}
            />
          )}
        </fieldset>

        <fieldset className="sale-contract__group">
          <legend>Vorgeschichte</legend>
          <p className="field__hint">
            Dieselben Fragen stehen im Kaufvertrag. Antwortest du im Inserat und im Vertrag gleich,
            vermeidet ihr Widersprüche. Unbeantwortete Fragen erscheinen nicht im Text.
          </p>
          {LISTING_STATEMENTS.map((statement) => {
            const texts = LISTING_STATEMENT_TEXTS[statement];
            const answer = values.answers[statement];
            return (
              <div className="sale-contract__statement" key={statement}>
                <RadioGroup
                  clearable
                  clearLabel={NO_STATEMENT}
                  legend={texts.question}
                  name={`listing-answer-${statement}`}
                  value={answer}
                  onChange={(next) => update({ answers: { ...values.answers, [statement]: next } })}
                  options={ANSWER_ORDER.map((value) => ({ value, label: ANSWER_LABELS[value] }))}
                />
                {answer === 'yes' && (
                  <TextAreaField
                    label={texts.detail}
                    rows={2}
                    maxLength={LISTING_LIMITS.details}
                    value={values.details[statement]}
                    onChange={(event) =>
                      update({ details: { ...values.details, [statement]: event.target.value } })
                    }
                    error={errorFor(`details.${statement}`)}
                  />
                )}
              </div>
            );
          })}
        </fieldset>

        <fieldset className="sale-contract__group">
          <legend>Wartung und Zustand</legend>
          <RadioGroup
            clearable
            clearLabel={NO_STATEMENT}
            legend="Wartungsnachweise"
            name="listing-service-history"
            value={values.serviceHistory}
            onChange={(serviceHistory) => update({ serviceHistory })}
            hint="„Alle Wartungen“ nur, wenn jede vom Hersteller vorgesehene Wartung belegt ist."
            options={[
              { value: 'complete', label: SERVICE_HISTORY_TEXTS.complete },
              { value: 'partial', label: SERVICE_HISTORY_TEXTS.partial },
              { value: 'none', label: SERVICE_HISTORY_TEXTS.none },
            ]}
          />
          <TextField
            label="Letzte Wartung"
            hint="Zum Beispiel „Inspektion 05/2026 bei 84.000 km“"
            maxLength={LISTING_LIMITS.line}
            {...text('lastService')}
          />
          <TextAreaField
            label="Zuletzt gemacht"
            hint="Eine Zeile je Arbeit, zum Beispiel „Zahnriemen gewechselt 2024 bei 80.000 km“ oder neue Reifen und Bremsen – am besten mit Rechnung"
            rows={3}
            maxLength={LISTING_LIMITS.text}
            {...text('recentWork')}
          />
          <TextAreaField
            label="Umbauten"
            hint="Eine Zeile je Umbau, zum Beispiel „Anhängerkupplung, in den Papieren eingetragen“"
            rows={2}
            maxLength={LISTING_LIMITS.text}
            {...text('modifications')}
          />
          {electric && (
            <TextField
              label="Antriebsbatterie"
              hint="Zum Beispiel der Gesundheitszustand (SoH) aus einem Batterietest, mit Datum"
              maxLength={LISTING_LIMITS.line}
              {...text('battery')}
            />
          )}
          <RadioGroup
            clearable
            clearLabel={NO_STATEMENT}
            legend="Bekannte Mängel"
            name="listing-defects"
            value={values.defects}
            onChange={(defects) => update({ defects })}
            hint="Was du kennst, gehört ins Inserat – auch Verschleiß, Warnleuchten und Geräusche. Wer einen bekannten Mangel verschweigt, haftet trotz Ausschluss."
            options={[
              { value: 'listed', label: 'Ja, diese:' },
              { value: 'none', label: 'Mir sind keine Mängel bekannt' },
            ]}
          />
          {values.defects === 'listed' && (
            <TextAreaField
              label="Welche Mängel?"
              hint="Eine Zeile je Mangel, möglichst genau, zum Beispiel „Rost am Schweller hinten links“"
              rows={3}
              maxLength={LISTING_LIMITS.text}
              {...text('defectsText')}
            />
          )}
          <RadioGroup
            clearable
            clearLabel={NO_STATEMENT}
            legend="Rauchen im Auto"
            name="listing-smoking"
            value={values.smoking}
            onChange={(smoking) => update({ smoking })}
            options={[
              { value: 'nonSmoker', label: SMOKING_TEXTS.nonSmoker },
              { value: 'smoker', label: SMOKING_TEXTS.smoker },
            ]}
          />
        </fieldset>

        <fieldset className="sale-contract__group">
          <legend>Ausstattung und Verkauf</legend>
          <TextAreaField
            label="Ausstattung"
            hint="Eine Zeile je Merkmal, zum Beispiel Navi, Sitzheizung, Anhängerkupplung"
            rows={4}
            maxLength={LISTING_LIMITS.text}
            {...text('equipment')}
          />
          <TextAreaField
            label="Wird mitverkauft"
            hint="Zum Beispiel Winterräder, Dachträger, Ladekabel"
            rows={2}
            maxLength={LISTING_LIMITS.text}
            {...text('accessories')}
          />
          <TextAreaField
            label="Grund für den Verkauf"
            rows={2}
            maxLength={LISTING_LIMITS.text}
            {...text('reason')}
          />
          <TextField
            label="Ort der Besichtigung"
            hint="Nur Ort oder Stadtteil – deine Adresse gibst du erst nach dem Kontakt weiter"
            maxLength={LISTING_LIMITS.line}
            {...text('location')}
          />
        </fieldset>

        {hasErrors && <Alert tone="error" title="Bitte prüf die markierten Angaben." />}
        <div className="button-row">
          <Button
            type="submit"
            loading={busy || me.isPending}
            icon={<FileText aria-hidden size={18} />}
          >
            {created ? 'Text aktualisieren' : 'Inseratstext erstellen'}
            {me.data && !isPro && <span className="tag tag--pro">Pro</span>}
          </Button>
        </div>
        <p className="field__hint">
          Deine Eingaben bleiben in diesem Browser-Tab. KaufCheck speichert sie nicht und sendet sie
          nirgendwohin; der Text entsteht auf deinem Gerät.
        </p>
      </form>

      {/* Shown again after a link within the app only while Pro is still active. */}
      {created && isPro && (
        <section className="listing-text" aria-labelledby={RESULT_TITLE_ID}>
          <h3 id={RESULT_TITLE_ID} ref={result} tabIndex={-1}>
            Dein Inseratstext
          </h3>
          {hasErrors ? (
            <p className="muted">
              Sobald die markierten Angaben stimmen, steht hier wieder der Text.
            </p>
          ) : (
            <>
              <p className="muted">
                Der Text folgt deinen Eingaben. Lies ihn vor dem Einstellen genau durch und ändere,
                was nicht stimmt – auch nach dem Einfügen auf der Plattform.
              </p>
              <p className="muted">
                Auch die Felder der Plattform sind Angaben zum Auto, etwa „unfallfrei“ oder
                „scheckheftgepflegt“: Stell sie passend zu deinem Text ein und kreuz nichts an, was
                du nicht weißt. Speichere das veröffentlichte Inserat als Screenshot oder PDF.
              </p>
              <TextField
                label="Titel"
                hint={`${title.length} Zeichen, höchstens ${LISTING_TITLE_MAX}. Bei mobile.de stehen Marke, Modell und Motor schon im Titel – dort trägst du nur ein oder zwei Besonderheiten ein.`}
                value={title}
                readOnly
              />
              <div className="button-row">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Copy aria-hidden size={16} />}
                  onClick={() => void copy(title, 'Titel')}
                >
                  Titel kopieren
                </Button>
              </div>
              <TextAreaField
                label="Beschreibung"
                hint={`${description.length.toLocaleString('de-DE')} Zeichen`}
                value={description}
                rows={Math.min(24, description.split('\n').length + 1)}
                readOnly
              />
              <div className="button-row">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Copy aria-hidden size={16} />}
                  onClick={() => void copy(description, 'Beschreibung')}
                >
                  Beschreibung kopieren
                </Button>
              </div>
              <p>
                Interessent gefunden?{' '}
                <Link to="/kaufvertrag?inserat=1#vertrag">
                  Kaufvertrag mit diesen Angaben vorbereiten
                </Link>{' '}
                – dort stehen dieselben Fragen zum Zustand.
              </p>
            </>
          )}
        </section>
      )}

      <Dialog
        open={upsell}
        onClose={() => setUpsell(false)}
        title="Inseratstext"
        footer={
          <>
            <ButtonLink
              to="/pro"
              target="_blank"
              rel="noopener"
              onClick={() => track('pro_clicked', { placement: 'listing_text' })}
            >
              KaufCheck Pro ansehen
              <span className="visually-hidden"> (öffnet in neuem Tab)</span>
            </ButtonLink>
            <Button variant="secondary" onClick={() => setUpsell(false)}>
              Schließen
            </Button>
          </>
        }
      >
        <p>
          Mit KaufCheck Pro erstellst du aus deinen Angaben einen fertigen Inseratstext mit Titel –
          zum Kopieren für jede Plattform.
        </p>
        <p>
          Pro öffnet sich in einem neuen Tab; deine Eingaben hier bleiben erhalten, solange du diese
          Seite nicht schließt oder neu lädst. Danach tippst du einfach noch einmal auf
          „Inseratstext erstellen“.
        </p>
      </Dialog>
    </div>
  );
}
