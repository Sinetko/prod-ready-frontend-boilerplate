# Autotest boundary

Follow [root guidance](../CLAUDE.md). [Playwright setup](playwright/README.md) defines this separate npm
package, its own lockfile/lint/TypeScript configs, browser setup and test conventions.

Use `tests/**/*.spec.ts` and optional literal per-test `@C<positive integer>` tags for real TestRail
cases only. Import `test`/`expect` from `fixtures/fixtures.globalMocker` and use the reusable factories
described in [MOCKING.md](playwright/docs/MOCKING.md); no ad hoc routing in app specs. Unregistered
browser API calls fail fixture teardown. Root lint/Vitest do not validate this separate project.
From root, run `npm --prefix autotests/playwright run lint`, `npm --prefix autotests/playwright test`
and `npm --prefix autotests/playwright run test:guard`. macOS 13 needs the documented Chrome override.

The tester role may edit only this autotests tree. Claude's tester has no shell tool; its caller executes
checks. A Codex tester assignment follows the same edit scope and can run these checks when tools allow.
Read app contracts as needed through focused source/graph/GraphQL lookup results. Do not move Vitest
app tests here or change application code under a tester-only assignment. Use `npm run graph --
--scope autotests` with `--testrail`, `--coverage`, `--facade`, or `--mock`. Coverage is static test-import
reachability, not executed coverage. Ordinary test facades do not use app scaffolder file suffixes.
