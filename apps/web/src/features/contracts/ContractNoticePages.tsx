import {
  CANCEL_CONFIRM_LABEL,
  PRO_PRODUCT_NAME,
  WITHDRAW_CONFIRM_LABEL,
  WITHDRAWAL_POLICY_PATH,
  withdrawalDeclaration,
  type ContractNoticeReceipt,
} from '@kaufcheck/shared';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ApiRequestError } from '../../api/client';
import { useMe, useSendCancellation, useSendWithdrawal } from '../../api/queries';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { TextAreaField, TextField } from '../../components/ui/Field';
import { STATIC_PAGE_META } from '../../seo/pages';
import { usePageMeta } from '../../seo/use-page-meta';
import { NoticeReceipt } from './NoticeReceipt';

type Errors = Record<string, string | undefined>;

function serverErrors(error: unknown): { fields: Errors; general: string | null } {
  if (!(error instanceof ApiRequestError)) return { fields: {}, general: null };
  const fieldErrors = error.details?.fieldErrors;
  if (!fieldErrors) return { fields: {}, general: error.message };
  return {
    fields: Object.fromEntries(
      Object.entries(fieldErrors).map(([field, messages]) => [field, messages[0]]),
    ),
    general: null,
  };
}

/** Name, e-mail and order number; e-mail and order number default to the signed-in account. */
function useContactDefaults() {
  const me = useMe();
  const [name, setName] = useState('');
  // null = not edited yet: show the account's value.
  const [typedEmail, setEmail] = useState<string | null>(null);
  const [typedOrderNumber, setOrderNumber] = useState<string | null>(null);
  return {
    name,
    setName,
    email: typedEmail ?? me.data?.user?.email ?? '',
    setEmail,
    orderNumber: typedOrderNumber ?? me.data?.contract?.orderNumber ?? '',
    setOrderNumber,
  };
}

function ContactFields({
  contact,
  errors,
  emailHint,
}: {
  contact: ReturnType<typeof useContactDefaults>;
  errors: Errors;
  emailHint: ReactNode;
}) {
  return (
    <>
      <TextField
        label="Dein Name"
        autoComplete="name"
        required
        value={contact.name}
        onChange={(event) => contact.setName(event.target.value)}
        error={errors.name}
      />
      <TextField
        label="E-Mail-Adresse"
        type="email"
        autoComplete="email"
        required
        value={contact.email}
        onChange={(event) => contact.setEmail(event.target.value)}
        hint={emailHint}
        error={errors.email}
      />
      <TextField label="Vertrag" value={PRO_PRODUCT_NAME} readOnly />
      <TextField
        label="Bestellnummer (falls zur Hand)"
        autoComplete="off"
        spellCheck={false}
        value={contact.orderNumber}
        onChange={(event) => contact.setOrderNumber(event.target.value)}
        hint="Steht in deiner Vertragsbestätigung, zum Beispiel KC-7F3K9QMA."
        error={errors.orderNumber}
      />
    </>
  );
}

function validContact(contact: ReturnType<typeof useContactDefaults>): Errors {
  const errors: Errors = {};
  if (contact.name.trim().length < 2) errors.name = 'Bitte gib deinen Namen an.';
  if (!contact.email.includes('@')) errors.email = 'Bitte gib eine gültige E-Mail-Adresse ein.';
  return errors;
}

/** § 312k BGB: the confirmation page behind "Verträge hier kündigen". No sign-in needed. */
export function CancelContractPage() {
  usePageMeta(
    STATIC_PAGE_META['/vertrag-kuendigen'] ?? {
      title: 'Vertrag kündigen',
      description: '',
      noindex: true,
    },
  );
  const send = useSendCancellation();
  const contact = useContactDefaults();
  const [kind, setKind] = useState<'ordinary' | 'extraordinary'>('ordinary');
  const [reason, setReason] = useState('');
  const [timing, setTiming] = useState<'earliest' | 'date'>('earliest');
  const [endDate, setEndDate] = useState('');
  const [localErrors, setLocalErrors] = useState<Errors>({});
  const [receipt, setReceipt] = useState<ContractNoticeReceipt | null>(null);
  const server = serverErrors(send.error);
  const errors = { ...server.fields, ...localErrors };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const found = validContact(contact);
    if (kind === 'extraordinary' && !reason.trim())
      found.reason = 'Bitte nenne den Grund für die außerordentliche Kündigung.';
    if (timing === 'date' && !endDate) found.endDate = 'Bitte wähle ein Datum.';
    setLocalErrors(found);
    if (Object.keys(found).length > 0) return;
    send.mutate(
      {
        kind,
        reason: kind === 'extraordinary' ? reason : undefined,
        name: contact.name,
        email: contact.email,
        orderNumber: contact.orderNumber || undefined,
        endDate: timing === 'date' ? endDate : undefined,
      },
      { onSuccess: setReceipt },
    );
  };

  return (
    <div className="container page page--narrow">
      <h1>Vertrag kündigen</h1>
      <p className="page__lead">
        {`Hier kündigst du dein Abo „KaufCheck Pro“ – auch ohne Anmeldung. Nach dem Klick auf „${CANCEL_CONFIRM_LABEL}“ siehst du sofort eine Bestätigung zum Speichern und bekommst sie per E-Mail.`}
      </p>
      {receipt ? (
        <NoticeReceipt receipt={receipt} />
      ) : (
        <form className="stack notice-form" onSubmit={submit} noValidate>
          {server.general && <Alert tone="error">{server.general}</Alert>}
          <fieldset className="choice-group">
            <legend>Art der Kündigung</legend>
            <label className="choice">
              <input
                type="radio"
                name="kind"
                checked={kind === 'ordinary'}
                onChange={() => setKind('ordinary')}
              />
              <span>
                Ordentliche Kündigung
                <span className="choice__hint">zum Ende des laufenden Abrechnungsmonats</span>
              </span>
            </label>
            <label className="choice">
              <input
                type="radio"
                name="kind"
                checked={kind === 'extraordinary'}
                onChange={() => setKind('extraordinary')}
              />
              <span>
                Außerordentliche Kündigung
                <span className="choice__hint">aus wichtigem Grund</span>
              </span>
            </label>
          </fieldset>
          {kind === 'extraordinary' && (
            <TextAreaField
              label="Grund der außerordentlichen Kündigung"
              rows={4}
              required
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              error={errors.reason}
            />
          )}
          <ContactFields
            contact={contact}
            errors={errors}
            emailHint="Am besten die E-Mail-Adresse deines KaufCheck-Kontos. An diese Adresse schicken wir die Bestätigung."
          />
          <fieldset className="choice-group">
            <legend>Wann soll der Vertrag enden?</legend>
            <label className="choice">
              <input
                type="radio"
                name="timing"
                checked={timing === 'earliest'}
                onChange={() => setTiming('earliest')}
              />
              <span>Zum nächstmöglichen Zeitpunkt</span>
            </label>
            <label className="choice">
              <input
                type="radio"
                name="timing"
                checked={timing === 'date'}
                onChange={() => setTiming('date')}
              />
              <span>Zu einem bestimmten Datum</span>
            </label>
          </fieldset>
          {timing === 'date' && (
            <TextField
              label="Gewünschtes Vertragsende"
              type="date"
              required
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              hint="Das Abo endet mit Ablauf des Abrechnungsmonats, in den dieser Tag fällt."
              error={errors.endDate}
            />
          )}
          <div>
            <Button type="submit" size="lg" loading={send.isPending}>
              {CANCEL_CONFIRM_LABEL}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

/** § 356a BGB: the withdrawal function behind "Vertrag widerrufen". No sign-in needed. */
export function WithdrawContractPage() {
  usePageMeta(
    STATIC_PAGE_META['/vertrag-widerrufen'] ?? {
      title: 'Vertrag widerrufen',
      description: '',
      noindex: true,
    },
  );
  const send = useSendWithdrawal();
  const contact = useContactDefaults();
  const [localErrors, setLocalErrors] = useState<Errors>({});
  const [receipt, setReceipt] = useState<ContractNoticeReceipt | null>(null);
  const server = serverErrors(send.error);
  const errors = { ...server.fields, ...localErrors };
  const contract = contact.orderNumber.trim()
    ? `${PRO_PRODUCT_NAME}, Bestellnummer ${contact.orderNumber.trim().toUpperCase()}`
    : PRO_PRODUCT_NAME;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const found = validContact(contact);
    setLocalErrors(found);
    if (Object.keys(found).length > 0) return;
    send.mutate(
      {
        name: contact.name,
        email: contact.email,
        orderNumber: contact.orderNumber || undefined,
      },
      { onSuccess: setReceipt },
    );
  };

  return (
    <div className="container page page--narrow">
      <h1>Vertrag widerrufen</h1>
      <p className="page__lead">
        Binnen 14 Tagen ab Vertragsschluss kannst du deinen Vertrag über KaufCheck Pro ohne Angabe
        von Gründen widerrufen – auch ohne Anmeldung. Die Einzelheiten stehen in der{' '}
        <Link to={WITHDRAWAL_POLICY_PATH}>Widerrufsbelehrung</Link>.
      </p>
      {receipt ? (
        <NoticeReceipt receipt={receipt} />
      ) : (
        <form className="stack notice-form" onSubmit={submit} noValidate>
          {server.general && <Alert tone="error">{server.general}</Alert>}
          <ContactFields
            contact={contact}
            errors={errors}
            emailHint="An diese Adresse schicken wir die Eingangsbestätigung deines Widerrufs."
          />
          <div className="declaration">
            <p className="declaration__label">Deine Erklärung</p>
            <p>„{withdrawalDeclaration(contract)}“</p>
          </div>
          <div>
            <Button type="submit" size="lg" loading={send.isPending}>
              {WITHDRAW_CONFIRM_LABEL}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
