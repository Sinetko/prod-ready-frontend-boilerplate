# Frontend Architecture Reference

A React and TypeScript reference project that demonstrates how I structure frontend applications:
explicit module boundaries, typed data contracts, repeatable development workflows, and automated
checks that keep those decisions intact as the codebase changes.

The example UI is intentionally small. The focus is the engineering around it: how features are
organized, how shared code evolves, how changes are verified, and how another developer can work in
the repository without relying on undocumented conventions.

**Core stack:** React · TypeScript · Vite + SWC · Apollo Client + GraphQL Code Generator · Zustand +
Immer · styled-components · i18next · Vitest + Testing Library · Playwright · Docker

## Architectural approach

I organize the application around business features, with a layered dependency model underneath.
A feature owns its pages and domain behavior; reusable code moves into a lower layer only when its
responsibility warrants sharing. Folder names establish ownership, and import guards enforce the
allowed direction of dependencies.

The distinction between `shared/` and `business-commons/` is deliberate. A generic formatting utility
should not know about product concepts. A component shared by several business domains may need that
knowledge. Keeping these responsibilities separate prevents the generic layer from becoming an
implicit dependency on the entire application.

```text
src/
├── app/                 Application composition
├── bootstrap/           Initialization and translation registration
├── features/            Business domains and their pages
├── templates/           Reusable page structures
├── core/                App-wide contracts, stores, contexts and routing metadata
├── business-commons/    Shared business-level building blocks
├── graphql/             Operations, fragments, client wrappers and generated contracts
├── shared/              Feature-agnostic components, hooks, utilities and types
├── theme/               Theme boundary
├── assets/              Static resources
├── types/               Global TypeScript declarations
├── vite/                Common, development and production build configuration
└── __mocks__/           Module mocks
```

Higher layers can depend on their permitted lower layers. Lower layers cannot reach into features,
and features cannot import another feature's implementation. The [dependency policy](#guard-scripts)
is explicit and checked for imports and re-exports, including relative paths. This is a project-specific
layered architecture; the directory structure does not imply an implementation of every DDD or Clean
Architecture concept.

## Patterns and engineering decisions

| Area | Approach | Reason |
| --- | --- | --- |
| Module interfaces | Small modules with explicit barrel exports and colocated types | Give consumers a clear entry point and keep related contracts together. |
| UI composition | Components compose hooks and domain behavior; nontrivial helpers get their own modules | Keep rendering code readable and responsibilities independently testable. |
| Local state | React state and custom hooks | Keep state close to its owner until sharing is necessary. |
| Shared client state | Zustand stores separate `state` from `actions`, use Immer and named devtools actions | Make state transitions explicit and easier to inspect. |
| Scoped dependencies | Context providers expose a dedicated consumer hook that checks for a missing provider | Make provider assumptions visible at the usage boundary. |
| Server-data contracts | Schema-generated typed documents consumed through project-owned Apollo wrappers | Preserve variable/result inference and provide a consistent integration point. |
| Localization | Resources live beside their page and register through a typed namespace map | Keep copy ownership local while checking keys and namespaces centrally. |
| Build configuration | Common Vite configuration merged with development or production settings | Share the baseline while keeping environment-specific behavior explicit. |

Handwritten hooks, helpers, utilities and components in `src/` use arrow functions. Generated code
follows the generator's output. File splitting follows responsibility: nontrivial props belong in a
separate types file, constants stay near their owner, and long event handlers move into a hook or utility.

Apollo wrappers retain the underlying client's typing and behavior; they are an integration boundary,
not a promise that replacing the client would be free. Likewise, a barrel defines an intended module
interface, but it is not a package-level access restriction.

## Conventions backed by tooling

I treat repeated project conventions as executable workflows. Scaffolders create canonical module
shapes, register page paths and translation namespaces, and generate schema-aware GraphQL operations.
They support interactive use and explicit automation flags, preserve identical existing files, and
reject conflicting output instead of overwriting a developer's work.

Static checks cover layer boundaries, raw Apollo hook usage, operation-hook naming, shared-code test
presence, icon references, tool-version consistency and translation keys. ESLint, TypeScript, Stylelint
and Knip cover complementary concerns. These checks run through local commands and CI; pre-commit
also checks repository guards and documentation drift.

The purpose is to make routine changes predictable and reduce review time spent on conventions.
The tradeoff is maintaining the tooling itself, so scaffolders and guards have their own behavior and
regression tests. Shared-code test presence is not a coverage percentage or proof of test quality.

## Verification strategy

- **Unit and integration tests:** Vitest and Testing Library exercise hooks, utilities, stores,
  provider contracts and page interactions, including how canonical modules compose.
- **Browser tests:** the independent `autotests/playwright/` package owns its dependencies, TypeScript
  configuration and lint rules. It tests the running example application and the mock infrastructure.
- **API isolation:** reusable REST/GraphQL mock factories replace per-test routing setup. Unexpected
  browser API requests fail fixture teardown; negative scenarios verify that this guard actually fails.
- **Delivery checks:** GitLab CI and GitHub Actions include autotests in the main repository pipeline,
  build both Docker images, and retain build or test artifacts. The application image serves Vite output
  through Nginx; the test image contains the browser version selected by the Playwright lockfile.

See [Containers and CI](docker/README.md) and the [Playwright guide](autotests/playwright/README.md)
for commands, reports and runner requirements.

## Documentation and AI-assisted development

Architecture also needs to remain discoverable. The repository includes CLI-generated context graphs
for focused symbol and dependency lookups, plus a GraphQL extraction command for inspecting individual
contracts without opening large generated files.

Feature documentation uses a unit registry, source fingerprints and evidence references. Drift checks
identify documents that need review after code changes; they cannot prove that every written claim is
semantically correct. [AGENTS.md](AGENTS.md), scoped guidance and Claude workflows document the same
project conventions for assisted development, with runtime-specific enforcement limits stated explicitly.

The same lint, tests and portable guards remain available to developers working without an AI tool.

## Scope and tradeoffs

This repository is an architecture example, not a finished product or a claim of production operation.
The local GraphQL schema is illustrative, no backend client endpoint is configured, and the route map
is metadata rather than an installed router. Several architectural directories reserve ownership
boundaries for future application code.

The structure is intended for applications where multiple features and contributors justify explicit
boundaries and automation. A small interface may need fewer layers and less tooling. Product-specific
choices—authentication, real API integration, observability, deployment and localization policy—must
be made against actual requirements. Browser mocks do not establish backend compatibility; CI
configuration alone does not configure required merge checks or deploy an application.

## Explore the repository

| Start here | What it demonstrates |
| --- | --- |
| [Example page](src/features/example/pages/example/) | Composition, translations and a small interactive feature |
| [Example store](src/core/stores/example/) | State/action separation and immutable updates |
| [GraphQL hooks](src/graphql/hooks/) | Typed client integration boundaries |
| [Scaffolders](#scaffolders) | Repeatable module creation and registration |
| [Guard scripts](#guard-scripts) | Executable dependency and convention policies |
| [Browser tests](autotests/playwright/) | Separate test project and reusable mock factories |
| [Documentation system](docs/README.md) | Evidence, freshness checks and review workflow |
| [Architecture history](docs/ARCHITECTURE_HISTORY.md) | Recorded implementation decisions and verification |

The sections below contain setup instructions and implementation details.

## Tooling setup

Use Node 24 and npm 12; exact versions are pinned in `package.json`.
With Volta installed, install the pinned tools:

```sh
volta install node@24.21.0 npm@12.1.0
npm ci
npm run lint:knip
```

`npm ci` runs Husky's `prepare` script to register the Git hooks. The
pre-commit hook runs Knip and the guard scripts to detect unused code and convention violations.
Run `npm run lint` for ESLint (including Prettier), all three TypeScript projects,
Stylelint, Knip, and the guard scripts.

GraphQL linting uses `@graphql-eslint/eslint-plugin`: the originally specified
`eslint-plugin-graphql@4` has a GraphQL peer range that excludes GraphQL 16.
Its [code-file processor](https://the-guild.dev/graphql/eslint/docs/usage/js)
validates tagged GraphQL templates alongside standalone documents using
`graphql.config.ts`. Codegen output is excluded from handwritten-code ESLint
rules; Knip skips only its generated export/type reports and still follows its
dependencies. The SWC plugin's required `useAtYourOwnRisk_mutateSwcOptions` name
has one documented naming-rule exception.

Architecture decisions and verification history are recorded in
[docs/ARCHITECTURE_HISTORY.md](docs/ARCHITECTURE_HISTORY.md).

## Build tooling

The root `vite.config.ts` merges `src/vite/config/common.ts` with `dev.ts`
for the serve command or `build.ts` for production. The React SWC plugin
explicitly loads the project `.swcrc` in both modes. Vite 8's native
`resolve.tsconfigPaths` enables the TypeScript import configuration.
SVGR supports component imports ending in `?react`; EJS supplies the HTML title.
Production adds legacy bundles, HTML minification, and compressed assets using
the plugins' default settings.

Build dependencies are installed and recorded in `package-lock.json`. Run:

```sh
npm ci
npm run dev
npm run build
npm run preview
```

Development HTTP serving, SWC transforms, and the production build have passed
verification, including legacy bundles and Brotli/gzip output.
`npm run lint:types` checks the app, scaffolder, and Vite TypeScript projects.
The app and scaffolder retain `moduleResolution: "node"`; `tsconfig.vite.json`
uses `"bundler"` to resolve Vite's export-based types. The root config excludes
Vite files (inherited by the scaffolder config), and the Vite config explicitly
includes them with its own incremental build cache.
Vite also reports an advisory about the current CommonJS package layout and a
future native config-loader default; the current bundled loader builds successfully.

## GraphQL

Run `npm run generate-code` after editing the schema or GraphQL documents.
`schema.graphql` is a trivial local bootstrap schema, not a deployed API contract.
Replace it with the real API schema when available. `graphql.config.ts` provides
the same schema and document paths to editor tooling; `codegen.yml` configures generation.

Apollo Client 4 uses generated typed documents instead of generated React hooks.
The approved generator replacement is `@graphql-codegen/typed-document-node`.
Import `BootstrapDocument` from `graphql/graphql-api-types` and pass it to
`useApolloQuery` from `graphql/hooks/use-apollo-query`, or `useApolloLazyQuery`
from `graphql/hooks/use-apollo-lazy-query`. For example:

```ts
const result = useApolloQuery(BootstrapDocument, { variables: { name: 'World' } });
```

The query wrappers preserve Apollo's overloads and typed-document inference. Application
query code must use these entry points instead of importing Apollo's raw hooks.
They use the client's existing `ApolloProvider` (or an explicit `client` option);
the boilerplate does not configure a backend URL or network client.

`src/graphql/graphql-api-types.ts`, `src/graphql/schema.graphql`, and
`src/graphql/schema.graphql.json`, and `src/graphql/documents.graphql` are generated
outputs. Never hand-edit them or read them wholesale. `npm run generate-code`
runs codegen and extracts named documents into `documents.graphql`; use the
extraction commands below to inspect individual blocks. Keep operation sources under the GraphQL
fragments/queries/mutations directories; generated output is excluded from discovery.

## Canonical examples

The handwritten examples define the canonical shapes used by the scaffolders:

| Artefact | Location |
| --- | --- |
| Hook | `src/shared/hooks/use-example/` |
| Utility | `src/shared/utils/example/` |
| Store | `src/core/stores/example/` |
| Context | `src/core/contexts/example/` |
| Page and translations | `src/features/example/pages/example/` |
| Fragment (flat file) | `src/graphql/fragments/example.fragment.ts` |

The app renders `ExamplePage` through its barrel with `ExampleProvider` and
`I18nextProvider`. The page demonstrates the toggle hook, whitespace utility,
and counter store. The store separates `state` and `actions`, uses
`createWithEqualityFn` with devtools and Immer, exports `shallow`, and names
devtools actions `example/increment` and `example/reset`.
The context barrel exports the default provider, named consumer hook, and types.

Translations stay beside their page in `example.translations.ts`. The bootstrap
i18next instance registers the `example` namespace with English example copy;
`src/types/i18next.d.ts` provides key typing. This example does not establish a
product-wide locale list. `src/bootstrap/namespace-map.ts` supplies both runtime
namespace registration and the augmented i18next types. Page generation registers
paths in `src/core/routing/routing.model.ts`; this map does not install a router. The fragment uses the existing bootstrap `Query.hello` field;
run codegen after editing it, as with any GraphQL document.

Run `npm test` for the Vitest suite or `npm run test:watch` during development.
React Testing Library supplies hook/component rendering in jsdom. Tests exercise
hook state transitions, utility edge cases, provider behavior, immutable store
updates, page interactions, translations, and fragment/schema compatibility.
The integration test also verifies that the canonical barrels resolve, their
exported types compile, and both Apollo wrappers consume generated documents.


## Scaffolders

Run a generator without flags for interactive `prompts()` questions. Automation
must pass `--non-interactive` and every required flag; missing flags and unknown
flags exit with an error instead of waiting for input. Names and page groups use
kebab-case; hook names include `use-`. Paths are repo-relative parent directories
inside `src/`, with traversal and symlink escapes rejected.

| Command | Required flags | Additional flags |
| --- | --- | --- |
| `npm run generate-hook --` | `--name use-toggle --path src/shared/hooks` | `--non-interactive` |
| `npm run generate-util --` | `--name normalize --path src/shared/utils` | `--non-interactive` |
| `npm run generate-store --` | `--name counter --path src/core/stores` | `--non-interactive` |
| `npm run generate-context --` | `--name account --path src/core/contexts` | `--non-interactive` |
| `npm run generate-component --` | `--name panel --path src/shared/components` | `--non-interactive` |
| `npm run generate-page --` | `--name details --group example --route /details --namespace details` | `--non-interactive` |
| `npm run generate-query --` | `--name greeting --field hello` | `--lazy` or `--mutation`, `--schema schema.graphql`, `--non-interactive` |
| `npm run generate-fragment --` | `--name query-fields --type Query` | `--schema schema.graphql`, `--non-interactive` |

For example:

```sh
npm run generate-query -- --non-interactive --name greeting --field hello
npm run generate-page -- --non-interactive --name details --group example --route /details --namespace details
```

Hook, util, store, context, and page generators clone the canonical examples.
Pages retain the working example dependencies and copy; replace them with domain
behavior after generation. Components get a barrel and separate props type.
Translations remain beside the page. A page's camelCase name is its `routePaths`
key, and its explicitly supplied namespace is its `namespaceMap` key. Conflicting
route paths, keys, and namespaces are rejected. Registrations use TypeScript AST
positions to preserve existing entries. The namespace map permits quoted keys
and disables the long-line rule for its potentially large registry rows.

All output is formatted before writing. Identical files are left untouched,
missing files are restored, and differing existing files cause an error before
any writes. Scaffolders never overwrite subsequent application edits. Registry
files are the deliberate exception: page generation adds or verifies its entries.

GraphQL operations produce `<name>.tag.ts`, `<name>.hook.ts`, and `index.ts` under
`src/graphql/queries/<name>/` or `src/graphql/mutations/<name>/`. Hooks are named
`use<Name>Query`, `use<Name>LazyQuery`, or `use<Name>Mutation`; they use the
project-owned Apollo wrappers and generated typed documents. `useApolloMutation`
lives under `src/graphql/hooks/use-apollo-mutation/`. Do not call raw Apollo hooks
from application code. Query options require variables when the schema does;
lazy query execution and mutation execution use Apollo's normal options API.

Selection sets are derived from the schema. They include scalar/enum fields and
nested composite fields up to two levels, with `__typename` for safe terminal
selections. Nested fields requiring arguments are omitted; refine the generated
document for the actual screen. A sole `input: SomeInput!` argument is flattened
into variables for the input object's fields, preserving field defaults.
Fragments are flat `<name>.fragment.ts` files. Generation validates the new
document and invokes codegen plus document extraction. A codegen failure returns
an error and leaves the scaffold available to fix and rerun. `--schema` overrides
codegen's schema for that invocation; it must support all existing documents.
The bootstrap schema has no mutation field, so mutation generation needs a real
schema or a fixture (the verification suite supplies one).

Document extraction supports `.graphql` sources and literal `gql` templates in
`.ts`/`.tsx` sources. Use GraphQL fragment spreads; JavaScript interpolation in
`gql` templates is rejected with a clear error. Anonymous operations and duplicate
names within the same document kind are rejected.

```sh
npm run graphql-extract -- --name Query
npm run graphql-extract -- --operation Bootstrap
npm run graphql-extract -- --fragment Example
npm run graphql-extract -- --pattern '^Query$'
npm run graphql-extract -- --path 'src/graphql/fragments/*.fragment.ts'
npm run graphql-extract -- --ts-type BootstrapQuery
```

Choose exactly one selector. `--name` and `--pattern` search schema definitions;
`--operation` and `--fragment` search named source documents; `--path` selects
source documents by glob; `--ts-type` selects a generated type/interface/enum.
Parsing happens inside the CLI; no agent needs to open the full generated files.
No match is an error. Run `npm run test:scaffolders` for isolated end-to-end
verification of generated shapes, idempotence, overwrite/path protection, page
registration, GraphQL variants, extraction, and generated TypeScript/ESLint checks.

## Guard scripts

Run `npm run lint:guards` to run all seven guards, or invoke any `npm run check-*`
command below individually. `npm run lint` includes the guards; Husky pre-commit
runs Knip and the guards. Each check exits nonzero with file-specific diagnostics
on violations. Run commands from the repository root. No checks write source files.
`npm run test:guards` tests valid and invalid fixtures, including actual CLI exit codes.

| Command suffix (`npm run check-…`) | Purpose |
| --- | --- |
| `import-from-src` | Enforce the layer dependency table below, including relative imports and re-exports. |
| `apollo-hooks` | Reject raw Apollo data hooks outside their exact project wrapper implementations. |
| `graphql-hook-naming` | Require one exported `use<Name>Query`, `use<Name>LazyQuery`, or `use<Name>Mutation` in each operation hook file. |
| `changed-shared-coverage` | Require tests importing changed shared/business-commons implementation modules. |
| `used-icons` | Report unreferenced image files under `src/assets/icons/`. |
| `engines-versions` | Validate exact Volta pins against semver engine ranges and npm's packageManager pin. |
| `problem-translation-keys` | Find duplicate resource/namespace keys and missing statically referenced translation keys. |

Layer dependencies are explicit. Every layer can import itself; a feature may
only import its own domain. Tests (`*.spec.*` / `*.test.*`) may cross boundaries
for integration coverage. External packages are unaffected. Generated API types
are excluded from source scanning. The existing `src/types/i18next.d.ts` import
of `bootstrap/namespace-map` is a narrow exception for ambient namespace typing.

| Layer | Other allowed source layers |
| --- | --- |
| assets, types | None |
| shared | assets, types |
| theme | assets, types, shared |
| graphql | assets, types, shared, theme |
| business-commons | assets, types, shared, theme, graphql |
| core | assets, types, shared, theme, graphql, business-commons |
| templates | assets, types, shared, theme, graphql, business-commons, core |
| features | assets, types, shared, theme, graphql, business-commons, core, templates |
| bootstrap | All layers above, including features |
| app | All layers above, including bootstrap |
| vite | None |
| __mocks__ | App/runtime layers above |

Apollo type-only imports remain allowed for the scaffolders' options types.
Named runtime imports such as `gql`, `ApolloProvider`, and `ApolloClient` are allowed.
Namespace/default imports, star re-exports, and dynamic Apollo imports are rejected
because they can hide raw hook access. Subscription/suspense/fragment data hooks
need a project wrapper and an explicit policy extension before use.

Shared coverage is a **test-presence check**, not an execution-coverage percentage.
A runnable `test`/`it` in a test file must import the changed implementation directly
or through barrel re-exports. Skipped-only tests and type-only imports do not count.
Pure export barrels, declarations, types, and translation resource files are exempt.
By default the guard compares the working tree (including staged and untracked
files) with HEAD. In a new repository without HEAD, it checks all present files.
For CI, use `npm run check-changed-shared-coverage -- --base <base-branch-or-sha>`;
it compares against the merge-base and fails if that revision is unavailable.
Fetch the base history in shallow CI checkouts. Deleted implementations need no test.
The pre-commit check examines the working tree, not an isolated snapshot of the index.

Icon assets are SVG, PNG, JPEG, WebP, GIF, AVIF, and ICO files specifically under
`src/assets/icons/`. Static imports (including `?react`), literal URLs in source,
and standalone CSS `url()` references count. Dynamic icon selection should use
an explicit registry of static imports. Images outside this directory are not icons
for this check. This checks references, not whether a referenced module is reachable;
Knip supplies separate module/dependency reachability analysis.

Translation validation follows the current namespaceMap and colocated literal
resource objects, including nested keys and duplicate properties before evaluation.
Use `const { t } = useTranslation('namespace')`; import and `t` aliases work.
Literal keys, conditional literal keys, `namespace:key`, literal `keyPrefix`, and
literal `ns` call options are checked. Resource spreads/computed keys and dynamic
translation keys are rejected when encountered in this supported shape. This
static checker does not analyze arbitrary helper functions, `i18n.t`, `<Trans>`,
or runtime locale loading. Extend it with fixtures before adopting those patterns;
no product locale list or runtime coverage threshold is imposed.

## Context graphs

Generate the repository index after changes, then query it through the CLI:

```sh
npm run graph-generate
npm run graph -- --symbol useExample
npm run graph -- --consumers useExample
npm run graph -- --depends-on src/features/example/pages/example/example.page.tsx --depth 4
npm run graph -- --dependents src/shared/utils/example/example.util.ts --depth 4
npm run graph -- --route /example
npm run graph -- --graph render-flow --path src/features --json
npm run graph -- --strict
npm run test:graphs
```

The approved npm migration applies to these commands too. `graph-build.mjs`
compiles the TypeScript generator, query command, and their modules to ESM `.mjs`
under `.claude/cache/graph-tools/<content-hash>/`. Compilation is cached by source
content, compiler version, and build script. No extra dependency is needed. Run
commands from the repository root. Generated graphs and compiled files are ignored
by Git; regenerate them in each fresh checkout. Claude Code hooks refresh graphs
after relevant tool calls and at session lifecycle events.

Each graph uses version 1 JSON: `{ version, kind, fingerprint, records }`. Records
contain `relation`, `from`, `to`, repository-relative `path`, and 1-based `line`,
with optional `name` and `detail`. Symbol IDs include declaration file, name, and
source offset, so duplicate names remain distinguishable. IDs can change after
edits; regenerate before using old IDs. Output is deterministic and identical
files are left untouched. Files are atomically replaced and the manifest is
published last; queries reject interrupted or mixed generations by SHA-256 hash.
Generation aborts if repository contents change during analysis.

| Graph | Evidence indexed |
| --- | --- |
| imports / dependents | Static imports, re-exports, import types, literal `import()`/`require()`, with reverse local edges. Dynamic imports are marked explicitly. |
| symbols | Named function, variable, class, interface, type alias, and enum declarations. |
| symbols.components/hooks/utils/types/graphql | Declaration subsets by artefact path, hook name, or TypeScript declaration kind. |
| references | TypeScript-resolved references to indexed declarations, including aliases and barrel re-exports. |
| routes | Literal `routePaths` entries in `src/core/routing/routing.model.ts`; no inferred router registration. |
| features | Source-file membership under `src/features/<domain>/`. |
| translations | Namespace-map resources, nested literal keys, and statically bound `useTranslation` calls. |
| graphql-operations | Named operations/fragments from handwritten `.graphql` documents and literal `gql` templates, plus fragment spreads. |
| graphql-usage | GraphQL imports, references to indexed GraphQL declarations, and generated document usage. |
| data-flow | Resolved call edges and declaration initializer references. These are syntactic dependencies, not runtime value propagation. |
| render-flow | JSX references to resolvable project component declarations. |
| build-pipeline | Package scripts, explicit `npm run`/`run-s` invocations, referenced script paths, config files, and Vite config imports. |
| analytics-events | Literal `.track('event')` / `.emit('event')` call candidates, explicitly labeled `emits-candidate`; no backend is assumed. |
| unit-edges | Membership from `docs/units.map.json` globs, including overlaps, and cross-unit import edges. Empty until the map exists. |
| globals | Ambient declarations and module/global augmentations. |
| autotests.testrail/coverage/facade/mock | Literal TestRail tags, transitive test imports, facade classes, and named mock factory definitions/consuming modules. |

Analytics is empty until matching calls exist. The graph generator indexes existing
analytics calls and doc-unit mappings; it does not create them. Build-pipeline edges do not execute or fully
interpret shell commands. Component and data relationships omit runtime dispatch,
reflection, higher-order component behavior, and unresolved external symbols.
Translation indexing does not evaluate arbitrary JavaScript. Graphs complement
compilers and guards; an empty result is not proof that dynamic usage is absent.
The generator warns when a graph exceeds 50 KiB: “split it further.” These size
warnings are advisory; broad reference graphs may exceed the threshold even in
this tooling-heavy skeleton.

The inventory includes tracked and unignored untracked files, excluding dependency
stores, build/test output, graph/cache output, and compiler caches. Outside Git,
the fixture-compatible fallback walks files with those same explicit exclusions.
Symlinks are not followed. All inventory files contribute to the content
fingerprint, including documentation and lockfiles; binaries are hashed, not parsed.
Generated GraphQL types are excluded from declaration indexing; the TypeScript
resolver may load them in-process to resolve imports. Never use a generic agent
Read on generated GraphQL files or graph JSON; use `graphql-extract` or `graph`.

Selectors take one value: `--dependents FILE`, `--depends-on FILE`, `--symbol NAME`,
`--defines NAME`, `--consumers NAME`, `--route NAME_OR_URL`, `--unit ID`,
`--emits EVENT`, or `--config TEXT`. Use one selector per call. Symbol/name/ID
matching is exact; config matching is a substring search. `--consumers` searches
references; `--defines` searches symbols. `--graph KIND` explicitly selects any
row's graph and can be combined with a matching selector. `--path FILE_OR_DIRECTORY`
filters by evidence path or either endpoint; alone it selects imports. Dependency
selectors require exact repository-relative file paths, include local edges only,
and support cycle-safe `--depth` from 1 to 50 (default 1). `--json` emits structured
results; a valid empty result exits 0. `--help` works before generation. Unknown
flags, invalid combinations, missing flag values, and unsupported scopes fail.
`--scope autotests` adds `--testrail C123`, `--coverage FILE`, `--facade NAME` and
`--mock NAME`. Each selects its own `autotests.*` graph. Coverage is static transitive
test-import reachability, not runtime coverage; see [autotest lookup](autotests/playwright/README.md#graph-lookup).

Normal queries parse the small `index.json` manifest and **one** selected graph,
verify that graph's shape and digest, and do not open unrelated graphs. They query
the last snapshot without rescanning source files. `--strict` additionally checks
the current repository fingerprint and streams every output through SHA-256
without parsing/loading additional graphs. Missing, stale, corrupt, mixed, or
invalid selected graphs, syntax errors, and unresolved local imports fail with a
nonzero exit. Bare `--strict` selects globals for the audit. External package
imports and dynamic imports are represented without inventing local dependencies.
The generated `index.md` is the small human-readable overview.

## Claude Code settings and hooks

[.claude/settings.json](.claude/settings.json) wires lifecycle hooks; the
[hook index](.claude/hooks/README.md) documents every entry point, escape hatch,
token counter, cache, and the feature-documentation contract.

The permission allowlist contains exact Git inspection commands, graph/GraphQL
lookup command prefixes, and exact lint/test commands. Git arguments beyond the
listed spellings require normal approval (some flags can write files). Lint/test
commands have no wildcard arguments, so `--fix`, snapshot updates, and arbitrary
npm scripts are not implicitly authorized. Their normal cache/temp writes still
occur. Graph queries may compile their ignored tool cache. There is no `lookup`
script yet, so no fictitious permission entry is registered. Scaffolders, builds,
codegen, installs, and write commands are not allowlisted. This file does not
change the permission mode or sandbox settings.

```sh
npm run test:hooks
npm run docs:drift -- --sweep --strict
```

Settings syntax was checked against the installed Claude Code; behavior tests
send actual hook JSON to each shell entry point without making model API calls.
Feature-document status integrates with the unit documentation pipeline and has isolated fixture coverage.

## Claude Code agents

The [agent index](.claude/agents/README.md) lists all eight roles, model tiers,
turn limits, tool scopes, and invocation instructions. Architect/tester writes
are checked by an agent-local path hook; read-only Bash roles have explicit
mutation prohibitions. The tester delegates command execution to its caller to
keep its write boundary enforceable. Feature documentation uses the [unit pipeline](docs/README.md);
Playwright uses its [separate project](autotests/playwright/README.md). Run `npm run test:agents` for isolated scope-enforcement tests.

## Claude Code skills

The [skill index](.claude/skills/README.md) lists the 19 project workflows and
lookup skills. Each real scaffolder has a thin wrapper; form/table skills compose
existing generators, and translations use the existing i18next layout. The
commit workflow detects main/linked-worktree context while preserving configured
identity, hooks, signing, and verification. Feature docs use the [unit pipeline](docs/README.md).
Skills are discoverable normally and can be invoked by `/name`; loading one does
not grant tool permissions or authorize an unrelated commit/publication.

## Project guidance

[AGENTS.md](AGENTS.md) is the shared root navigator for project rules, mandatory scaffolders,
focused lookups, session/output discipline, task routing, and all agents and skills.
Its scoped-guidance table indexes every subtree CLAUDE.md and AGENTS.md; keep that table in sync
when adding or removing guidance. Detailed architecture, scaffolder, lookup, and
verification guides live under `.claude/docs/` and are read on demand.

Project policies cover language, responsibility-based file splitting, and a 200-word
default final-response limit. Token-hook thresholds remain the reference
defaults and measure API usage rather than visible response words.
`autotests/CLAUDE.md` documents the separate Playwright project and its test conventions. Strict docs drift
checks the scoped-guidance pairs and their root index, all artefact indexes and unit freshness.
[Codex setup](docs/CODEX_SETUP.md) documents installed-version behavior and parity limits;
[workflow ports](.agents/skills/README.md) provides the four native Codex skills. Root CLAUDE.md imports
the shared AGENTS.md rules and adds Claude runtime details. Husky runs strict docs drift after guards.
Run `npm run test:parity` for guidance/port drift fixtures.


## Feature documentation

[docs/README.md](docs/README.md) documents the unit registry, kind templates, dossiers, evidence
validation, freshness stamps, backfill, and local export. Run `npm run docs:drift:strict` for
index plus unit checks and `npm run test:docs` for pipeline tests. External publication is
explicitly unconfigured; sync commands provide `--export` and reject `--publish`.

## Playwright autotests

[autotests/playwright/README.md](autotests/playwright/README.md) covers the separate npm installation,
Chromium setup, macOS 13 Chrome override, lint/type checks, example-page tests, TestRail tag convention
and autotest graph queries. [MOCKING.md](autotests/playwright/docs/MOCKING.md) documents per-test factory
mocks and fail-on-unregistered API requests. Root lint and Vitest remain separate from this package.
