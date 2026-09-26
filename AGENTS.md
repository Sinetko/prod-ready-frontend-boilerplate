# Project guidance

## Core principles

- If `BOOTSTRAP_PROGRESS.md` exists, read it first and work only on the first unchecked phase.
  Completed bootstrap history lives in `docs/ARCHITECTURE_HISTORY.md`; do not restart completed phases.
  Trust recorded decisions and preserve the user's current scope.
- Use npm, not historical pnpm commands. Node/npm pins and the lockfile are authoritative.
- Inspect existing files before creating anything; verify partial work and finish missing pieces without
  overwriting unrelated changes. Ask about missing project conventions rather than inventing them.
- Finish authorized implementation and verification. Report concrete blockers; do not hand routine
  scaffolder execution back to the user. Do not commit or publish without authorization.
- Follow strict TypeScript and the checked-in lint/format/style configs. Use source-root imports,
  project Apollo wrappers, canonical artefact shapes, and enforced layer boundaries.

## Mandatory scaffolders

Run these yourself from the repository root. All automated calls require `--non-interactive` and every
required flag. Never hand-create new `.page.tsx`, `.hook.ts`, `.util.ts`/`.utils.ts`, `.component.tsx`,
`.store.ts`, `.context.tsx`, GraphQL operation `.tag.ts`, or flat `.fragment.ts` files.
Existing implementations may be edited normally. Inspect generator errors and partial output;
never delete customized files merely to make a generator succeed.

| Entity | Command from repository root | Required flags after -- | Optional flags |
| --- | --- | --- | --- |
| Component | `npm run generate-component --` | `--non-interactive --name <kebab-name> --path <src-parent>` | — |
| Hook | `npm run generate-hook --` | `--non-interactive --name use-<kebab-name> --path <src-parent>` | — |
| Util | `npm run generate-util --` | `--non-interactive --name <kebab-name> --path <src-parent>` | — |
| Store | `npm run generate-store --` | `--non-interactive --name <kebab-name> --path <src-parent>` | — |
| Context | `npm run generate-context --` | `--non-interactive --name <kebab-name> --path <src-parent>` | — |
| Page | `npm run generate-page --` | `--non-interactive --name <kebab-name> --group <feature> --route <url-path> --namespace <namespace>` | — |
| Query | `npm run generate-query --` | `--non-interactive --name <kebab-name> --field <schema-field>` | `--schema <schema-path>` |
| Lazy query | `npm run generate-query --` | `--non-interactive --name <kebab-name> --field <schema-field> --lazy` | `--schema <schema-path>` |
| Mutation | `npm run generate-query --` | `--non-interactive --name <kebab-name> --field <schema-field> --mutation` | `--schema <schema-path>` |
| Fragment | `npm run generate-fragment --` | `--non-interactive --name <kebab-name> --type <GraphQLType>` | `--schema <schema-path>` |
| Translations | No standalone generator; generate-page includes them | Existing owner uses colocated `<owner>.translations.ts` and namespaceMap | See new-translations |
| Form | `npm run generate-component --` | `--non-interactive --name <form-name> --path <src-parent>` | No dedicated generator; new-form resolves the form contract |
| Table | `npm run generate-component --` | `--non-interactive --name <table-name> --path <src-parent>` | No dedicated generator; new-table resolves the table contract |
| Stateful columns | `npm run generate-hook --` | `--non-interactive --name use-<name>-columns --path <src-parent>` | Only when the chosen table API benefits; see use-table-columns |

See [scaffolder details](.claude/docs/scaffolders.md) for registration, canonical examples, and partial
recovery. The Claude-only scaffold-guard escape hatch is rare and needs a recorded reason; it grants no Codex exemption.

## Extract before inventing

Find existing symbols and consumers with `npm run graph -- --symbol <name>` / `--consumers <name>`
before creating a helper. Reuse or extract a suitable existing responsibility within layer boundaries.
Use `npm run graphql-extract -- --name <type>` or `--ts-type <type>` for schema/generated contracts.
Never Read, dump, or hand-edit generated GraphQL outputs (`src/graphql/graphql-api-types.ts`,
`src/graphql/schema.graphql`, `src/graphql/schema.graphql.json`, `src/graphql/documents.graphql`)
or `.claude/context-graphs/*.json`.
Use focused CLI results and small handwritten source sections. Regenerate stale graphs before relying
on them; source-confirm static relationships. See [lookup rules](.claude/docs/lookups.md).

## Hard file-splitting rule

Split by responsibility, with no arbitrary file-line cap. Nontrivial component types go in `.types.ts`;
helper components get their own directory; constants go in the owner's `.model.ts`; inline event
handlers longer than 10 lines move to a hook/util. Invoke the matching generator for every new
scaffolder-shaped file. Keep translations beside their owner and fragments flat. Do not combine
unrelated responsibilities merely to avoid generating another artefact.

## Language policy

Write identifiers, comments, and project documentation in English. Reply in the user's language.
Preserve intended localized UI text; the example's English resources do not define supported locales.

## Session discipline

1. Keep one scope per session. For bootstrap, use the progress file; do not re-read completed phase bodies.
2. Load detailed docs only when needed. Do not preload every agent, skill, source subtree, or graph.
3. Use graph/GraphQL extraction and bounded handwritten-file searches; never Read huge generated files.
4. Preserve the active checkout/worktree and unrelated edits. Inspect existing targets before writes.
5. Write persistent session memory only at session end, if applicable and authorized. No persistent agent
   memory is currently configured; cache/telemetry writes are not a substitute for a verified handoff.
6. At a context-budget checkpoint, narrow the work and prepare a concise handoff. Claude's reference
   cache-read warnings are 250,000/400,000 tokens; Codex has no configured equivalent in this repo.
   Never infer those counters from message length or claim an advisory hook ran without evidence.
7. Run relevant verification and inspect the diff. After a phase passes, check its progress box and append
   `YYYY-MM-DD — Phase N done: <summary>` in the same turn. Then stop and recommend a fresh session
   for the next substantial phase. Do not check off unverified work.
8. After the last repository edit, refresh graphs and check `npm run graph -- --strict`. Include actual
   check results and remaining limitations in the handoff; do not claim asynchronous hooks proved success.

## Output discipline

Default final responses to at most 200 words; exceed this for requested detail or evidence needed to
explain a result or blocker. Lead with the outcome, changes, and verification. Avoid repeating command
logs. Claude's output-token warnings are 1,200/3,000 per turn; they are advisory and do not measure
words. Codex follows the prose budget manually. Runtime-specific controls live in
[Claude runtime guidance](CLAUDE.md) and [Codex setup](docs/CODEX_SETUP.md).

## Coding standards

The [README layer table](README.md#guard-scripts) is the established dependency policy,
enforced by `npm run check-import-from-src`. Every layer may import itself; features may only
import their own domain. Test files may cross boundaries for integration coverage.

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
| bootstrap | All preceding runtime layers |
| app | All preceding runtime layers, bootstrap |
| vite | None |
| __mocks__ | App/runtime layers |

`src/types/i18next.d.ts` importing `bootstrap/namespace-map` is the existing narrow ambient-typing
exception. Do not generalize it. `shared/` is feature-agnostic; domain-shared work belongs in
`business-commons/`; app composition belongs in `app/` and initialization in `bootstrap/`.

Use root-relative source imports via `baseUrl: src`, with no invented src alias. Follow checked-in
TypeScript, ESLint, Prettier, and Stylelint configs. TypeScript is strict; formatter defaults are
120 columns, single quotes, semicolons, ES5 trailing commas, and ordered/separated import groups.
The 120-column lint warning still fails `--max-warnings 0`; only documented registry/generated
exceptions apply. Types belong in type imports under `verbatimModuleSyntax`.

Zustand stores use `createWithEqualityFn`, devtools and Immer, a top-level `state`/`actions` split,
shallow equality, and `store/actionName` devtools actions. Follow the example rather than changing
middleware order. Context barrels export the provider default, named consumer hook, and types.
Hook/util barrels expose their named implementation; fragments remain flat files.

Translations are colocated i18next resources registered through `namespaceMap`. Keep literal namespaces
and keys compatible with the current guard; extend the guard with fixtures before introducing unsupported
dynamic patterns. The example locale is not a product-wide locale policy. Shared/business-commons
changes need importing runnable tests; this guard checks test presence, not a coverage percentage.

## Detailed rules — read on demand

| When needed | Guide |
| --- | --- |
| Layer boundaries, imports, stores, translations, coding rules | [Architecture](.claude/docs/architecture.md) |
| Artefact generation, canonical shapes, partial recovery | [Scaffolders](.claude/docs/scaffolders.md) |
| Symbols, consumers, schema/type/document extraction | [Lookups](.claude/docs/lookups.md) |
| Unit docs, evidence, freshness, backfill, export | [Feature documentation](docs/README.md) |
| Tests, lint, freshness, enforcement limitations | [Verification](.claude/docs/verification.md) |

## Task routing and role disciplines

Use the matching discipline in the current session. These are responsibilities, not tool restrictions;
Claude agent definitions and model aliases are not Codex configurations. Delegate only when authorized
and supported by the actual runtime. Never claim a role or sandbox enforced a restriction it did not.

| Task / role | Required discipline |
| --- | --- |
| Trivial localized edit | Implement directly and run relevant checks. |
| Explore | Locate symbols/consumers through graph CLI and focused source inspection; stay read-only. |
| Architect | Return a plan; optional plan writes only under `.claude/plans/`; no implementation edits. |
| Debugger | Gather reproduction evidence, identify root cause, propose a patch; keep investigation read-only. |
| Reviewer | Review the requested diff, prioritize concrete defects with file/line evidence; do not apply fixes. |
| Developer | Finish authorized implementation and verification; invoke scaffolders yourself with full flags. |
| Tester | Write only under `autotests/`; use its separate package checks. Application unit tests belong to developer work. |
| Technical doc writer | Review a unit dossier and code; author technical claims, validate and stamp current evidence. |
| Business doc writer | Derive business outcomes only from a current technical document; preserve its limitations. |

For read-only roles, forbidden shell mutations include `>`, `>>`, `sed -i`, `tee`, `mv`, `rm`,
`git add`, `git commit`, and `git checkout`; also avoid any other write-capable command.
This is a role convention, not a shell sandbox. A requested review does not authorize applying fixes.
When a role cannot execute tests, its caller executes and reports them. Follow the
[unit pipeline](docs/README.md) for both documentation roles.

## Verification and runtime boundaries

- Run `npm run lint` and relevant tests before finishing. Run `npm run docs:drift -- --sweep --strict`
  before finishing; review and update stale unit docs through the dossier/validate/stamp workflow.
- After schema/document changes, explicitly run `npm run generate-code`; do not assume a Codex edit
  ran the Claude auto-codegen hook. Never patch generated output to make checks pass.
- After the final repository edit, run `npm run graph-generate`, then `npm run graph -- --strict`.
- Husky runs Knip, all seven guards, and strict docs drift for either client. It checks the working tree;
  partial staging requires separate validation of staged content. Never bypass hooks to hide a failure.
- Scaffolders are mandatory instructions in Codex. Existing lint guards validate imports, wrappers,
  naming, shared-test presence, icons, versions and translation keys; they cannot prove a file was
  created by a generator. The Claude pre-write guard is not installed as a Codex hook.
- Codex CLI 0.156.1 supports hooks and multi-agent features, but this project configures neither as
  a Claude-equivalent security boundary. No Codex token telemetry/budget hook is configured.
  The original bootstrap's blanket “no hooks/subagents” assumption is outdated; see setup evidence.
- Read the indexed scoped guide before editing that subtree, including when starting Codex at root;
  do not assume every nested guide was automatically loaded by the runtime.

## Skills

| Skill | Purpose |
| --- | --- |
| [new-component](.claude/skills/new-component/SKILL.md) | Generate the canonical component, props type, and barrel. |
| [new-hook](.claude/skills/new-hook/SKILL.md) | Generate the canonical hook, types, test, and barrel. |
| [new-util](.claude/skills/new-util/SKILL.md) | Generate a utility, test, and barrel. |
| [new-store](.claude/skills/new-store/SKILL.md) | Generate the Zustand state/actions and middleware shape. |
| [new-context](.claude/skills/new-context/SKILL.md) | Generate a provider, consumer hook, types, and barrel. |
| [new-page](.claude/skills/new-page/SKILL.md) | Generate a feature page and register its route/namespace. |
| [new-query](.claude/skills/new-query/SKILL.md) | Generate normal/lazy queries or mutations with project Apollo wrappers. |
| [new-fragment](.claude/skills/new-fragment/SKILL.md) | Generate a flat schema-driven fragment and run codegen. |
| [new-form](.claude/skills/new-form/SKILL.md) | Use component/hook generators with the agreed form contract. |
| [new-table](.claude/skills/new-table/SKILL.md) | Use the component generator with the agreed row and interaction contract. |
| [new-translations](.claude/skills/new-translations/SKILL.md) | Colocate typed i18next resources and register namespaceMap entries. |
| [use-table-columns](.claude/skills/use-table-columns/SKILL.md) | Generate a column hook only when the chosen table approach needs it. |
| [use-scaffolders](.claude/skills/use-scaffolders/SKILL.md) | Pure artefact-to-command/flags lookup table. |
| [graph-lookup](.claude/skills/graph-lookup/SKILL.md) | Query a relevant graph through its CLI, including freshness checks. |
| [graphql-lookup](.claude/skills/graphql-lookup/SKILL.md) | Extract a focused schema/document/type block. |
| [lint](.claude/skills/lint/SKILL.md) | Run actual checks and distinguish known advisories from failures. |
| [feature-docs](.claude/skills/feature-docs/SKILL.md) | Coordinate dossiers, technical/business docs, validation, and freshness with the unit pipeline. |
| [codegen](.claude/skills/codegen/SKILL.md) | Manually regenerate GraphQL outputs after batch/shell edits. |
| [commit-changes](.claude/skills/commit-changes/SKILL.md) | Detect checkout/worktree context and commit authorized changes with normal identity/hooks/signing. |

See the [skill index](.claude/skills/README.md) and [Codex workflow ports](.agents/skills/README.md). Loading a skill grants no additional permissions and
does not authorize a commit or external publication. Forms/tables compose existing generators.

## Scoped guidance index

Every scoped CLAUDE.md and its AGENTS.md pointer must appear here. Add or remove its entry in the same change as the file.

| Scope | Guidance and reason |
| --- | --- |
| Application source | [src/AGENTS.md](src/AGENTS.md) / [src/CLAUDE.md](src/CLAUDE.md) — source layers, canonical modules, tests, translations |
| GraphQL | [src/graphql/AGENTS.md](src/graphql/AGENTS.md) / [src/graphql/CLAUDE.md](src/graphql/CLAUDE.md) — wrappers, operation naming, generated-file boundaries |
| Tool scripts | [scripts/AGENTS.md](scripts/AGENTS.md) / [scripts/CLAUDE.md](scripts/CLAUDE.md) — idempotent CLIs, graph/extraction contracts, tool tests |
| Claude tooling | [.claude/AGENTS.md](.claude/AGENTS.md) / [.claude/CLAUDE.md](.claude/CLAUDE.md) — indexes, hook scopes, generated caches |
| Autotests | [autotests/AGENTS.md](autotests/AGENTS.md) / [autotests/CLAUDE.md](autotests/CLAUDE.md) — separate Playwright package, factories, naming and graph scope |

`npm run docs:drift -- --sweep --strict` audits scoped pointers, their root index, workflow ports,
artefact indexes and unit freshness. Keep navigation and source instructions synchronized in the same change.
