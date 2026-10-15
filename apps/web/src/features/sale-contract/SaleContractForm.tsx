import {
  answerLabels,
  CONTRACT_DOCUMENT_LABELS,
  CONTRACT_DOCUMENTS,
  CONTRACT_LIMITS,
  CONTRACT_STATEMENT_TEXTS,
  CONTRACT_STATEMENTS,
  FUEL_LABELS,
  FUEL_TYPES,
  validateSaleContract,
  type ContractAnswer,
  type ContractParty,
  type FuelType,
  type SaleContractErrors,
  type SaleContractField,
  type SaleContractValues,
} from '@kaufcheck/shared';
import { FileSignature } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useMe } from '../../api/queries';
import { Alert } from '../../components/ui/Alert';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { SelectField, TextAreaField, TextField } from '../../components/ui/Field';
import { useToast } from '../../components/ui/toast-context';
import { track } from '../../lib/analytics';

type Role = '' | 'private' | 'business';

function RadioGroup<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
  hint,
}: {
  legend: ReactNode;
  name: string;
  value: T | '';
  options: { value: T; label: ReactNode }[];
  onChange: (value: T) => void;
  hint?: ReactNode;
}) {
  return (
    <fieldset className="choice-group">
      <legend>{legend}</legend>
      {hint && <p className="field__hint">{hint}</p>}
      {options.map((option) => (
        <label className="choice" key={option.value}>
          <input
            type="radio"
            name={name}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}

function PartyFields({
  role,
  title,
  party,
  onChange,
  errorFor,
}: {
  role: 'seller' | 'buyer';
  title: string;
  party: ContractParty;
  onChange: (party: ContractParty) => void;
  errorFor: (field: SaleContractField) => string | undefined;
}) {
  const field = (key: keyof ContractParty) => ({
    value: party[key],
    onChange: (event: { target: { value: string } }) =>
      onChange({ ...party, [key]: event.target.value }),
    error: errorFor(`${role}.${key}`),
  });
  return (
    <fieldset className="sale-contract__group">
      <legend>{title}</legend>
      <div className="sale-contract__grid">
        <TextField
          label="Name, Vorname"
          autoComplete="off"
          maxLength={CONTRACT_LIMITS.line}
          {...field('name')}
        />
        <TextField label="Geburtsdatum" type="date" autoComplete="off" {...field('birthDate')} />
        <TextField
          label="Straße, Hausnummer"
          autoComplete="off"
          maxLength={CONTRACT_LIMITS.line}
          {...field('street')}
        />
        <TextField
          label="PLZ, Ort"
          autoComplete="off"
          maxLength={CONTRACT_LIMITS.line}
          {...field('city')}
        />
        <TextField
          label="Telefon"
          type="tel"
          autoComplete="off"
          maxLength={CONTRACT_LIMITS.short}
          {...field('phone')}
        />
        <TextField
          label="E-Mail"
          type="email"
          autoComplete="off"
          maxLength={CONTRACT_LIMITS.line}
          {...field('email')}
        />
        <TextField
          label="Ausweis- oder Passnummer"
          hint="Mit dem Ausweis vergleichen; kein Foto oder Scan nötig"
          autoComplete="off"
          maxLength={CONTRACT_LIMITS.short}
          {...field('idNumber')}
        />
      </div>
    </fieldset>
  );
}

const ANSWER_ORDER: Exclude<ContractAnswer, ''>[] = ['yes', 'no', 'unknown'];

/**
 * The form for the purchase contract. What is typed stays in this browser
 * tab: nothing is saved or sent, and the PDF is built locally (Pro).
 */
export function SaleContractForm({ initial }: { initial: SaleContractValues }) {
  const me = useMe();
  const toast = useToast();
  const [seller, setSeller] = useState<Role>('');
  const [buyer, setBuyer] = useState<Role>('');
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<SaleContractErrors>({});
  const [busy, setBusy] = useState(false);
  const [upsell, setUpsell] = useState(false);
  const [dirty, setDirty] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const isPro = me.data?.entitlements.saleContract ?? false;

  // Nothing is saved: leaving the page asks first once something was typed.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const update = (change: Partial<SaleContractValues>) => {
    setDirty(true);
    setValues((current) => ({ ...current, ...change }));
  };
  const errorFor = (field: SaleContractField) => errors[field];
  const text = (key: keyof SaleContractValues & SaleContractField) => ({
    value: values[key] as string,
    onChange: (event: { target: { value: string } }) => update({ [key]: event.target.value }),
    error: errorFor(key),
  });

  const business = seller === 'business' || buyer === 'business';
  const ready = seller === 'private' && buyer === 'private';
  const electric =
    values.fuel === 'electric' || values.fuel === 'plugin_hybrid' || values.battery !== '';

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found = validateSaleContract(values);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      // After React has marked the fields, the first one gets the focus.
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
      // Pro may have been ordered in another tab in the meantime.
      if (!isPro && !(await me.refetch()).data?.entitlements.saleContract) {
        setUpsell(true);
        return;
      }
      const { buildSaleContractPdf, saleContractFileName } = await import('./contract-pdf');
      buildSaleContractPdf(values).save(saleContractFileName(values, new Date()));
      track('sale_contract_created');
      toast.show('Vertrag erstellt – druck ihn zweimal aus.');
    } catch (error) {
      console.error('Contract PDF failed', error);
      toast.show(
        'Das PDF konnte nicht erstellt werden. Bitte lade die Seite neu und versuch es noch einmal.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sale-contract">
      <div className="sale-contract__roles">
        <RadioGroup
          legend="Wer verkauft?"
          name="seller-role"
          value={seller}
          onChange={setSeller}
          options={[
            { value: 'private', label: 'Eine Privatperson' },
            { value: 'business', label: 'Ein Händler oder jemand, der gewerblich verkauft' },
          ]}
        />
        <RadioGroup
          legend="Wer kauft?"
          name="buyer-role"
          value={buyer}
          onChange={setBuyer}
          options={[
            { value: 'private', label: 'Eine Privatperson' },
            { value: 'business', label: 'Ein Unternehmen oder Händler' },
          ]}
        />
      </div>

      {business && (
        <Alert tone="warning" title="Dieser Vertrag passt nur, wenn beide privat handeln">
          <p>
            Verkauft ein Händler an eine Privatperson, darf er die Gewährleistung nicht
            ausschließen; bei Gebrauchtwagen kann er sie nur auf ein Jahr verkürzen, und das muss
            ausdrücklich und gesondert vereinbart werden. Händler und Unternehmen verwenden dafür
            eigene Verträge. Lies den Vertrag des Händlers genau und lass dir Zusagen schriftlich
            geben.
          </p>
        </Alert>
      )}

      {ready && (
        <form
          ref={form}
          className="sale-contract__form"
          onSubmit={(event) => void submit(event)}
          noValidate
        >
          <p className="field__hint">
            Alle Angaben sind freiwillig: Was du leer lässt, wird im Vertrag eine Linie oder ein
            leeres Kästchen zum Ausfüllen von Hand.
          </p>

          <PartyFields
            role="seller"
            title="Verkäufer"
            party={values.seller}
            onChange={(party) => update({ seller: party })}
            errorFor={errorFor}
          />
          <PartyFields
            role="buyer"
            title="Käufer"
            party={values.buyer}
            onChange={(party) => update({ buyer: party })}
            errorFor={errorFor}
          />

          <fieldset className="sale-contract__group">
            <legend>Fahrzeug</legend>
            <div className="sale-contract__grid">
              <TextField label="Hersteller" maxLength={CONTRACT_LIMITS.line} {...text('make')} />
              <TextField label="Modell" maxLength={CONTRACT_LIMITS.line} {...text('model')} />
              <TextField
                label="Fahrzeug-Identifizierungsnummer (FIN)"
                hint="Feld E im Fahrzeugschein – mit der Nummer am Auto vergleichen"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={21}
                {...text('vin')}
              />
              <TextField
                label="Amtliches Kennzeichen"
                maxLength={CONTRACT_LIMITS.short}
                {...text('plate')}
              />
              <TextField
                label="Erstzulassung"
                hint="Feld B, zum Beispiel 14.09.2016"
                maxLength={CONTRACT_LIMITS.short}
                {...text('firstRegistration')}
              />
              <TextField
                label="Nummer der Zulassungsbescheinigung Teil II"
                hint="Oben rechts im Fahrzeugbrief"
                maxLength={CONTRACT_LIMITS.short}
                {...text('registrationPart2Number')}
              />
              <TextField
                label="Leistung in kW"
                hint="Feld P.2"
                inputMode="numeric"
                maxLength={6}
                {...text('powerKw')}
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
              <TextField label="Farbe" maxLength={CONTRACT_LIMITS.line} {...text('color')} />
              <TextField
                label="Hauptuntersuchung gültig bis"
                hint="Monat/Jahr, zum Beispiel 09/2027"
                maxLength={7}
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
                label="Tachostand bei Übergabe in km"
                hint="Bei der Übergabe vom Tacho ablesen"
                inputMode="numeric"
                maxLength={9}
                {...text('odometerKm')}
              />
            </div>
            <RadioGroup
              legend="Gesamtlaufleistung: Was weiß der Verkäufer?"
              name="total-mileage"
              value={values.totalMileage}
              onChange={(totalMileage) => update({ totalMileage })}
              hint="Der Tacho kann getauscht oder verstellt worden sein. Hier steht, was der Verkäufer über die tatsächliche Laufleistung weiß."
              options={[
                { value: 'matches', label: 'Sie entspricht nach seiner Kenntnis dem Tachostand' },
                { value: 'unknown', label: 'Sie ist ihm nicht bekannt' },
                { value: 'differs', label: 'Sie weicht ab' },
              ]}
            />
            {values.totalMileage === 'differs' && (
              <TextField
                label="Gesamtlaufleistung nach Kenntnis des Verkäufers, in km"
                inputMode="numeric"
                maxLength={9}
                {...text('totalMileageKm')}
              />
            )}
            {electric && (
              <RadioGroup
                legend="Antriebsbatterie"
                name="battery"
                value={values.battery}
                onChange={(battery) => update({ battery })}
                options={[
                  { value: 'included', label: 'Gehört zum Auto und wird mitverkauft' },
                  { value: 'rented', label: 'Ist gemietet oder geleast' },
                ]}
              />
            )}
          </fieldset>

          <fieldset className="sale-contract__group">
            <legend>Angaben des Verkäufers</legend>
            <p className="field__hint">
              Diese Angaben macht der Verkäufer – nichts ist vorausgewählt. „Nicht bekannt“ heißt:
              Er weiß es nicht und macht dazu keine Angabe. Lässt du eine Frage offen, kreuzt ihr
              sie auf dem Papier an.
            </p>
            {CONTRACT_STATEMENTS.map((statement) => {
              const labels = answerLabels(statement);
              const answer = values.answers[statement];
              return (
                <div className="sale-contract__statement" key={statement}>
                  <RadioGroup
                    legend={CONTRACT_STATEMENT_TEXTS[statement].text}
                    name={`answer-${statement}`}
                    value={answer}
                    onChange={(next) =>
                      update({ answers: { ...values.answers, [statement]: next } })
                    }
                    options={ANSWER_ORDER.map((value) => ({ value, label: labels[value] }))}
                  />
                  {answer === 'yes' && (
                    <TextAreaField
                      label={CONTRACT_STATEMENT_TEXTS[statement].detail}
                      rows={2}
                      maxLength={CONTRACT_LIMITS.details}
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
            <TextAreaField
              label="Weitere bekannte Mängel und Schäden"
              hint="Möglichst genau, zum Beispiel „Rost am Schweller hinten links“. Was hier steht, kennt der Käufer beim Kauf."
              rows={3}
              maxLength={CONTRACT_LIMITS.text}
              {...text('knownDefects')}
            />
          </fieldset>

          <fieldset className="sale-contract__group">
            <legend>Kaufpreis und Übergabe</legend>
            <div className="sale-contract__grid">
              <TextField
                label="Kaufpreis in Euro"
                hint="Ganze Euro; im Vertrag steht er auch in Worten"
                inputMode="numeric"
                maxLength={12}
                {...text('price')}
              />
              <TextField
                label="Bereits erhaltene Anzahlung in Euro"
                hint="Nur falls schon gezahlt"
                inputMode="numeric"
                maxLength={12}
                {...text('deposit')}
              />
              <TextField label="Übergabe am" type="date" {...text('handoverDate')} />
              <TextField label="Uhrzeit" type="time" {...text('handoverTime')} />
              <TextField
                label="Übergabe in (Ort)"
                maxLength={CONTRACT_LIMITS.line}
                {...text('handoverPlace')}
              />
              <TextField
                label="Zahl der Schlüssel"
                inputMode="numeric"
                maxLength={2}
                {...text('keys')}
              />
            </div>
            <RadioGroup
              legend="Bezahlung"
              name="payment"
              value={values.payment}
              onChange={(payment) => update({ payment })}
              options={[
                { value: 'cash', label: 'Bar bei der Übergabe' },
                {
                  value: 'transfer',
                  label: 'Per Überweisung – das Geld muss vor der Übergabe eingegangen sein',
                },
              ]}
            />
            <RadioGroup
              legend="Bei der Übergabe ist das Auto"
              name="registration"
              value={values.registration}
              onChange={(registration) => update({ registration })}
              options={[
                { value: 'deregistered', label: 'abgemeldet (außer Betrieb gesetzt)' },
                { value: 'registered', label: 'noch auf den Verkäufer zugelassen' },
              ]}
            />
            {values.registration === 'registered' && (
              <TextField
                label="Der Käufer meldet es um bis spätestens"
                hint="Am besten wenige Tage; bis dahin haftet auch der Verkäufer als Halter"
                type="date"
                {...text('reRegisterBy')}
              />
            )}
          </fieldset>

          <fieldset className="sale-contract__group">
            <legend>Unterlagen und Zubehör</legend>
            <div className="sale-contract__documents">
              {CONTRACT_DOCUMENTS.map((document) => (
                <label className="consent" key={document}>
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={values.documents.includes(document)}
                    onChange={(event) =>
                      update({
                        documents: event.target.checked
                          ? [...values.documents, document]
                          : values.documents.filter((item) => item !== document),
                      })
                    }
                  />
                  <span>{CONTRACT_DOCUMENT_LABELS[document]}</span>
                </label>
              ))}
            </div>
            <TextAreaField
              label="Mitverkauftes Zubehör"
              hint="Zum Beispiel zweiter Radsatz, Dachträger, Ladekabel"
              rows={2}
              maxLength={CONTRACT_LIMITS.text}
              {...text('accessories')}
            />
            <TextAreaField
              label="Nicht mitverkauft"
              rows={1}
              maxLength={CONTRACT_LIMITS.text}
              {...text('notIncluded')}
            />
          </fieldset>

          <fieldset className="sale-contract__group">
            <legend>Weitere Vereinbarungen</legend>
            <TextAreaField
              label="Was ihr sonst vereinbart"
              hint="Zum Beispiel eine Reparatur, die der Verkäufer noch erledigt. KaufCheck prüft diesen Text nicht."
              rows={3}
              maxLength={CONTRACT_LIMITS.text}
              {...text('otherAgreements')}
            />
          </fieldset>

          {Object.keys(errors).length > 0 && (
            <Alert tone="error" title="Bitte prüf die markierten Angaben." />
          )}
          <div className="button-row">
            <Button
              type="submit"
              loading={busy || me.isPending}
              icon={<FileSignature aria-hidden size={18} />}
            >
              Vertrag als PDF erstellen
              {me.data && !isPro && <span className="tag tag--pro">Pro</span>}
            </Button>
          </div>
          <p className="field__hint">
            Deine Eingaben bleiben in diesem Browser-Tab. KaufCheck speichert sie nicht und sendet
            sie nirgendwohin; auch das PDF entsteht auf deinem Gerät.
          </p>
        </form>
      )}

      <Dialog
        open={upsell}
        onClose={() => setUpsell(false)}
        title="Kaufvertrag als PDF"
        footer={
          <>
            {/* A new tab, so that what was typed here is not lost. */}
            <ButtonLink
              to="/pro"
              target="_blank"
              rel="noopener"
              onClick={() => track('pro_clicked', { placement: 'sale_contract' })}
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
          Mit KaufCheck Pro erstellst du aus deinen Angaben einen fertigen Kaufvertrag zum
          Ausdrucken – mit Übergabeprotokoll und Quittung.
        </p>
        <p>
          Pro öffnet sich in einem neuen Tab; deine Eingaben hier bleiben erhalten, solange du diese
          Seite nicht schließt. Danach lädst du diese Seite nicht neu, sondern tippst einfach noch
          einmal auf „Vertrag als PDF erstellen“.
        </p>
      </Dialog>
    </div>
  );
}
