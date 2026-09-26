import { StrictMode } from 'react';

import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';

import ExampleProvider from 'core/contexts/example';

import { ExamplePage } from 'features/example/pages/example';

import { i18n, i18nReady } from 'bootstrap/i18n';

const root = document.getElementById('root');

if (!root) {
  throw new Error('The application root element is missing.');
}

void i18nReady.then(() => {
  createRoot(root).render(
    <StrictMode>
      <I18nextProvider i18n={i18n}>
        <ExampleProvider label="World">
          <ExamplePage />
        </ExampleProvider>
      </I18nextProvider>
    </StrictMode>
  );
});
