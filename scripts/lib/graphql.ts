import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  astFromValue,
  buildSchema,
  getNamedType,
  isCompositeType,
  isEnumType,
  isInputObjectType,
  isInterfaceType,
  isNonNullType,
  isObjectType,
  isScalarType,
  parse,
  print,
  validate,
} from 'graphql';
import type { GraphQLCompositeType, GraphQLOutputType } from 'graphql';

import { flags, names, value } from './cli';
import { documents } from './documents';
import { type Files, sourcePath, writeFiles } from './files';

function selection(type: GraphQLCompositeType, depth = 0): string {
  if (!isObjectType(type) && !isInterfaceType(type)) return '{ __typename }';
  const selected = ['__typename'];
  for (const field of Object.values(type.getFields())) {
    if (field.args.some((arg) => isNonNullType(arg.type) && arg.defaultValue === undefined)) continue;
    const named = getNamedType(field.type);
    if (isScalarType(named) || isEnumType(named)) selected.push(field.name);
    else if (isCompositeType(named) && depth < 2) selected.push(`${field.name} ${selection(named, depth + 1)}`);
  }
  return `{ ${selected.join('\n')} }`;
}

function fieldSelection(type: GraphQLOutputType) {
  const named = getNamedType(type);
  return isCompositeType(named) ? selection(named) : '';
}

export async function graphqlScaffold(fragment = false) {
  const args = await flags(fragment ? ['name', 'type'] : ['name', 'field'], ['schema'], !fragment);
  if (fragment && (args.lazy || args.mutation)) throw new Error('Fragments do not accept --lazy or --mutation.');
  if (args.lazy && args.mutation) throw new Error('--lazy and --mutation are mutually exclusive.');
  const { name, pascal, camel } = names(value(args, 'name'));
  const schemaFile = typeof args.schema === 'string' ? args.schema : 'schema.graphql';
  const schema = buildSchema(readFileSync(schemaFile, 'utf8'));
  const files: Files = new Map();
  let document: string;
  if (fragment) {
    const type = schema.getType(value(args, 'type'));
    if (!type || !isCompositeType(type)) throw new Error('--type must name a composite schema type.');
    document = `fragment ${pascal} on ${type.name} ${selection(type)}`;
    files.set(
      sourcePath(`src/graphql/fragments/${name}.fragment.ts`),
      `import { gql } from '@apollo/client';\nexport const ${camel}Fragment = gql\`${document}\`;\n`
    );
  } else {
    const mutation = !!args.mutation;
    const operation = mutation ? 'mutation' : 'query';
    const rootType = mutation ? schema.getMutationType() : schema.getQueryType();
    const field = rootType?.getFields()[value(args, 'field')];
    if (!field) throw new Error(`Unknown ${operation} field: ${args.field}`);
    const variables: string[] = [];
    const argumentsList: string[] = [];
    const sole = field.args.length === 1 ? field.args[0] : undefined;
    if (sole?.name === 'input' && isNonNullType(sole.type) && isInputObjectType(sole.type.ofType)) {
      const fields = Object.values(sole.type.ofType.getFields());
      for (const input of fields) {
        const defaultAst = input.defaultValue === undefined ? undefined : astFromValue(input.defaultValue, input.type);
        variables.push(`$${input.name}: ${input.type}${defaultAst ? ` = ${print(defaultAst)}` : ''}`);
      }
      argumentsList.push(`input: { ${fields.map((input) => `${input.name}: $${input.name}`).join(', ')} }`);
    } else {
      for (const arg of field.args) {
        const defaultAst = arg.defaultValue === undefined ? undefined : astFromValue(arg.defaultValue, arg.type);
        variables.push(`$${arg.name}: ${arg.type}${defaultAst ? ` = ${print(defaultAst)}` : ''}`);
        argumentsList.push(`${arg.name}: $${arg.name}`);
      }
    }
    const suffix = mutation ? 'Mutation' : 'Query';
    const operationName = pascal;
    const variableText = variables.length ? `(${variables.join(', ')})` : '';
    const argumentText = argumentsList.length ? `(${argumentsList.join(', ')})` : '';
    document =
      `${operation} ${operationName}${variableText} { ` +
      `${field.name}${argumentText} ${fieldSelection(field.type)} }`;
    const directory = sourcePath(`src/graphql/${mutation ? 'mutations' : 'queries'}/${name}`);
    const hookKind = mutation ? 'Mutation' : args.lazy ? 'LazyQuery' : 'Query';
    const wrapperPath = mutation ? 'mutation' : args.lazy ? 'lazy-query' : 'query';
    const wrapper = `useApollo${hookKind}`;
    const options = mutation ? 'useMutation.Options' : args.lazy ? 'useLazyQuery.Options' : 'useQuery.Options';
    const apolloHook = mutation ? 'useMutation' : args.lazy ? 'useLazyQuery' : 'useQuery';
    const typeName = `${operationName}${suffix}`;
    const variablesName = `${typeName}Variables`;
    const optional = !mutation && !args.lazy && variables.some((entry) => /!$/.test(entry)) ? '' : ' = {}';
    files.set(
      join(directory, `${name}.tag.ts`),
      `import { gql } from '@apollo/client';\nexport const ${camel}Tag = gql\`${document}\`;\n`
    );
    files.set(
      join(directory, `${name}.hook.ts`),
      `import type { ${apolloHook} } from '@apollo/client/react';\n` +
        `import { ${operationName}Document } from 'graphql/graphql-api-types';\n` +
        `import type { ${typeName}, ${variablesName} } from 'graphql/graphql-api-types';\n` +
        `import { ${wrapper} } from 'graphql/hooks/use-apollo-${wrapperPath}';\n` +
        `export const use${pascal}${hookKind} = (` +
        `options: ${options}<${typeName}, ${variablesName}>${optional}) => {\n` +
        `return ${wrapper}(${operationName}Document, options);\n};\n`
    );
    files.set(
      join(directory, 'index.ts'),
      `export { use${pascal}${hookKind} } from './${name}.hook';\nexport { ${camel}Tag } from './${name}.tag';\n`
    );
  }
  const errors = validate(schema, parse(document)).filter((error) => !error.message.includes('is never used'));
  if (errors.length) throw new Error(errors.map((error) => error.message).join('\n'));
  const existingDocuments = documents();
  const target = [...files.keys()].find((file) => file.endsWith('.tag.ts') || file.endsWith('.fragment.ts'));
  if (
    target &&
    !existsSync(target) &&
    existingDocuments.some(
      (definition) =>
        'name' in definition &&
        definition.name?.value === pascal &&
        definition.kind === (fragment ? 'FragmentDefinition' : 'OperationDefinition')
    )
  ) {
    throw new Error(`GraphQL document already exists: ${pascal}`);
  }
  await writeFiles(files);
  const result = spawnSync('npm', ['run', 'generate-code'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      ...(args.schema ? { BOOTSTRAP_SCHEMA: schemaFile } : {}),
    },
  });
  if (result.status !== 0) throw new Error('Code generation failed; fix the schema/documents and rerun.');
}
