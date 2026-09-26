---
name: new-store
description: Create a Zustand store with the state/actions split and project middleware pattern.
---

Run from the repository root using npm. Take the name and parent path from the
request; names are kebab-case and paths are repo-relative under src/. Inspect
existing targets first. Invoke the generator yourself with --non-interactive
and every required flag; never hand-write the initial scaffold. The generator
preserves identical files, restores missing files, and rejects differing existing
files. If an existing scaffold was customized, edit it instead of overwriting it.

```sh
npm run generate-store -- --non-interactive --name counter --path src/core/stores
```

Output is <name>/{index.ts,<name>.store.ts,<name>.types.ts}. Preserve
createWithEqualityFn, devtools, immer, shallow equality, the top-level state/actions
split, and namespaced store/actionName devtools labels from the generated template.

Use the requested owning layer; the example path is not mandatory. Before adding
new behavior, locate reusable code with `npm run graph -- --symbol <name>`.
Finish the implementation, run relevant tests and `npm run lint`, and report
actual results. Do not leave the caller to run the generator.
