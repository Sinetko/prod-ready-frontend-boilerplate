import type { GraphqlMockOptions, JsonValue } from '../types/mocking';
import { makeGqlMock } from './make-gql-mock';

export function createMockFactory<TData extends JsonValue>(defaults: GraphqlMockOptions<TData>) {
  const snapshot = structuredClone(defaults);
  return (overrides: Partial<GraphqlMockOptions<TData>> = {}) => makeGqlMock({ ...snapshot, ...overrides });
}
