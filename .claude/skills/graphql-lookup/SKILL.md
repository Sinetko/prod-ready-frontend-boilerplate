---
name: graphql-lookup
description: Extract one schema, operation, fragment, or generated TypeScript block instead of reading huge GraphQL files.
---

Run from the repository root and choose exactly one selector:

```sh
npm run graphql-extract -- --name Query
npm run graphql-extract -- --operation Bootstrap
npm run graphql-extract -- --fragment Example
npm run graphql-extract -- --pattern '^Query$'
npm run graphql-extract -- --path 'src/graphql/fragments/*.fragment.ts'
npm run graphql-extract -- --ts-type BootstrapQuery
```

--name/--pattern select schema definitions; --operation/--fragment select named
source documents; --path selects source documents by glob; --ts-type selects a
generated type/interface/enum. Narrow patterns to the actual question. A missing
match exits nonzero; investigate the name or generation status rather than
falling back to a full Read/cat/grep of generated outputs.

Never read src/graphql/graphql-api-types.ts, schema.graphql, schema.graphql.json,
or documents.graphql wholesale. Never hand-edit those generated outputs. If
stale, use the codegen workflow if authorized by your role, or request it from
the caller. Inspect small handwritten documents after locating their paths.
