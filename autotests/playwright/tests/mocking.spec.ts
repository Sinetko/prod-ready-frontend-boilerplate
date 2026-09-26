import { test, expect } from '../fixtures/fixtures.globalMocker';
import { exampleGraphqlMock, exampleRestMock } from '../mocks/example';

test('REST factories support isolated responses, overrides, status and headers', async ({ page, apiMocker }) => {
  const mock = exampleRestMock({ body: { message: 'first' } });
  apiMocker.use(mock);
  mock.response.body = { message: 'mutated after registration' };
  await page.goto('/example');
  expect(await page.evaluate(async () => (await fetch('/api/example')).json())).toEqual({ message: 'first' });
  apiMocker.use(exampleRestMock({ status: 201, headers: { 'x-mock': 'yes' }, body: { message: 'last wins' } }));
  const result = await page.evaluate(async () => {
    const response = await fetch('/api/example?ignored=yes');
    return { status: response.status, header: response.headers.get('x-mock'), body: await response.json() };
  });
  expect(result).toEqual({ status: 201, header: 'yes', body: { message: 'last wins' } });
  expect(exampleRestMock().response.body).toEqual({ message: 'Hello from REST' });
});

test('GraphQL factories match operation names and exact variables', async ({ page, apiMocker }) => {
  apiMocker.use(exampleGraphqlMock({ variables: { id: 'one' }, body: { data: { status: 'custom' } } }));
  await page.goto('/example');
  const result = await page.evaluate(async () => {
    const response = await fetch('/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        operationName: 'ExampleStatus',
        query: 'query ExampleStatus($id: ID!) { status(id: $id) }',
        variables: { id: 'one' },
      }),
    });
    return response.json();
  });
  expect(result).toEqual({ data: { status: 'custom' } });
});

test('GraphQL GET infers a single named operation and can return errors', async ({ page, apiMocker }) => {
  apiMocker.use(exampleGraphqlMock({ body: { errors: [{ message: 'Unavailable' }] } }));
  await page.goto('/example');
  const result = await page.evaluate(async () => {
    const params = new URLSearchParams({ query: 'query ExampleStatus { status }' });
    return (await fetch(`/graphql?${params}`)).json();
  });
  expect(result).toEqual({ errors: [{ message: 'Unavailable' }] });
});

test('GraphQL selects an operation from a multi-operation document', async ({ page, apiMocker }) => {
  apiMocker.use(exampleGraphqlMock());
  await page.goto('/example');
  const result = await page.evaluate(async () =>
    (
      await fetch('/graphql', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          operationName: 'ExampleStatus',
          query: 'query Another { other } query ExampleStatus { status }',
        }),
      })
    ).json()
  );
  expect(result).toEqual({ data: { status: 'ready' } });
});
