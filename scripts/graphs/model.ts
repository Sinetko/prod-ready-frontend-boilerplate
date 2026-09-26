export const kinds = [
  'imports',
  'dependents',
  'references',
  'symbols',
  'symbols.components',
  'symbols.hooks',
  'symbols.utils',
  'symbols.types',
  'symbols.graphql',
  'routes',
  'features',
  'translations',
  'graphql-operations',
  'graphql-usage',
  'data-flow',
  'render-flow',
  'build-pipeline',
  'analytics-events',
  'unit-edges',
  'globals',
  'autotests.testrail',
  'autotests.coverage',
  'autotests.facade',
  'autotests.mock',
] as const;
export type Kind = (typeof kinds)[number];
export interface RecordEntry {
  relation: string;
  from: string;
  to: string;
  path: string;
  line: number;
  name?: string;
  detail?: string;
}
export interface Graph {
  version: 1;
  kind: Kind;
  fingerprint: string;
  records: RecordEntry[];
}
export interface Manifest {
  version: 1;
  fingerprint: string;
  files: string[];
  diagnostics: string[];
  outputs: Record<string, { hash: string; count: number }>;
}
export const directory = '.claude/context-graphs';
