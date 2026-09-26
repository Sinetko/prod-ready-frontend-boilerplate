---
name: new-query
description: Generate a schema-driven query, lazy query, or mutation with typed project Apollo wrappers.
---

Require an operation name and root schema field, plus query/lazy/mutation intent.
Inspect the schema through graphql-extract, never by reading generated outputs:

```sh
npm run graphql-extract -- --name Query
npm run generate-query -- --non-interactive --name greeting --field hello
```

Names are kebab-case. Add --lazy for lazy queries or --mutation for mutations;
these modes are alternatives. Optional --schema selects a schema compatible with
all current documents. The bootstrap schema has no mutation root: obtain a real
schema/field before generating a mutation, rather than inventing one.

Output is src/graphql/queries/<name>/ or mutations/<name>/ with index.ts,
<name>.tag.ts, and <name>.hook.ts. Hooks use use<Name>Query, use<Name>LazyQuery,
or use<Name>Mutation and the project Apollo wrappers. A sole input: SomeInput!
argument is flattened into field variables. Inspect generated selections for
the screen's needs: nested required-argument fields are omitted and recursion
is bounded. Refine source documents, never generated types.

The generator runs codegen and extraction. A failure leaves a scaffold to fix;
resolve it and rerun npm run generate-code. Never claim success from files alone.
Run relevant tests and npm run lint after implementation. Existing customized
operations must not be overwritten with fresh template output.
