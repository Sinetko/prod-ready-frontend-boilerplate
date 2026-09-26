import { useMutation } from '@apollo/client/react';

// Preserve Apollo's typed-document inference and mutation options.
export const useApolloMutation = ((...args: Parameters<typeof useMutation>) =>
  useMutation(...args)) as typeof useMutation;
