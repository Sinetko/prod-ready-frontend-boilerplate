import { createHash } from 'node:crypto';
import { createReadStream, readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

import { digest, fingerprint, inventory } from './inventory';
import { directory, kinds } from './model';
import type { Graph, Kind, Manifest, RecordEntry } from './model';

const selectors = ['dependents', 'depends-on', 'symbol', 'route', 'unit', 'consumers', 'defines', 'emits', 'config'];
const autotestSelectors = ['testrail', 'coverage', 'facade', 'mock'];
const help = `Usage: npm run graph -- [selector] [options]
Selectors (one): --dependents FILE | --depends-on FILE | --symbol NAME | --defines NAME
  --consumers NAME | --route NAME_OR_URL | --unit ID | --emits EVENT | --config TEXT
Options: --path FILE_OR_DIRECTORY (filter, or imports selector), --depth N (dependency traversal, default 1)
  --graph KIND (explicit graph), --json, --strict, --help
Kinds: ${kinds.join(', ')}
--strict alone audits every output using streaming hashes; only globals.graph.json is parsed.
Queries parse one graph. Exact symbol names/IDs; config uses substring matching; paths are repository-relative.
--scope autotests: restrict evidence to autotests/playwright/; adds --testrail C123,
  --coverage FILE (static test-import reachability, not runtime coverage), --facade NAME, --mock NAME.
  --testrail also accepts @C123. Literal per-test tag metadata only; no inherited/dynamic tags.`;
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function manifest(): Manifest {
  const result: unknown = JSON.parse(readFileSync(`${directory}/index.json`, 'utf8'));
  if (
    !object(result) ||
    result.version !== 1 ||
    typeof result.fingerprint !== 'string' ||
    !Array.isArray(result.files) ||
    !result.files.every((file) => typeof file === 'string') ||
    !Array.isArray(result.diagnostics) ||
    !result.diagnostics.every((issue) => typeof issue === 'string') ||
    !object(result.outputs)
  )
    throw new Error('Invalid graph manifest; run graph-generate.');
  for (const kind of kinds) {
    const output = result.outputs[`${kind}.graph.json`];
    if (
      !object(output) ||
      typeof output.hash !== 'string' ||
      !/^[a-f0-9]{64}$/.test(output.hash) ||
      !Number.isInteger(output.count) ||
      Number(output.count) < 0
    )
      throw new Error(`Invalid manifest entry: ${kind}`);
  }
  return result as unknown as Manifest;
}
function load(kind: Kind, index: Manifest): Graph {
  const text = readFileSync(`${directory}/${kind}.graph.json`, 'utf8');
  if (digest(text) !== index.outputs[`${kind}.graph.json`].hash)
    throw new Error(`Corrupt or mixed graph generation: ${kind}; run graph-generate.`);
  const graph: unknown = JSON.parse(text);
  if (
    !object(graph) ||
    graph.version !== 1 ||
    graph.kind !== kind ||
    graph.fingerprint !== index.fingerprint ||
    !Array.isArray(graph.records) ||
    graph.records.length !== index.outputs[`${kind}.graph.json`].count ||
    !graph.records.every(
      (entry) =>
        object(entry) &&
        ['relation', 'from', 'to', 'path'].every((key) => typeof entry[key] === 'string') &&
        Number.isInteger(entry.line) &&
        Number(entry.line) > 0 &&
        (entry.name === undefined || typeof entry.name === 'string') &&
        (entry.detail === undefined || typeof entry.detail === 'string')
    )
  )
    throw new Error(`Invalid graph: ${kind}`);
  return graph as unknown as Graph;
}
async function audit(index: Manifest) {
  if (fingerprint(inventory()) !== index.fingerprint) throw new Error('Stale context graphs; run graph-generate.');
  for (const kind of kinds) {
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(`${directory}/${kind}.graph.json`)) hash.update(chunk);
    if (hash.digest('hex') !== index.outputs[`${kind}.graph.json`].hash)
      throw new Error(`Corrupt or mixed graph generation: ${kind}; run graph-generate.`);
  }
  if (index.diagnostics.length) throw new Error(index.diagnostics.join('\n'));
}
function pathMatch(file: string, path: string) {
  return file === path || file.startsWith(`${path}/`);
}
function traversal(records: RecordEntry[], start: string, depth: number) {
  const result: RecordEntry[] = [];
  const seen = new Set([start]);
  let frontier = [start];
  const adjacency = new Map<string, RecordEntry[]>();
  for (const entry of records) {
    if (entry.relation !== 'imports' && entry.relation !== 'dependent') continue;
    const edges = adjacency.get(entry.from) ?? [];
    edges.push(entry);
    adjacency.set(entry.from, edges);
  }
  for (let level = 0; level < depth && frontier.length; level += 1) {
    const next: string[] = [];
    for (const node of frontier)
      for (const edge of adjacency.get(node) ?? []) {
        result.push(edge);
        if (!seen.has(edge.to)) {
          seen.add(edge.to);
          next.push(edge.to);
        }
      }
    frontier = next;
  }
  return result;
}
export async function query() {
  const options: Record<string, { type: 'string' | 'boolean' }> = {};
  for (const name of [...selectors, ...autotestSelectors, 'path', 'depth', 'scope', 'graph'])
    options[name] = { type: 'string' };
  for (const name of ['json', 'strict', 'help']) options[name] = { type: 'boolean' };
  const { values } = parseArgs({ options, strict: true, allowPositionals: false });
  if (values.help) {
    console.log(help);
    return;
  }
  if (values.scope !== undefined && values.scope !== 'autotests')
    throw new Error('Only --scope autotests is supported.');
  if (!values.scope && autotestSelectors.some((name) => values[name] !== undefined))
    throw new Error('Autotest selectors require --scope autotests.');
  const active = [...selectors, ...autotestSelectors].filter((name) => values[name] !== undefined);
  if (active.length > 1) throw new Error('Choose one selector; --path can be combined as a filter.');
  for (const [name, value] of Object.entries(values))
    if (typeof value === 'string' && !value.trim()) throw new Error(`--${name} cannot be empty.`);
  const selector = active[0];
  if (!selector && !values.path && !values.graph && !values.strict) throw new Error(help);
  if (values.depth && selector !== 'dependents' && selector !== 'depends-on')
    throw new Error('--depth requires --dependents or --depends-on.');
  const depth = Number(values.depth ?? 1);
  if (!Number.isInteger(depth) || depth < 1 || depth > 50) throw new Error('--depth must be an integer from 1 to 50.');
  const mapping: Record<string, Kind> = {
    dependents: 'dependents',
    // eslint-disable-next-line @typescript-eslint/naming-convention -- Public CLI flag.
    'depends-on': 'imports',
    symbol: 'symbols',
    defines: 'symbols',
    route: 'routes',
    unit: 'unit-edges',
    consumers: 'references',
    emits: 'analytics-events',
    config: 'build-pipeline',
    testrail: 'autotests.testrail',
    coverage: 'autotests.coverage',
    facade: 'autotests.facade',
    mock: 'autotests.mock',
  };
  const selected = values.graph ?? mapping[selector] ?? (values.path ? 'imports' : 'globals');
  if (!kinds.includes(selected as Kind)) throw new Error(`Unknown graph: ${selected}`);
  if (values.graph && (selector === 'dependents' || selector === 'depends-on') && selected !== mapping[selector])
    throw new Error('Dependency traversal requires its corresponding imports/dependents graph.');
  if (values.graph && autotestSelectors.includes(selector) && selected !== mapping[selector])
    throw new Error('Autotest selector requires its corresponding graph.');
  if (selector === 'testrail' && !/^@?C[1-9]\d*$/.test(String(values.testrail)))
    throw new Error('--testrail requires C<positive integer> or @C<positive integer>.');
  const index = manifest();
  if (values.strict) await audit(index);
  const graph = load(selected as Kind, index);
  const requested = selector ? String(values[selector]).replace(selector === 'testrail' ? /^@/ : /$^/, '') : '';
  let records = graph.records;
  if (selector === 'dependents' || selector === 'depends-on') records = traversal(records, requested, depth);
  else if (selector)
    records = records.filter((entry) =>
      selector === 'config'
        ? [entry.name, entry.from, entry.to, entry.detail].some((part) => part?.includes(requested))
        : [entry.name, entry.from, entry.to].includes(requested)
    );
  if (values.path) {
    const path = String(values.path).replace(/^\.\//, '').replace(/\/$/, '');
    if (!path || path.startsWith('/') || path.split('/').includes('..'))
      throw new Error('--path must be repository-relative.');
    records = records.filter((entry) => [entry.path, entry.from, entry.to].some((file) => pathMatch(file, path)));
  }
  if (values.scope === 'autotests') records = records.filter((entry) => entry.path.startsWith('autotests/playwright/'));
  if (values.json) console.log(JSON.stringify({ graph: graph.kind, records, diagnostics: index.diagnostics }, null, 2));
  else {
    console.log(`${graph.kind}: ${records.length} matching records${values.strict ? ' (strict audit passed)' : ''}`);
    for (const entry of records)
      console.log(`${entry.path}:${entry.line} ${entry.relation}: ${entry.from} -> ${entry.to}`);
    if (!values.strict && index.diagnostics.length)
      console.warn('Generation has diagnostics; use --strict for details.');
  }
}
