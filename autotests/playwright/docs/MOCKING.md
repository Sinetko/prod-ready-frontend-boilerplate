# Factory-based API mocks

Import `test` and `expect` from `fixtures/fixtures.globalMocker`, never the raw Playwright test
for application specs. Its automatic fixture installs one `ApiMocker` per browser context before
navigation, verifies unexpected requests at teardown, and removes its own route handler in a finally
block. Register factories with `apiMocker.use(factory(overrides))` before the action that sends a request.
Do not write ad hoc `page.route`/`context.route` handlers in specs; they can bypass this enforcement.

`helpers/create-rest-mock-factory.ts` builds reusable REST factories from method, pathname and JSON
response defaults. `helpers/create-mock-factory.ts` does the same for GraphQL endpoint, operation name
and response envelope. They delegate to `make-rest-mock.ts` / `make-gql-mock.ts`. Factories snapshot
defaults and clone response objects per invocation; registration clones responses again. Overrides
replace fields rather than recursively merging them. The last matching registration wins and remains
active for the test. Registrations are not shared across tests.

```ts
import { test, expect } from '../fixtures/fixtures.globalMocker';
import { exampleRestMock } from '../mocks/example';

test('REST response', async ({ page, apiMocker }) => {
  apiMocker.use(exampleRestMock({ body: { message: 'custom' } }));
  await page.goto('/example');
  const body = await page.evaluate(async () => (await fetch('/api/example')).json());
  expect(body).toEqual({ message: 'custom' });
});
```

REST matches the exact pathname and case-normalized method; query strings and origin are ignored.
GraphQL supports single JSON POST envelopes and GET query parameters, parses the document, and
selects a named operation. A single named operation can omit `operationName`; multi-operation
documents require it. Optional `variables` match the complete object with deep equality; omit them
to accept any variables. Responses may contain `data`, `errors`, or both, with optional HTTP status
and headers. Batched requests, anonymous operations, persisted-query hashes without documents,
subscriptions and schema validation are not implemented. Malformed/unsupported requests do not match.

All unmatched browser fetch/XHR requests, plus requests to `/api`, `/api/**`, `/graphql` and
`/graphql/**`, are aborted and recorded. The automatic fixture then fails even if application code
catches the network error. Other asset/document requests fall through. Service workers are blocked
in the config so they cannot hide requests from routing. This is browser HTTP interception, not a
network sandbox: WebSockets, server-side calls and Playwright's separate `request` client are outside
its scope. Intentional API passthrough is not configured.

The sample app has no API traffic. `mocks/example.ts` and `tests/mocking.spec.ts` exercise synthetic
harness contracts via browser fetch; they do not claim backend integration coverage. Keep real
operation contracts in `graphql/` and reusable mock factories in `mocks/` when app APIs are introduced.

Verify with `npm test` and `npm run test:guard` from this package. The latter creates a temporary suite,
expects five real fixture failures (unknown API, wrong REST method, wrong variables, malformed GraphQL,
and cross-test leakage), checks their error messages, and removes the temporary files.

API references: [Playwright fixtures](https://playwright.dev/docs/test-fixtures),
[mocking](https://playwright.dev/docs/mock), and [network routing](https://playwright.dev/docs/network).
