import {
  CANCEL_BUTTON_LABEL,
  CANCEL_PATH,
  contractTerms,
  formatCents,
  formatLegalDateTime,
  operatorLine,
  ORDER_BUTTON_LABEL,
  ORDER_CONSENT_TEXTS,
  paymentMethodsText,
  PRO_PRODUCT_NAME,
  proFeatures,
  TERMS_PATH,
  vatNote,
  WITHDRAW_BUTTON_LABEL,
  WITHDRAW_PATH,
  WITHDRAWAL_POLICY_PATH,
} from '@kaufcheck/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ApiRequestError } from '../../api/client';
import { queryKeys, useConfig, useMe, useOrder, usePlaceOrder } from '../../api/queries';
import { Alert } from '../../components/ui/Alert';
import { Button, ButtonLink } from '../../components/ui/Button';
import { PageLoading, Spinner } from '../../components/ui/Spinner';
import { CONTRACT_DETAILS_COMPLETE, LEGAL_CONTEXT } from '../../pages/legal/site-info';
import { appPageMeta } from '../../seo/pages';
import { usePageMeta } from '../../seo/use-page-meta';

const ORDER_META = appPageMeta('Bestellung');
const DONE_META = appPageMeta('Bestellung abgeschlossen');

function SignInFirst({ returnTo }: { returnTo: string }) {
  return (
    <div className="card">
      <h2>Melde dich zuerst an</h2>
      <p>
        KaufCheck Pro gehört zu deinem Konto. Melde dich an oder erstelle ein kostenloses Konto.
      </p>
      <div className="button-row">
        <ButtonLink to="/registrieren" state={{ returnTo }}>
          Konto erstellen
        </ButtonLink>
        <ButtonLink to="/anmelden" state={{ returnTo }} variant="secondary">
          Anmelden
        </ButtonLink>
      </div>
    </div>
  );
}

/**
 * The order page: everything § 312j Abs. 2 BGB requires directly above the
 * button "Zahlungspflichtig bestellen", which places the binding order.
 * Payment happens afterwards on Stripe's page.
 */
export function OrderPage() {
  usePageMeta(ORDER_META);
  const config = useConfig();
  const me = useMe();
  const placeOrder = usePlaceOrder();
  const [params] = useSearchParams();
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [immediateStart, setImmediateStart] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const aborted = params.get('abgebrochen');

  if (config.isPending || me.isPending) return <PageLoading />;
  const offer = config.data?.pro.offer ?? null;
  const user = me.data?.user ?? null;

  const content = () => {
    if (!user) return <SignInFirst returnTo="/pro/bestellen" />;
    if (me.data?.plan === 'pro') {
      return (
        <Alert tone="info" title="Du nutzt bereits KaufCheck Pro">
          <p>
            Dein Abo verwaltest du in deinem <Link to="/konto">Konto</Link>.
          </p>
        </Alert>
      );
    }
    // Without the operator's full details the order page would lack required information.
    if (!offer || !config.data || !CONTRACT_DETAILS_COMPLETE) {
      return (
        <Alert tone="info" title="Bestellen ist gerade nicht möglich">
          <p>
            Die Bezahlung ist derzeit nicht verfügbar. KaufCheck kannst du weiter kostenlos nutzen.
          </p>
        </Alert>
      );
    }

    const features = proFeatures(config.data.plans.pro, {
      photoAnalysis: config.data.features.photoAnalysis,
    });
    const submit = (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setShowErrors(true);
      if (!acceptTerms || !immediateStart) return;
      placeOrder.mutate(
        { acceptTerms: true, requestImmediateStart: true },
        {
          onSuccess: ({ url }) => {
            setRedirecting(true);
            window.location.assign(url);
          },
        },
      );
    };
    const termsError = showErrors && !acceptTerms ? 'Bitte akzeptiere die AGB.' : null;
    const startError =
      showErrors && !immediateStart
        ? 'Bitte bestätige, dass KaufCheck Pro sofort beginnen soll.'
        : null;

    return (
      <form className="order" onSubmit={submit} noValidate>
        <section className="card" aria-labelledby="order-details">
          <h2 id="order-details">Deine Angaben</h2>
          <dl className="definition-list">
            <div>
              <dt>Konto</dt>
              <dd>
                {user.email}
                <span className="order__hint">
                  {' '}
                  · Anderes Konto? Melde dich in deinem <Link to="/konto">Konto</Link> ab und mit
                  dem anderen an.
                </span>
              </dd>
            </div>
            <div>
              <dt>Zahlungsarten</dt>
              <dd>
                {paymentMethodsText(offer.paymentMethods)} – die Zahlung wählst du im nächsten
                Schritt bei unserem Zahlungsdienstleister Stripe.
              </dd>
            </div>
            <div>
              <dt>Vertragspartner</dt>
              <dd>{operatorLine(LEGAL_CONTEXT.operator)}</dd>
            </div>
            <div>
              <dt>Leistungsbeginn</dt>
              <dd>sofort nach Vertragsschluss, in deinem KaufCheck-Konto</dd>
            </div>
            <div>
              <dt>Gewährleistung</dt>
              <dd>
                Es gelten die gesetzlichen Gewährleistungsrechte für digitale Produkte (§§ 327 ff.
                BGB).
              </dd>
            </div>
          </dl>
        </section>

        <section className="card" aria-labelledby="order-withdrawal">
          <h2 id="order-withdrawal">Widerrufsrecht und deine Zustimmung</h2>
          <p>
            Du kannst den Vertrag binnen 14 Tagen ab Vertragsschluss ohne Angabe von Gründen
            widerrufen – auch online über die Schaltfläche „{WITHDRAW_BUTTON_LABEL}“ am Ende jeder
            Seite. Verlangst du, dass KaufCheck Pro sofort beginnt, zahlst du bei einem Widerruf
            einen anteiligen Betrag für die Zeit bis zum Widerruf. Einzelheiten und das
            Muster-Widerrufsformular stehen in der{' '}
            <Link to={WITHDRAWAL_POLICY_PATH} target="_blank">
              Widerrufsbelehrung
            </Link>
            .
          </p>
          <div className="consents">
            <label className="consent">
              <input
                type="checkbox"
                className="checkbox"
                checked={acceptTerms}
                onChange={(event) => setAcceptTerms(event.target.checked)}
                aria-invalid={termsError ? true : undefined}
                aria-describedby={termsError ? 'consent-terms-error' : undefined}
              />
              <span>
                Ich akzeptiere die{' '}
                <Link to={TERMS_PATH} target="_blank">
                  Allgemeinen Geschäftsbedingungen (AGB)
                </Link>{' '}
                von KaufCheck Pro.
              </span>
            </label>
            {termsError && (
              <p className="field__error" id="consent-terms-error">
                {termsError}
              </p>
            )}
            <label className="consent">
              <input
                type="checkbox"
                className="checkbox"
                checked={immediateStart}
                onChange={(event) => setImmediateStart(event.target.checked)}
                aria-invalid={startError ? true : undefined}
                aria-describedby={startError ? 'consent-start-error' : undefined}
              />
              <span>{ORDER_CONSENT_TEXTS.requestImmediateStart}</span>
            </label>
            {startError && (
              <p className="field__error" id="consent-start-error">
                {startError}
              </p>
            )}
          </div>
        </section>

        <section className="order-summary" aria-labelledby="order-summary">
          <h2 id="order-summary">{PRO_PRODUCT_NAME}</h2>
          <ul className="order-summary__features">
            {features.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
          <dl className="order-summary__terms">
            {contractTerms(offer).map((term) => (
              <div key={term.label}>
                <dt>{term.label}</dt>
                <dd>{term.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {placeOrder.error instanceof ApiRequestError && (
          <Alert tone="error">{placeOrder.error.message}</Alert>
        )}
        <Button type="submit" size="lg" block loading={placeOrder.isPending || redirecting}>
          {ORDER_BUTTON_LABEL}
        </Button>
        <p className="order__next">
          Danach leiten wir dich zu Stripe weiter. Dort wählst du die Zahlungsart und gibst die
          Zahlung frei; erst dann kommt der Vertrag zustande. <Link to="/pro">Zurück</Link>
        </p>
      </form>
    );
  };

  return (
    <div className="container page page--narrow">
      <h1>Bestellung: KaufCheck Pro</h1>
      {aborted && (
        <Alert tone="info" title="Zahlung abgebrochen">
          <p>
            Es ist kein Vertrag zustande gekommen, und es entstehen dir keine Kosten. Du kannst hier
            neu bestellen.
          </p>
        </Alert>
      )}
      {content()}
    </div>
  );
}

/** After the payment page: confirms the contract once Stripe has confirmed the payment. */
export function OrderDonePage() {
  usePageMeta(DONE_META);
  const [params] = useSearchParams();
  const number = params.get('bestellung') ?? '';
  const me = useMe();
  const order = useOrder(me.data?.user ? number : '');
  const queryClient = useQueryClient();
  const concluded = order.data?.status === 'concluded';
  const [waitingLong, setWaitingLong] = useState(false);

  useEffect(() => {
    if (concluded) void queryClient.invalidateQueries({ queryKey: queryKeys.me });
  }, [concluded, queryClient]);
  useEffect(() => {
    const timer = window.setTimeout(() => setWaitingLong(true), 80_000);
    return () => window.clearTimeout(timer);
  }, []);

  const content = () => {
    if (me.isPending) return <PageLoading />;
    if (!me.data?.user) return <SignInFirst returnTo={`/pro/bestellt?bestellung=${number}`} />;
    if (order.isPending) return <PageLoading />;
    if (order.isError || !order.data) {
      return (
        <Alert tone="error" title="Bestellung nicht gefunden">
          <p>
            Diese Bestellung gehört nicht zu deinem Konto. Deine Bestellungen findest du in deinem{' '}
            <Link to="/konto">Konto</Link>.
          </p>
        </Alert>
      );
    }
    const data = order.data;
    if (data.status === 'abandoned') {
      return (
        <Alert tone="info" title="Die Zahlung wurde nicht abgeschlossen">
          <p>
            Es ist kein Vertrag zustande gekommen, und es entstehen dir keine Kosten.{' '}
            <Link to="/pro/bestellen">Neu bestellen</Link>
          </p>
        </Alert>
      );
    }
    if (data.status === 'pending') {
      return (
        <div className="card order-waiting" role="status">
          {waitingLong ? (
            <p>
              Die Bestätigung der Zahlung dauert länger als üblich. Sobald sie da ist, schicken wir
              dir die Vertragsbestätigung per E-Mail an {data.email}.
            </p>
          ) : (
            <>
              <Spinner />
              <p>Wir warten auf die Bestätigung der Zahlung durch Stripe …</p>
            </>
          )}
        </div>
      );
    }
    return (
      <>
        <Alert tone="success" title="Vielen Dank! Dein Vertrag ist geschlossen.">
          <p>
            KaufCheck Pro ist ab sofort in deinem Konto freigeschaltet. Die Vertragsbestätigung mit
            den AGB, der Widerrufsbelehrung und dem Muster-Widerrufsformular haben wir an{' '}
            <strong>{data.email}</strong> geschickt.
          </p>
        </Alert>
        <dl className="definition-list card">
          <div>
            <dt>Bestellnummer</dt>
            <dd>{data.number}</dd>
          </div>
          {data.concludedAt && (
            <div>
              <dt>Vertragsschluss</dt>
              <dd>{formatLegalDateTime(data.concludedAt)}</dd>
            </div>
          )}
          <div>
            <dt>Preis</dt>
            <dd>
              {formatCents(data.priceCents)} pro Monat. {vatNote(data.vatMode)}
            </dd>
          </div>
        </dl>
        <p>
          Kündigen kannst du jederzeit zum Ende des Abrechnungsmonats über „
          <Link to={CANCEL_PATH}>{CANCEL_BUTTON_LABEL}</Link>“, widerrufen binnen 14 Tagen über „
          <Link to={WITHDRAW_PATH}>{WITHDRAW_BUTTON_LABEL}</Link>“.
        </p>
        <div className="button-row">
          <ButtonLink to="/">Inserat prüfen</ButtonLink>
          <ButtonLink to="/konto" variant="secondary">
            Zum Konto
          </ButtonLink>
        </div>
      </>
    );
  };

  return (
    <div className="container page page--narrow">
      <h1>Deine Bestellung</h1>
      {content()}
    </div>
  );
}
