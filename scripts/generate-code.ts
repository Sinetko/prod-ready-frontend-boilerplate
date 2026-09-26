import { generate, loadCodegenConfig } from '@graphql-codegen/cli';
import { writeFileSync } from 'node:fs';

import { run } from './lib/cli';
import { printedDocuments } from './lib/documents';

run(async () => {
  const content = printedDocuments();
  const { config } = await loadCodegenConfig({ configFilePath: 'codegen.yml' });
  if (process.env.BOOTSTRAP_SCHEMA) config.schema = process.env.BOOTSTRAP_SCHEMA;
  await generate(config, true);
  writeFileSync('src/graphql/documents.graphql', content);
});
