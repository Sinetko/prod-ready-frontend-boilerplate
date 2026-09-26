---
name: use-table-columns
description: Extract reusable table column logic through the hook scaffolder when the existing table implementation benefits from it.
---

Inspect the owning table, row type, column API, and translations first. No table
library or column abstraction is prescribed in this repo. Reuse the established
shape; if absent, ask the caller for the intended table approach before creating
one. Do not introduce a library or a hook merely for static JSX columns.

When columns need React state, translations, or shared interaction logic,
create a hook through the real generator using the agreed owner and name:

```sh
npm run generate-hook -- --non-interactive --name use-account-columns --path src/features/example/hooks
```

Replace the example hook and tests with the table's actual typed column result.
Keep types separate and import the row type from its owner. Preserve the chosen
API's row identity, accessor, and cell-rendering semantics; do not guess library
methods. Use only justified memoization and complete dependency lists. Longer
cell helpers become their own generated components. Verify translated labels
and important cell/action behavior with relevant tests and npm run lint.
