---
name: graph-lookup
description: Find symbols, dependencies, consumers, routes, and unit relationships through the context-graph CLI.
---

Use the CLI from the repository root; never Read .claude/context-graphs/*.json.
Choose one selector and request only relevant output:

```sh
npm run graph -- --symbol useExample --strict
npm run graph -- --consumers useExample
npm run graph -- --dependents src/shared/utils/example/example.util.ts --depth 2
npm run graph -- --depends-on src/features/example/pages/example/example.page.tsx --depth 2
npm run graph -- --route /example
npm run graph -- --graph render-flow --path src/features --json
```

--defines selects symbol definitions, --unit takes a unit ID, --emits takes an
event name, and --config matches configuration text. --path filters by evidence
path or endpoint; alone it selects imports. --depth is 1–50 on dependency queries
only. Symbol/name matching is exact; dependency paths are repo-relative files.
Use --help for accepted combinations instead of guessing flags.

Normal queries inspect one graph from the last snapshot. Use --strict before
relying on freshness; it also streams all output hashes. If stale or missing,
run npm run graph-generate if your role permits writes, then retry. A read-only
role asks its caller for that refresh. Never edit graphs manually. Queries may
compile the ignored tool cache. Empty results are valid, not proof that dynamic
usage is absent. Static data/render/event edges need source confirmation.
--scope autotests adds --testrail C123, --coverage FILE, --facade NAME, and --mock NAME.
Coverage means static test-import reachability, not executed coverage. See
[autotest lookup](../../../autotests/playwright/README.md#graph-lookup) for indexing limits.
