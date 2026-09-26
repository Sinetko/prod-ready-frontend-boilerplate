import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { flags, names, value } from './cli';
import { type Files, root, sourcePath, writeFiles } from './files';
import { register } from './registry';

export async function scaffold(kind: string) {
  const required = kind === 'page' ? ['name', 'group', 'route', 'namespace'] : ['name', 'path'];
  const args = await flags(required);
  const naming = names(value(args, 'name'));
  const { name, pascal, camel } = naming;
  const files: Files = new Map();
  const editable: string[] = [];
  if (kind === 'page') {
    const group = names(value(args, 'group')).name;
    const route = value(args, 'route');
    const namespace = value(args, 'namespace');
    if (!route.startsWith('/') || /[\s?#]/.test(route)) throw new Error('--route must be an absolute route path.');
    names(namespace);
    const directory = sourcePath(`src/features/${group}/pages/${name}`);
    const original = readFileSync('src/features/example/pages/example/example.page.tsx', 'utf8');
    files.set(
      join(directory, `${name}.page.tsx`),
      original
        .replace(/ExamplePage/g, `${pascal}Page`)
        .replace("useTranslation('example')", `useTranslation('${namespace}')`)
    );
    files.set(
      join(directory, `${name}.translations.ts`),
      readFileSync('src/features/example/pages/example/example.translations.ts', 'utf8').replace(
        'exampleTranslations',
        `${camel}Translations`
      )
    );
    files.set(join(directory, 'index.ts'), `export { ${pascal}Page } from './${name}.page';\n`);
    const routing = resolve(root, 'src/core/routing/routing.model.ts');
    const namespaces = resolve(root, 'src/bootstrap/namespace-map.ts');
    files.set(routing, register(routing, 'routePaths', camel, JSON.stringify(route)));
    const translationAlias = `${names(namespace).camel}Translations`;
    const importLine =
      `import { ${camel}Translations as ${translationAlias} } from ` +
      `'features/${group}/pages/${name}/${name}.translations';`;
    files.set(namespaces, register(namespaces, 'namespaceMap', namespace, translationAlias, importLine));
    editable.push(routing, namespaces);
  } else if (kind === 'component') {
    const directory = sourcePath(join(value(args, 'path'), name));
    files.set(
      join(directory, `${name}.component.tsx`),
      `import type { ${pascal}Props } from './${name}.types';\n` +
        `export const ${pascal} = ({ children }: ${pascal}Props) => { return <div>{children}</div>; };\n`
    );
    files.set(
      join(directory, `${name}.types.ts`),
      `import type { ReactNode } from 'react';\nexport interface ${pascal}Props { children?: ReactNode; }\n`
    );
    files.set(
      join(directory, 'index.ts'),
      `export { ${pascal} } from './${name}.component';\nexport type { ${pascal}Props } from './${name}.types';\n`
    );
  } else {
    if (kind === 'hook' && !name.startsWith('use-')) throw new Error('Hook --name must start with use-.');
    const templates: Record<string, string> = {
      hook: 'src/shared/hooks/use-example',
      util: 'src/shared/utils/example',
      store: 'src/core/stores/example',
      context: 'src/core/contexts/example',
    };
    const template = templates[kind];
    if (!template) throw new Error(`Unknown artefact: ${kind}`);
    const directory = sourcePath(join(value(args, 'path'), name));
    const baseName = kind === 'hook' ? name.slice(4) : name;
    const replacement = names(baseName);
    for (const file of readdirSync(template)) {
      const outputName = file.replace(/example/g, baseName);
      const content = readFileSync(join(template, file), 'utf8')
        .replace(/Example/g, replacement.pascal)
        .replace(/example/g, replacement.camel)
        .replaceAll(`use-${replacement.camel}`, `use-${baseName}`)
        .replaceAll(`./${replacement.camel}.`, `./${baseName}.`);
      files.set(join(directory, outputName), content);
    }
  }
  await writeFiles(files, editable);
  console.log(`Verified/generated ${kind}: ${name}`);
}
