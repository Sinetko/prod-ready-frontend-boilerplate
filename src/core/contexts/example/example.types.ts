import type { ReactNode } from 'react';

export interface ExampleContextValue {
  label: string;
}

export interface ExampleProviderProps {
  children: ReactNode;
  label: string;
}
