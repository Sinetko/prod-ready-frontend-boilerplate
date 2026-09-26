import { useLazyQuery } from '@apollo/client/react';

// Preserve document inference and the execute function's required variables.
// This assertion is safe while every argument and the result pass through unchanged.
export const useApolloLazyQuery = ((...args: Parameters<typeof useLazyQuery>) =>
  useLazyQuery(...args)) as typeof useLazyQuery;
