# Verification and enforcement

Run relevant tests plus `npm run lint`. Lint includes ESLint/Prettier with zero warnings, app/scripts/Vite
TypeScript checks, Stylelint, Knip, and all seven guards. See the [lint skill](../skills/lint/SKILL.md)
for the limited known advisories; no ESLint warning or missing dependency is accepted as success.

| Changed area | Additional verification |
| --- | --- |
| App behavior | `npm test`; `npm run build` when bundling or runtime composition changes |
| Scaffolders | `npm run test:scaffolders` |
| Guard policies | `npm run test:guards` |
| Graph tooling | `npm run test:graphs` |
| Lifecycle hooks | `npm run test:hooks` |
| Agent scope enforcement | `npm run test:agents` |
| Codex parity | `npm run test:parity`; see [setup](../../docs/CODEX_SETUP.md) |
| Navigation/indexes | `npm run docs:drift -- --sweep --strict`; check all local links and scoped guidance indexes |
| GraphQL documents/schema | `npm run generate-code`, then relevant tests and lint |
| Playwright | `npm --prefix autotests/playwright run lint`, `test`, and `run test:guard` using that same prefix |

Inspect the diff, preserve unrelated work, and report unrun/failing checks accurately. Never weaken a
check to close a phase. Refresh graphs after the final repository edit and run `npm run graph -- --strict`.
The progress log itself affects graph freshness.

[Hook documentation](../hooks/README.md) describes actual trigger coverage and limitations. Async
refresh is not proof of freshness. Shell/batch GraphQL edits require explicit codegen. Hook behavior is
not a shell sandbox. Husky runs Knip, guards and strict docs drift, not every verification command above.

Feature-doc status/validation/sync commands are documented in [the unit pipeline](../../docs/README.md).
Root lint does not validate the separate Playwright project. See its [setup](../../autotests/playwright/README.md)
for Chromium installation and the explicit Chrome override needed on this macOS 13 host.
Do not commit, publish, change identity, or bypass checks without applicable user authorization.
