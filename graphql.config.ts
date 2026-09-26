import type { IGraphQLConfig } from 'graphql-config';

const config: IGraphQLConfig = {
  schema: 'schema.graphql',
  documents: ['src/graphql/{fragments,queries,mutations}/**/*.{graphql,ts,tsx}'],
};

export default config;
