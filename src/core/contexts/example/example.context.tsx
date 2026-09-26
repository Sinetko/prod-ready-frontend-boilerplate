import { createContext, useContext, useMemo } from 'react';

import type { ExampleContextValue, ExampleProviderProps } from './example.types';

const ExampleContext = createContext<ExampleContextValue | undefined>(undefined);

const ExampleProvider = ({ children, label }: ExampleProviderProps) => {
  const value = useMemo(() => ({ label }), [label]);

  return <ExampleContext.Provider value={value}>{children}</ExampleContext.Provider>;
};

export const useExampleContext = (): ExampleContextValue => {
  const context = useContext(ExampleContext);

  if (!context) {
    throw new Error('useExampleContext must be used within ExampleProvider.');
  }

  return context;
};

export default ExampleProvider;
