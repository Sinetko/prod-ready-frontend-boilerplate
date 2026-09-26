# Source guidance

Follow [root guidance](../CLAUDE.md) and load [architecture details](../.claude/docs/architecture.md)
only for the relevant task. Use source-root imports and existing strict TypeScript/lint configuration.

- Write handwritten functions in `src/` as arrow functions, including hooks, utilities, helpers,
  components and test helpers. Preserve named/default exports and typing; generated files are exempt.
  Scaffolders emit this shape; retain it when extending their generated handwritten modules.
- `shared/` is generic; `business-commons/` is domain-shared; `core/` owns the app shell;
  `features/<domain>/pages/` owns business pages. Features do not import other features.
- Use mandatory generators with complete non-interactive flags before creating canonical artefacts.
  Match existing examples and barrels. Split types/helpers/models and handlers as the root rules require.
- Zustand stores retain state/actions, devtools/Immer, shallow equality, and namespaced actions.
  Contexts expose provider, consumer hook, and types through their barrel.
- Keep translations beside their owner, register `bootstrap/namespace-map.ts`, and retain literal typed
  namespaces/keys. Register page paths in `core/routing/routing.model.ts`; the map is not a router.
- Use project Apollo wrappers. Read [GraphQL guidance](graphql/CLAUDE.md) when working in that subtree.
- Use Vitest/React Testing Library for app tests. Changed shared/business-commons implementations need
  importing runnable tests; root guards enforce presence, not a coverage percentage.
- `src/vite/config/` belongs to the separate Vite TypeScript project; preserve the common/build/dev split
  and `.swcrc` loading. Do not change app/scaffolder module settings to fix a Vite-only issue.

Run relevant tests and root lint. Update generated GraphQL through codegen and graphs through their CLI.
