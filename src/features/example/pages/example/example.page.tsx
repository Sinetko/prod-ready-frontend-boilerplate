import { useTranslation } from 'react-i18next';

import { useExample } from 'shared/hooks/use-example';
import { example } from 'shared/utils/example';

import { useExampleContext } from 'core/contexts/example';
import { shallow, useExampleStore } from 'core/stores/example';

export const ExamplePage = () => {
  const { t } = useTranslation('example');
  const { label } = useExampleContext();
  const { enabled, toggle } = useExample();
  const { count, increment, reset } = useExampleStore(
    ({ state, actions }) => ({ count: state.count, ...actions }),
    shallow
  );

  return (
    <main>
      <h1>{t('title')}</h1>
      <p>{t('greeting', { name: example(label) })}</p>
      <p aria-live="polite">{t('count', { count })}</p>
      <button type="button" onClick={increment}>
        {t('increment')}
      </button>
      <button type="button" onClick={reset}>
        {t('reset')}
      </button>
      <button type="button" onClick={toggle} aria-expanded={enabled} aria-controls="example-details">
        {t(enabled ? 'hideDetails' : 'showDetails')}
      </button>
      <p id="example-details" hidden={!enabled}>
        {t('details')}
      </p>
    </main>
  );
};
