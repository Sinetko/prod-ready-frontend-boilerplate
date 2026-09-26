import type { namespaceMap } from 'bootstrap/namespace-map';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'example';
    resources: typeof namespaceMap;
  }
}
