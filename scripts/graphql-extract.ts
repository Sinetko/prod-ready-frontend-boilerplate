import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import ts from 'typescript';

import { Kind, parse, print } from 'graphql';

import { run } from './lib/cli';
import { documents } from './lib/documents';

run(async () => {
  const options: Record<string, { type: 'string' | 'boolean' }> = {};
  for (const flag of ['name', 'operation', 'fragment', 'pattern', 'path', 'ts-type'])
    options[flag] = { type: 'string' };
  options.help = { type: 'boolean' };
  const { values } = parseArgs({ options, strict: true });
  if (values.help) {
    console.log('graphql-extract --name TYPE | --operation NAME | --fragment NAME | --pattern REGEX');
    console.log('                --path DOCUMENT_GLOB | --ts-type TYPE');
    return;
  }
  const selectors = Object.keys(values).filter((key) => key !== 'help');
  if (selectors.length !== 1) throw new Error('Provide exactly one selector; use --help.');
  const selector = selectors[0];
  const search = String(values[selector]);
  const output: string[] = [];
  if (selector === 'ts-type') {
    const source = readFileSync('src/graphql/graphql-api-types.ts', 'utf8');
    const ast = ts.createSourceFile('graphql-api-types.ts', source, ts.ScriptTarget.Latest, true);
    for (const statement of ast.statements) {
      if (
        (ts.isTypeAliasDeclaration(statement) ||
          ts.isInterfaceDeclaration(statement) ||
          ts.isEnumDeclaration(statement)) &&
        statement.name.text === search
      )
        output.push(statement.getText(ast));
    }
  } else {
    const definitions =
      selector === 'path'
        ? documents(search)
        : selector === 'operation' || selector === 'fragment'
          ? documents()
          : parse(readFileSync('src/graphql/schema.graphql', 'utf8')).definitions;
    const pattern = selector === 'pattern' ? new RegExp(search) : undefined;
    for (const definition of definitions) {
      const name = 'name' in definition ? definition.name?.value : undefined;
      if (selector === 'operation' && definition.kind !== Kind.OPERATION_DEFINITION) continue;
      if (selector === 'fragment' && definition.kind !== Kind.FRAGMENT_DEFINITION) continue;
      if (selector === 'path' || (pattern ? pattern.test(name ?? '') : name === search)) output.push(print(definition));
    }
  }
  if (!output.length) throw new Error(`No match for --${selector} ${search}`);
  console.log(output.join('\n\n'));
});
