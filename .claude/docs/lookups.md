# Focused code and GraphQL lookups

Use the [graph skill](../skills/graph-lookup/SKILL.md) and
[GraphQL skill](../skills/graphql-lookup/SKILL.md) for detailed selector rules.

```sh
npm run graph -- --symbol useExample --strict
npm run graph -- --consumers useExample
npm run graph -- --dependents src/shared/utils/example/example.util.ts --depth 2
npm run graph -- --route /example
npm run graphql-extract -- --name Query
npm run graphql-extract -- --operation Bootstrap
npm run graphql-extract -- --fragment Example
npm run graphql-extract -- --ts-type BootstrapQuery
```

Choose one selector; use `--help` rather than inventing combinations. Graph queries load one graph
in-process; strict checks also verify repository freshness and stream output hashes. Regenerate missing
or stale graphs with `npm run graph-generate` if your role permits it; read-only roles ask the caller.
Graph results are static evidence: an empty result does not prove runtime absence, and call/render/event
candidates require source confirmation. `--scope autotests` supports `--testrail`, `--coverage`,
`--facade` and `--mock`; see [autotest lookup](../../autotests/playwright/README.md#graph-lookup).
Coverage means static test-import reachability, not executed coverage.

Never Read or dump `.claude/context-graphs/*.json`, `src/graphql/graphql-api-types.ts`,
`src/graphql/schema.graphql`, `src/graphql/schema.graphql.json`, or `src/graphql/documents.graphql`
wholesale. Never hand-edit generated outputs. The extraction CLI parses them internally and returns
focused blocks. For a large handwritten registry, locate the relevant key then inspect only that section.

Before inventing a helper or abstraction, look up existing symbols, consumers, and the nearest canonical
example. Reuse an appropriate implementation or extract a reusable responsibility within allowed layers.
Do not create a generic abstraction solely because two names look similar.
