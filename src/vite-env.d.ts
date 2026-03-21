/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ADSENSE_CLIENT_ID: string;
  readonly VITE_ADSENSE_SLOT_SIDEBAR: string;
  readonly VITE_ADSENSE_SLOT_REPORT: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
