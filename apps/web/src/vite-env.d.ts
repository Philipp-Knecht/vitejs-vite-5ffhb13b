/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_IMPRINT_NAME?: string;
  readonly VITE_IMPRINT_ADDRESS?: string;
  readonly VITE_CONTACT_EMAIL?: string;
  /** `none` (default) or `placeholder` (labelled boxes for layout work). */
  readonly VITE_ADS_PROVIDER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
