import { isDeepStrictEqual } from 'node:util';
import { readOperation } from '../graphql/read-operation';
import type { GraphqlMockOptions, JsonValue, MockDefinition } from '../types/mocking';

export function makeGqlMock<TData extends JsonValue>(options: GraphqlMockOptions<TData>): MockDefinition {
  const snapshot = structuredClone(options);
  if (!snapshot.endpoint.startsWith('/')) throw new Error('GraphQL endpoint must start with /.');
  if (!/^[_A-Za-z][_0-9A-Za-z]*$/.test(snapshot.operation)) throw new Error('Expected a named GraphQL operation.');
  return {
    name: `${snapshot.endpoint} ${snapshot.operation}`,
    matches(request) {
      if (new URL(request.url()).pathname !== snapshot.endpoint) return false;
      const operation = readOperation(request);
      return (
        operation?.name === snapshot.operation &&
        (snapshot.variables === undefined || isDeepStrictEqual(operation.variables, snapshot.variables))
      );
    },
    response: { body: snapshot.body, status: snapshot.status, headers: snapshot.headers },
  };
}
