# GraphQL guidance

Use [root lookup rules](../../.claude/docs/lookups.md); never Read or hand-edit `graphql-api-types.ts`,
`schema.graphql`, `schema.graphql.json`, or `documents.graphql` here. They are generated outputs.
The root `schema.graphql` is the handwritten bootstrap schema; inspect only relevant blocks via extraction.

- Create operations with `generate-query` (normal, `--lazy`, or `--mutation`) and fragments with
  `generate-fragment`, always non-interactively with the root table's required flags.
- Operation directories contain `<name>.tag.ts`, `<name>.hook.ts`, and `index.ts`. Export exactly the
  corresponding `use<Name>Query`, `use<Name>LazyQuery`, or `use<Name>Mutation` hook.
- Call `useApolloQuery`, `useApolloLazyQuery`, and `useApolloMutation` from `graphql/hooks/`.
  Raw Apollo data hooks are confined to their exact wrapper implementations. New hook families require
  an explicit wrapper/guard extension; type-only Apollo imports and approved non-hook imports remain allowed.
- Apollo 4 uses generated typed documents. Refine schema-derived selections for the screen; fragments are
  flat `<name>.fragment.ts`. Use GraphQL spreads, not JavaScript interpolation in gql templates.
- Run `npm run generate-code` after schema/document changes. The generator already does so; shell/batch
  edits need an explicit run. Auto-codegen failures need repair, not manual patches to generated types.
- Run relevant tests/lint, then refresh and strictly verify graphs. Never invent a deployed API endpoint
  or treat the bootstrap schema as a production contract.
