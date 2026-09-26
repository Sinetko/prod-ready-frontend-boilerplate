# Example page

## Scope

Canonical demonstration feature composed from the example page, context, hook, utility, store and English translations. This is scaffolder reference behavior, not a production business domain.

## User workflow

The app waits for i18n, mounts the provider and page, and exposes count and detail controls. The claims below describe the demonstrated interactions and provider boundary.

## Verified claims

- [C1] The application renders the example page inside a provider whose label is World. <!-- evidence: {"path": "src/app/index.tsx", "contains": "<ExampleProvider label=\"World\">"} -->
- [C2] The counter starts at zero. <!-- evidence: {"path": "src/core/stores/example/example.store.ts", "contains": "state: { count: 0 }"} -->
- [C3] Increment adds one and reset restores zero. <!-- evidence: {"path": "src/core/stores/example/example.store.ts", "contains": "store.state.count += 1;"} -->
- [C4] Reset restores the count to zero. <!-- evidence: {"path": "src/core/stores/example/example.store.ts", "contains": "store.state.count = 0;"} -->
- [C5] Details are hidden when the local enabled flag is false. <!-- evidence: {"path": "src/features/example/pages/example/example.page.tsx", "contains": "<p id=\"example-details\" hidden={!enabled}>"} -->
- [C6] The local toggle flips its prior enabled state; its default is disabled. <!-- evidence: {"path": "src/shared/hooks/use-example/use-example.hook.ts", "contains": "initialEnabled = false"} -->
- [C7] Using the context outside its provider throws a descriptive error. <!-- evidence: {"path": "src/core/contexts/example/example.context.tsx", "contains": "throw new Error('useExampleContext must be used within ExampleProvider.');"} -->
- [C8] The translation instance uses English resources from namespaceMap. <!-- evidence: {"path": "src/bootstrap/i18n.ts", "contains": "resources: { en: namespaceMap }"} -->

## Verification

Run `npm test` for the example integration, hook and utility tests. `src/app/example.spec.tsx` exercises the canonical barrels and rendered interactions. Run `npm run lint` for source/types/style/dependency/guard checks.

## Limitations

This demo has no persistence, remote-data UI, or production routing contract. English example resources do not establish a product locale policy. Counter actions are in-memory; the local detail toggle is per hook instance.
