---
name: new-context
description: Create a React context using the project provider, consumer hook, types, and barrel shape.
---

Run from the repository root using npm. Take the name and parent path from the
request; names are kebab-case and paths are repo-relative under src/. Inspect
existing targets first. Invoke the generator yourself with --non-interactive
and every required flag; never hand-write the initial scaffold. The generator
preserves identical files, restores missing files, and rejects differing existing
files. If an existing scaffold was customized, edit it instead of overwriting it.

```sh
npm run generate-context -- --non-interactive --name account --path src/core/contexts
```

Output is <name>/{index.ts,<name>.context.tsx,<name>.types.ts}. Preserve the default
Provider export, named consumer hook, and type re-exports. Keep the existing
missing-provider behavior and test it when changing the context contract.

Use the requested owning layer; the example path is not mandatory. Before adding
new behavior, locate reusable code with `npm run graph -- --symbol <name>`.
Finish the implementation, run relevant tests and `npm run lint`, and report
actual results. Do not leave the caller to run the generator.
