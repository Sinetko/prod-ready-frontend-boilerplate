import { parseArgs } from 'node:util';
import prompts from 'prompts';

export async function flags(required: string[], optional: string[] = [], operation = false) {
  const options: Record<string, { type: 'string' | 'boolean' }> = {};
  for (const name of [...required, ...optional]) options[name] = { type: 'string' };
  for (const name of ['non-interactive', 'help', ...(operation ? ['lazy', 'mutation'] : [])])
    options[name] = { type: 'boolean' };
  const { values } = parseArgs({ options, strict: true });
  if (values.help) {
    console.log(`Required: ${required.map((name) => `--${name} <value>`).join(' ')}`);
    console.log(`Optional: ${optional.map((name) => `--${name} <value>`).join(' ')} --non-interactive`);
    if (operation) console.log('Variants: --lazy | --mutation');
    process.exit(0);
  }
  const missing = required.filter((name) => typeof values[name] !== 'string' || !String(values[name]).trim());
  if (missing.length && values['non-interactive']) {
    throw new Error(`Missing required flags: ${missing.map((name) => `--${name}`).join(', ')}`);
  }
  for (const name of missing) {
    const answer = await prompts(
      { type: 'text', name: 'value', message: name },
      {
        onCancel: () => {
          throw new Error('Generation cancelled.');
        },
      }
    );
    if (!answer.value?.trim()) throw new Error(`Required: --${name}`);
    values[name] = answer.value;
  }
  if (operation && !values['non-interactive'] && !values.lazy && !values.mutation) {
    const answer = await prompts(
      {
        type: 'select',
        name: 'mode',
        message: 'Operation variant',
        choices: [
          { title: 'Query', value: 'query' },
          { title: 'Lazy query', value: 'lazy' },
          { title: 'Mutation', value: 'mutation' },
        ],
      },
      {
        onCancel: () => {
          throw new Error('Generation cancelled.');
        },
      }
    );
    if (answer.mode === 'lazy') values.lazy = true;
    if (answer.mode === 'mutation') values.mutation = true;
  }
  return values;
}

export function value(values: Record<string, unknown>, key: string) {
  const result = values[key];
  if (typeof result !== 'string' || !result.trim()) throw new Error(`Required: --${key}`);
  return result;
}

export function names(name: string) {
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name)) throw new Error('Name must be kebab-case.');
  const pascal = name
    .split('-')
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('');
  return { name, pascal, camel: pascal[0].toLowerCase() + pascal.slice(1) };
}

export function run(action: () => Promise<void>) {
  void action().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
