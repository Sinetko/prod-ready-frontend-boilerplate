---
name: codegen
description: Regenerate typed GraphQL outputs and extracted documents after source or schema batch edits.
---

After GraphQL document/schema changes made through shell commands or in a batch,
run from the repository root:

```sh
npm run generate-code
```

This runs the configured codegen pipeline and named-document extraction. Normal
Claude Code Edit/Write hooks and GraphQL scaffolders already invoke it; Codex must run it explicitly after edits. Manual execution
covers paths that bypass those triggers. Fix errors in schema.graphql (the root
source schema) or handwritten documents, not in generated outputs. Preserve the
approved Apollo Client 4 typed-document-node setup and project Apollo wrappers.

Never hand-edit or read wholesale src/graphql/graphql-api-types.ts,
src/graphql/schema.graphql, src/graphql/schema.graphql.json, or
src/graphql/documents.graphql. Use graphql-lookup for focused inspection.
On failure, report the real error and resolve it before claiming completion;
partial outputs do not prove success. Run npm run lint:types and relevant tests
for changed contracts. Refresh graphs after successful generation if needed.
