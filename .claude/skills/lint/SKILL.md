---
name: lint
description: Run the repository lint checks and distinguish known advisory output from actual failures.
---

Run npm run lint from the repository root. It includes lint:code (ESLint and
Prettier, zero warnings), lint:types (app/scripts/Vite TypeScript projects),
lint:style, lint:knip, and lint:guards. Run a specific subcommand to diagnose a
failure. Fix causes within scope and rerun affected checks; do not weaken rules.
Use npm run fix:code or fix:style only for requested fixes and inspect their diff.
fix:types is a type check, not an automatic repair. Tests are separate from lint.

Currently accepted advisory output, not suppressed errors:

- Node's MODULE_TYPELESS_PACKAGE_JSON warning while Knip loads the split Vite
  config; the CommonJS/ESM layout is intentional under the accepted TS setup.
- Graph generation may warn that imports, references, symbols, and data-flow
  outputs exceed 50 KiB. This is a splitting advisory, not permission to Read them.
- Vite's future native-loader/module-layout advisory is documented in README.md.

No ESLint warnings are intentionally ignored: --max-warnings 0 still applies.
No lint dependency failure remains deferred. A new warning/failure is not covered
by this list merely because a previous phase had exceptions. Report exact failing
commands and separate pre-existing issues from regressions. Autotests has its own
lint/TS project; run npm --prefix autotests/playwright run lint separately.
Root lint does not validate that tree.
