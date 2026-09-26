---
name: new-hook
description: Create a reusable hook with the canonical types, test, and barrel via generate-hook.
---

Run from the repository root using npm. Take the name and parent path from the
request; names are kebab-case and paths are repo-relative under src/. Inspect
existing targets first. Invoke the generator yourself with --non-interactive
and every required flag; never hand-write the initial scaffold. The generator
preserves identical files, restores missing files, and rejects differing existing
files. If an existing scaffold was customized, edit it instead of overwriting it.

```sh
npm run generate-hook -- --non-interactive --name use-toggle --path src/shared/hooks
```

Hook names include use-. Output is <name>/{index.ts,<name>.hook.ts,
<name>.types.ts,<name>.spec.ts}. Replace the cloned example behavior and assertions
with the requested behavior; preserve a named hook export in the barrel.

Use the requested owning layer; the example path is not mandatory. Before adding
new behavior, locate reusable code with `npm run graph -- --symbol <name>`.
Finish the implementation, run relevant tests and `npm run lint`, and report
actual results. Do not leave the caller to run the generator.
