/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_IMPRINT_NAME?: string;
  readonly VITE_IMPRINT_ADDRESS?: string;
  readonly VITE_CONTACT_EMAIL?: string;
  /** Required for paid contracts (Art. 246a § 1 Abs. 1 Nr. 3 EGBGB). */
  readonly VITE_CONTACT_PHONE?: string;
  /** Public address of the site, e.g. https://kaufcheck.onrender.com. */
  readonly PUBLIC_SITE_URL?: string;
  /** `none` (default) or `placeholder` (labelled boxes for layout work). */
  readonly VITE_ADS_PROVIDER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
