import { existsSync } from 'node:fs';

import { hash, inventory, json, local, locked, read, write } from './files.mjs';
import { docHashes, docPaths, dossier, fingerprint, select, snapshots } from './model.mjs';
import { status, validate } from './validation.mjs';

export function stamp(units, expected) {
  if (units.length !== 1 || !expected) throw new Error('Stamp requires --unit and --fingerprint from docs:context.');
  return locked(() => {
    const unit = units[0];
    if (unit.status === 'wip') throw new Error('Remove wip after finishing the unit before stamping.');
    if (fingerprint(unit) !== expected) throw new Error('Sources changed since dossier creation; rebuild and review.');
    validate(unit);
    const documents = docHashes(unit);
    const lock = snapshots();
    if (fingerprint(unit) !== expected) throw new Error('Sources changed during validation; retry.');
    lock.units[unit.id] = { fingerprint: expected, documents };
    json('docs/units.lock.json', lock);
    return { unit: unit.id, status: 'stamped' };
  });
}
export function backfill(units) {
  return locked(() =>
    units.map((unit) => {
      const context = dossier(unit);
      json(`.claude/cache/docs-context/${unit.id}.json`, context);
      const created = [];
      for (const [index, file] of docPaths(unit).entries()) {
        const type = index ? 'business' : 'technical';
        const text = read(`docs/templates/${unit.kind}.${type}.md`).replaceAll('{{title}}', unit.title);
        if (write(file, text, true)) created.push(file);
      }
      return {
        unit: unit.id,
        created,
        context: `.claude/cache/docs-context/${unit.id}.json`,
        status: status(unit).status,
        next: created.length
          ? 'Author/review documents, validate, then stamp; new templates are unfinished.'
          : 'Existing documents preserved; review reported status before further action.',
      };
    })
  );
}
export function drift() {
  const rows = select().map(status);
  const ids = new Set(select().map((unit) => unit.id));
  const orphaned = Object.keys(snapshots().units).filter((id) => !ids.has(id));
  const bad = rows.some((row) => !['current', 'wip'].includes(row.status)) || orphaned.length > 0;
  return { units: rows, orphanedSnapshots: orphaned, ok: !bad };
}
export function exportDocs(units, guides, publish) {
  if (publish)
    throw new Error('External documentation destination is not configured. Use --export for a local bundle.');
  return locked(() => {
    let files;
    if (guides) {
      files = inventory().filter(
        (file) =>
          file.endsWith('.md') &&
          (file === 'README.md' ||
            file === 'CLAUDE.md' ||
            file === 'AGENTS.md' ||
            file === 'docs/CODEX_SETUP.md' ||
            file.startsWith('.agents/skills/') ||
            file === 'docs/README.md' ||
            file.startsWith('.claude/docs/') ||
            file.startsWith('docs/templates/') ||
            file.endsWith('/CLAUDE.md') ||
            file.endsWith('/AGENTS.md'))
      );
    } else {
      const rows = units.map(status);
      if (rows.some((row) => row.status !== 'current')) throw new Error('Export requires all selected units current.');
      files = units.flatMap(docPaths);
    }
    const entries = files.sort().map((file) => ({ path: file, sha256: hash(read(file)) }));
    const digest = hash(JSON.stringify(entries));
    const destination = `.claude/cache/docs-export/${guides ? 'guides' : 'units'}/${digest}`;
    for (const file of files) {
      const target = `${destination}/${file}`;
      if (existsSync(local(target)) && read(target) !== read(file)) throw new Error(`Export was modified: ${target}`);
      write(target, read(file), true);
    }
    const manifest = `${destination}/manifest.json`;
    const content = `${JSON.stringify({ version: 1, published: false, entries }, null, 2)}\n`;
    if (existsSync(local(manifest)) && read(manifest) !== content) {
      throw new Error(`Export was modified: ${manifest}`);
    }
    write(manifest, content, true);
    return { destination, published: false, files: entries.length };
  });
}
