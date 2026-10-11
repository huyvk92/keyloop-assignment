import 'i18next';
import type { en } from './resources/en';

/** Typed keys (ADR-009): `t()` only accepts keys that exist in the English resources. */
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof en };
  }
}
