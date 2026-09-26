import ts from 'typescript';

import type { analyze } from './analyze';
import { localPath } from './inventory';

const prefix = 'autotests/playwright/';

export function autotests(context: ReturnType<typeof analyze>) {
  const { graphs, asts, add, walk, diagnostics } = context;
  const sources = asts.filter((source) => localPath(source.fileName).startsWith(prefix));
  const imports = new Map<string, string[]>();
  for (const entry of graphs.imports) {
    if (entry.relation !== 'imports') continue;
    imports.set(entry.from, [...(imports.get(entry.from) ?? []), entry.to]);
  }
  for (const source of sources) {
    const file = localPath(source.fileName);
    walk(source, (node) => {
      if (ts.isClassDeclaration(node) && node.name && /\/(app|pages|components)\//.test(file))
        add('autotests.facade', node, 'defines-facade', file, node.name.text, node.name.text);
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer &&
        ts.isCallExpression(node.initializer) &&
        /^(createMockFactory|createRestMockFactory)$/.test(node.initializer.expression.getText())
      )
        add('autotests.mock', node, 'defines-mock', file, node.name.text, node.name.text);
      if (!file.endsWith('.spec.ts') || !ts.isCallExpression(node)) return;
      const call = node.expression.getText();
      if (!/^(test|test\.(only|skip|fixme))$/.test(call)) return;
      const [title, details] = node.arguments;
      if (!title || !ts.isStringLiteralLike(title) || !details || !ts.isObjectLiteralExpression(details)) return;
      for (const property of details.properties) {
        if (!ts.isPropertyAssignment(property) || property.name.getText().replaceAll(/['"]/g, '') !== 'tag') continue;
        const tags = ts.isArrayLiteralExpression(property.initializer)
          ? property.initializer.elements
          : [property.initializer];
        for (const tag of tags) {
          if (!ts.isStringLiteralLike(tag) || !tag.text.startsWith('@C')) continue;
          if (!/^@C[1-9]\d*$/.test(tag.text)) {
            diagnostics.push(`${file}: invalid TestRail tag ${tag.text}; expected @C<positive integer>`);
            continue;
          }
          add('autotests.testrail', tag, 'testrail', `${file}#${title.text}`, tag.text.slice(1), tag.text.slice(1));
        }
      }
    });
  }
  for (const source of sources.filter((item) => localPath(item.fileName).endsWith('.spec.ts'))) {
    const file = localPath(source.fileName);
    const seen = new Set([file]);
    const queue = [file];
    for (let index = 0; index < queue.length; index += 1)
      for (const dependency of imports.get(queue[index]) ?? []) {
        if (seen.has(dependency)) continue;
        seen.add(dependency);
        queue.push(dependency);
        add('autotests.coverage', source, 'test-dependency', file, dependency, dependency);
      }
    for (const kind of ['autotests.facade', 'autotests.mock'] as const)
      for (const entry of graphs[kind].filter((item) => item.relation.startsWith('defines-')))
        if (seen.has(entry.path))
          add(kind, source, 'test-imports-module', file, entry.to, entry.name, `Module: ${entry.path}`);
  }
}
