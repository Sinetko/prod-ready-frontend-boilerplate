---
name: new-table
description: Create a table component using existing scaffolders and the project’s agreed data and interaction contract.
---

Use graph-lookup to find existing table components first. There is currently no
table library, column convention, or generate-table command in this repo. Require
the caller's row shape, row identity, columns, and needed sorting/filtering/
pagination/selection behavior. Reuse an established implementation if present;
otherwise settle the table approach before implementing those behaviors. Do not
silently adopt a library, invent a universal table abstraction, or add features
the caller did not request.

Create the owning component through the existing generator, using requested values:

```sh
npm run generate-component -- --non-interactive --name accounts-table --path src/features/example/components
```

Inspect existing targets before generation. Use use-table-columns only when
column extraction is warranted by the chosen table approach; static JSX columns
need not become a hook. Colocate translations and keep types/helper components
in the canonical files/directories. If fetching GraphQL data, use generated
operation hooks and the project Apollo wrappers. Implement agreed empty/loading/
error behavior and meaningful interaction tests, then run npm run lint.
