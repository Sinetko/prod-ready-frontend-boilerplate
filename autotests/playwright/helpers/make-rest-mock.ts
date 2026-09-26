import type { JsonValue, MockDefinition, RestMockOptions } from '../types/mocking';

export function makeRestMock<TBody extends JsonValue>(options: RestMockOptions<TBody>): MockDefinition {
  if (!options.path.startsWith('/')) throw new Error('REST mock path must start with /.');
  const method = options.method.toUpperCase();
  const path = options.path;
  return {
    name: `${method} ${path}`,
    matches: (request) => request.method() === method && new URL(request.url()).pathname === path,
    response: structuredClone({ body: options.body, status: options.status, headers: options.headers }),
  };
}
