import type { LegalContext } from '@kaufcheck/shared';

/** Operator details from build-time environment variables (see .env.example). */
function lines(value: string | undefined): string[] {
  return (value ?? '')
    .split(/\||\\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export const IMPRINT = {
  name: import.meta.env.VITE_IMPRINT_NAME?.trim() ?? '',
  address: lines(import.meta.env.VITE_IMPRINT_ADDRESS),
  email: import.meta.env.VITE_CONTACT_EMAIL?.trim() ?? '',
  phone: import.meta.env.VITE_CONTACT_PHONE?.trim() ?? '',
};

export const IMPRINT_COMPLETE = Boolean(
  IMPRINT.name && IMPRINT.address.length > 0 && IMPRINT.email,
);

/** Contracts need name, address, e-mail and phone of the operator (Art. 246a § 1 EGBGB). */
export const CONTRACT_DETAILS_COMPLETE = IMPRINT_COMPLETE && Boolean(IMPRINT.phone);

/** The site's public address as named in the legal texts (no trailing slash). */
export const SITE_URL = (import.meta.env.PUBLIC_SITE_URL ?? 'http://localhost:5173').replace(
  /\/+$/,
  '',
);

/** Operator and site address for the contract documents (AGB, Widerrufsbelehrung). */
export const LEGAL_CONTEXT: LegalContext = {
  operator: {
    name: IMPRINT.name,
    addressLines: IMPRINT.address,
    email: IMPRINT.email,
    phone: IMPRINT.phone,
  },
  siteUrl: SITE_URL,
};
