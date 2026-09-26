# Playwright autotests

These tests run as part of the main repository's GitLab CI and GitHub Actions pipelines.
For the dedicated Docker image and CI reports, see [Containers and CI](../../docker/README.md).

This is an independent npm package with its own lockfile, lint config and TypeScript project. Root
lint and Vitest do not validate these tests. Install root dependencies first for the Vite app, then:

```sh
npm --prefix autotests/playwright ci
npm --prefix autotests/playwright run install:browsers
npm --prefix autotests/playwright run lint
npm --prefix autotests/playwright test
npm --prefix autotests/playwright run test:guard
```

Chromium is the initial browser. The config starts the repository Vite server at `127.0.0.1:4173`
with a strict port and refuses to reuse another process, so a run cannot silently target the wrong
app. Tests currently exercise the example rendered at `/example`; the app does not yet implement
route-based page switching. `test:list` lists cases without launching a browser, and `test:ui` opens
the interactive runner. CI uses the same commands (install Chromium's OS dependencies when needed);
focused tests are rejected in CI. Reports, traces and TypeScript/ESLint caches are ignored by Git.

Playwright 1.63's bundled Chromium installer rejects this workspace's macOS 13. For local verification
on that machine, use an already installed Chrome with `PLAYWRIGHT_CHANNEL=chrome` before both `test`
and `test:guard` commands. This selects Playwright's Chrome channel with an isolated temporary profile;
it does not use your browsing profile or silently change the default browser. On a supported host, use
the bundled Chromium install command above. See [browser channels](https://playwright.dev/docs/browsers).

## Naming and ownership

Specs use `tests/**/*.spec.ts`, without a legacy/redesign suffix. TestRail IDs are optional literal
per-test Playwright tags: `{ tag: '@C123' }` or `{ tag: ['@C123', '@smoke'] }`. Use only real assigned
positive case IDs; the examples intentionally have none. Do not put IDs only in titles or dynamically
construct/inherit TestRail tags: the static graph indexes literal per-test metadata only. No TestRail
reporter, account, credentials or external publication is configured.

| Directory | Responsibility |
| --- | --- |
| app/ | Cross-page application facade when needed |
| components/ | Reusable browser component facades |
| docs/ | Test conventions and mocking contracts |
| fixtures/ | Playwright fixtures and automatic API mock lifecycle |
| graphql/ | GraphQL request parsing and future operation contracts |
| helpers/ | Mock factories, builders and routing lifecycle |
| mocks/ | Reusable scenario factories |
| pages/ | Page facades; example selectors and actions |
| scripts/ | Harness verification tools |
| tests/ | Browser specs |
| types/ | Shared test contracts |
| utils/ | Generic test utilities when needed |

Use the [mocking guide](docs/MOCKING.md) and the extended `test` fixture in every app spec. Keep this
project independent of `src/` imports; use browser behavior and explicit API contracts rather than
bringing application internals into the test compiler. Generic/page/component test facades are ordinary
test modules, not app `.page.tsx`/`.component.tsx` artefacts.

## Graph lookup

Run from the repository root after `npm run graph-generate`:

```sh
npm run graph -- --scope autotests --facade ExamplePage
npm run graph -- --scope autotests --mock exampleRestMock
npm run graph -- --scope autotests --coverage autotests/playwright/pages/example.ts
npm run graph -- --scope autotests --testrail C123
```

Each query parses one selected graph. `--path` filters evidence; standard symbol/dependency selectors
also accept the scope. `--strict` audits the entire repository's freshness/integrity, including these
graphs. Missing real TestRail cases correctly yield zero records. `--coverage` means static transitive
test imports, not execution or feature/line coverage. Facades are class declarations in app/pages/
components; mocks are directly named createMockFactory/createRestMockFactory variable initializers.
Consumers mean a test imports the defining module, possibly transitively; they do not prove the
particular factory/class was called. Dynamic tags, factory aliases and runtime paths are not inferred.
