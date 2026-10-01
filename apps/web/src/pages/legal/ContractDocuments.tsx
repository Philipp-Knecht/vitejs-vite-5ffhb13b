import {
  termsOfService,
  WITHDRAW_BUTTON_LABEL,
  WITHDRAW_PATH,
  withdrawalForm,
  withdrawalPolicy,
} from '@kaufcheck/shared';
import { Alert } from '../../components/ui/Alert';
import { ButtonLink } from '../../components/ui/Button';
import { STATIC_PAGE_META } from '../../seo/pages';
import { usePageMeta } from '../../seo/use-page-meta';
import { documentsText } from './legal-text';
import { LegalDocumentView, SaveButtons } from './LegalDocument';
import { CONTRACT_DETAILS_COMPLETE, LEGAL_CONTEXT } from './site-info';

function MissingDetails() {
  if (CONTRACT_DETAILS_COMPLETE) return null;
  return (
    <Alert tone="warning" title="Angaben zum Betreiber fehlen">
      <p>
        Für Verträge müssen Name, Anschrift, E-Mail-Adresse und Telefonnummer des Betreibers
        eingetragen sein (VITE_IMPRINT_NAME, VITE_IMPRINT_ADDRESS, VITE_CONTACT_EMAIL,
        VITE_CONTACT_PHONE).
      </p>
    </Alert>
  );
}

export function TermsPage() {
  usePageMeta(STATIC_PAGE_META['/agb'] ?? { title: 'AGB', description: '', noindex: true });
  const terms = termsOfService(LEGAL_CONTEXT);
  return (
    <div className="container page page--narrow prose">
      <MissingDetails />
      <LegalDocumentView document={terms} />
      <SaveButtons fileName="kaufcheck-pro-agb.txt" text={() => documentsText([terms])} />
    </div>
  );
}

export function WithdrawalPolicyPage() {
  usePageMeta(
    STATIC_PAGE_META['/widerrufsbelehrung'] ?? {
      title: 'Widerrufsbelehrung',
      description: '',
      noindex: true,
    },
  );
  const policy = withdrawalPolicy(LEGAL_CONTEXT);
  const form = withdrawalForm(LEGAL_CONTEXT);
  return (
    <div className="container page page--narrow prose">
      <MissingDetails />
      <LegalDocumentView document={policy} />
      <div className="legal-callout">
        <p>Am schnellsten widerrufst du online – ohne Formular und ohne Anmeldung.</p>
        <ButtonLink to={WITHDRAW_PATH} variant="secondary">
          {WITHDRAW_BUTTON_LABEL}
        </ButtonLink>
      </div>
      <LegalDocumentView document={form} level={2} />
      <SaveButtons
        fileName="kaufcheck-pro-widerrufsbelehrung.txt"
        text={() => documentsText([policy, form])}
      />
    </div>
  );
}
