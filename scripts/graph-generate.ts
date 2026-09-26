import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

import { analyze } from './graphs/analyze';
import { autotests } from './graphs/autotests';
import { domains } from './graphs/domains';
import { digest, fingerprint, inventory } from './graphs/inventory';
import { directory, kinds } from './graphs/model';
import type { Graph, Manifest } from './graphs/model';

try {
  const { values } = parseArgs({ options: { help: { type: 'boolean' } }, strict: true });
  if (values.help)
    console.log('graph-generate: index repository sources into .claude/context-graphs (run at repo root).');
  else {
    const files = inventory();
    const stamp = fingerprint(files);
    const context = analyze(files);
    domains(context, files);
    autotests(context);
    const manifest: Manifest = {
      version: 1,
      fingerprint: stamp,
      files,
      diagnostics: [...new Set(context.diagnostics)].sort(),
      outputs: {},
    };
    const outputs = new Map<string, string>();
    for (const kind of kinds) {
      const records = [...new Map(context.graphs[kind].map((entry) => [JSON.stringify(entry), entry])).values()].sort(
        (a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b), 'en')
      );
      const graph: Graph = { version: 1, kind, fingerprint: stamp, records };
      const text = JSON.stringify(graph, null, 2) + '\n';
      const file = `${kind}.graph.json`;
      outputs.set(file, text);
      manifest.outputs[file] = { hash: digest(text), count: records.length };
      if (Buffer.byteLength(text) > 50 * 1024) console.warn(`${file} exceeds 50KB: split it further.`);
    }
    outputs.set(
      'index.md',
      '# Context graphs\n\nGenerated; query with `npm run graph -- --help`. Do not read graph JSON directly.\n\n' +
        '| Graph | Records |\n| --- | ---: |\n' +
        kinds.map((kind) => `| ${kind} | ${manifest.outputs[`${kind}.graph.json`].count} |`).join('\n') +
        '\n\nStatic evidence only; see README.md for coverage and limitations.\n' +
        `\nDiagnostics: ${manifest.diagnostics.length}. Run \`npm run graph -- --strict\` to audit.\n`
    );
    if (fingerprint(inventory()) !== stamp) throw new Error('Sources changed during generation; rerun graph-generate.');
    mkdirSync(directory, { recursive: true });
    // Publish the manifest last. Readers reject partial generations by digest.
    outputs.set('index.json', JSON.stringify(manifest, null, 2) + '\n');
    for (const [file, content] of outputs) {
      const target = `${directory}/${file}`;
      let current: string | undefined;
      try {
        current = readFileSync(target, 'utf8');
      } catch {
        /* First generation. */
      }
      if (current === content) continue;
      const temporary = `${target}.${process.pid}.tmp`;
      try {
        writeFileSync(temporary, content);
        renameSync(temporary, target);
      } finally {
        rmSync(temporary, { force: true });
      }
    }
    console.log(`Generated ${kinds.length} graphs from ${files.length} files.`);
    if (manifest.diagnostics.length) {
      console.error(manifest.diagnostics.join('\n'));
      process.exitCode = 1;
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
