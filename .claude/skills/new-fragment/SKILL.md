---
name: new-fragment
description: Generate a flat typed GraphQL fragment from an existing schema type.
---

Require a kebab-case fragment name and existing GraphQL type. Inspect only that
schema block with `npm run graphql-extract -- --name <Type>`. Run the actual
generator from the repository root, using the requested values:

```sh
npm run generate-fragment -- --non-interactive --name query-fields --type Query
```

Optional --schema must support all existing operations. Output is a single flat
src/graphql/fragments/<name>.fragment.ts, without a nested directory or barrel.
Inspect existing files first; do not overwrite customized fragments. Refine the
selection for its consumers. Use GraphQL spreads rather than JavaScript gql
interpolation. The generator runs codegen and document extraction; fix failures
and rerun npm run generate-code before claiming completion. Never read generated
outputs wholesale or hand-edit them. Run relevant tests and npm run lint.
