import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import { namespaceMap } from './namespace-map';

export const i18n = createInstance();

export const i18nReady = i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  ns: Object.keys(namespaceMap),
  defaultNS: 'example',
  resources: { en: namespaceMap },
  interpolation: { escapeValue: false },
});
