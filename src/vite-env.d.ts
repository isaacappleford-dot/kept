/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** URL of the Kept reminders server (server/), set at build time. Empty = on-open notifications only. */
  readonly VITE_PUSH_URL?: string;
}
