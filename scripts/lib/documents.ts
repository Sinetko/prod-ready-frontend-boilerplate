import { globSync, readFileSync } from 'node:fs';
import ts from 'typescript';

import { Kind, parse, print } from 'graphql';
import type { DefinitionNode } from 'graphql';

export function documents(pattern = 'src/graphql/{fragments,queries,mutations}/**/*.{graphql,ts,tsx}') {
  const definitions = new Map<string, DefinitionNode>();
  for (const file of globSync(pattern).sort()) {
    const source = readFileSync(file, 'utf8');
    const texts: string[] = [];
    if (file.endsWith('.graphql')) texts.push(source);
    else {
      const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
      function visit(node: ts.Node) {
        if (ts.isTaggedTemplateExpression(node) && node.tag.getText(ast) === 'gql') {
          if (!ts.isNoSubstitutionTemplateLiteral(node.template)) {
            throw new Error(`Use fragment spreads without template interpolation: ${file}`);
          }
          texts.push(node.template.text);
        }
        ts.forEachChild(node, visit);
      }
      visit(ast);
    }
    for (const text of texts) {
      for (const definition of parse(text).definitions) {
        if (definition.kind !== Kind.OPERATION_DEFINITION && definition.kind !== Kind.FRAGMENT_DEFINITION) continue;
        if (!definition.name) throw new Error(`Anonymous document: ${file}`);
        const name = `${definition.kind}:${definition.name.value}`;
        if (definitions.has(name)) throw new Error(`Duplicate GraphQL document name: ${name}`);
        definitions.set(name, definition);
      }
    }
  }
  return [...definitions.values()];
}

export function printedDocuments() {
  return (
    documents()
      .map((definition) => print(definition))
      .join('\n\n') + '\n'
  );
}
