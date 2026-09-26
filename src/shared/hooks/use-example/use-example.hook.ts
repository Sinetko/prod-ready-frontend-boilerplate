import { useCallback, useState } from 'react';

import type { UseExampleOptions, UseExampleResult } from './use-example.types';

export const useExample = ({ initialEnabled = false }: UseExampleOptions = {}): UseExampleResult => {
  const [enabled, setEnabled] = useState(initialEnabled);
  const toggle = useCallback(() => setEnabled((previous) => !previous), []);
  const reset = useCallback(() => setEnabled(initialEnabled), [initialEnabled]);

  return { enabled, toggle, reset };
};
