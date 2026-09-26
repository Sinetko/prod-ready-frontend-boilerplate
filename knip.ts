import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  // The page scaffolder consumes this registry through the TypeScript AST.
  entry: [
    'src/core/routing/routing.model.ts',
    'scripts/scaffold.spec.ts',
    'scripts/guards.spec.ts',
    'scripts/graphs.spec.ts',
    'scripts/graph-generate.ts',
    'scripts/graph-query.ts',
    '.claude/hooks/lib/agent-scope.mjs',
    '.claude/hooks/lib/{scaffold-guard,budget,session-logger,auto-codegen,graphs,docs-drift,feature-docs-drift}.mjs',
  ],
  // Keep internal modules in project, not entry, so unused exports are detected.
  project: ['src/**/*.{ts,tsx}', 'scripts/**/*.{ts,mts,cts,mjs}', '.claude/hooks/lib/*.mjs', '*.{ts,mts,cts}'],
  // Schema-wide generated exports are intentional; still analyze their imports/dependencies.
  // eslint-disable-next-line @typescript-eslint/naming-convention -- Knip requires file paths as keys.
  ignoreIssues: { 'src/graphql/graphql-api-types.ts': ['exports', 'types'] },
};

export default config;
