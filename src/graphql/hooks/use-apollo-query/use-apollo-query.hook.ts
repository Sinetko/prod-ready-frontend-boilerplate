import { useQuery } from '@apollo/client/react';

// Preserve Apollo's overloads, including required variables and skipToken.
// This assertion is safe while every argument and the result pass through unchanged.
export const useApolloQuery = ((...args: Parameters<typeof useQuery>) => useQuery(...args)) as typeof useQuery;
