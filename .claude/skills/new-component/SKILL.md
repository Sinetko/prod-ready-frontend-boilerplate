---
name: new-component
description: Create a React component with the project generator and its barrel and props type.
---

Run from the repository root using npm. Take the name and parent path from the
request; names are kebab-case and paths are repo-relative under src/. Inspect
existing targets first. Invoke the generator yourself with --non-interactive
and every required flag; never hand-write the initial scaffold. The generator
preserves identical files, restores missing files, and rejects differing existing
files. If an existing scaffold was customized, edit it instead of overwriting it.

```sh
npm run generate-component -- --non-interactive --name panel --path src/shared/components
```

Output is <name>/{index.ts,<name>.component.tsx,<name>.types.ts}. Keep nontrivial
types separate, helper components in their own directories, constants in
.model.ts, and handlers longer than 10 lines in a generated hook/util.

Use the requested owning layer; the example path is not mandatory. Before adding
new behavior, locate reusable code with `npm run graph -- --symbol <name>`.
Finish the implementation, run relevant tests and `npm run lint`, and report
actual results. Do not leave the caller to run the generator.
