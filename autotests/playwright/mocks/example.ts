import { createMockFactory } from '../helpers/create-mock-factory';
import { createRestMockFactory } from '../helpers/create-rest-mock-factory';

// Test-harness contracts only: the example application does not call either API.
export const exampleRestMock = createRestMockFactory({
  method: 'GET',
  path: '/api/example',
  body: { message: 'Hello from REST' },
});

export const exampleGraphqlMock = createMockFactory({
  endpoint: '/graphql',
  operation: 'ExampleStatus',
  body: { data: { status: 'ready' } },
});
