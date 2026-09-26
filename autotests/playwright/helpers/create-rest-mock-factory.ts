import type { JsonValue, RestMockOptions } from '../types/mocking';
import { makeRestMock } from './make-rest-mock';

export function createRestMockFactory<TBody extends JsonValue>(defaults: RestMockOptions<TBody>) {
  const snapshot = structuredClone(defaults);
  return (overrides: Partial<RestMockOptions<TBody>> = {}) => makeRestMock({ ...snapshot, ...overrides });
}
