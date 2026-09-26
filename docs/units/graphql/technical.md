# GraphQL integration

## Scope

Project-owned Apollo wrappers, local schema/codegen configuration, document extraction, and generated GraphQL artefacts. Generated outputs are consumed through focused lookup and typed documents.

## Service contract

Handwritten documents are collected by codegen. App callers use project wrappers, and operation scaffolding invokes generation. The wrappers pass arguments/results through and retain Apollo typing.

## Verified claims

- [C1] The normal query wrapper preserves the raw hook type and passes arguments through. <!-- evidence: {"path": "src/graphql/hooks/use-apollo-query/use-apollo-query.hook.ts", "contains": "as typeof useQuery;"} -->
- [C2] The lazy-query wrapper preserves the raw hook type. <!-- evidence: {"path": "src/graphql/hooks/use-apollo-lazy-query/use-apollo-lazy-query.hook.ts", "contains": "as typeof useLazyQuery;"} -->
- [C3] The mutation wrapper preserves the raw hook type. <!-- evidence: {"path": "src/graphql/hooks/use-apollo-mutation/use-apollo-mutation.hook.ts", "contains": "as typeof useMutation;"} -->
- [C4] Code generation loads codegen.yml, supports a BOOTSTRAP_SCHEMA override, and runs generation. <!-- evidence: {"path": "scripts/generate-code.ts", "contains": "if (process.env.BOOTSTRAP_SCHEMA) config.schema = process.env.BOOTSTRAP_SCHEMA;"} -->
- [C5] After generation, the collected documents are written to documents.graphql. <!-- evidence: {"path": "scripts/generate-code.ts", "contains": "writeFileSync('src/graphql/documents.graphql', content);"} -->
- [C6] The codegen plugin list includes typed document nodes. <!-- evidence: {"path": "codegen.yml", "contains": "- typed-document-node"} -->

## Verification

Run `npm run generate-code`, `npm run lint:types`, and `npm test`. The mutation wrapper test lives in `src/graphql/hooks/use-apollo-mutation/use-apollo-mutation.spec.tsx`. Run `npm run test:scaffolders` for schema-driven operation generation and extraction checks.

## Limitations

Wrappers do not configure a network client, credentials, retries, or application error UX. Generated outputs may be large: never read them wholesale or hand-edit them. The local schema is a bootstrap contract, not evidence of a deployed service.
