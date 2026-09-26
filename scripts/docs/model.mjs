import { existsSync, readFileSync } from 'node:fs';
import { matchesGlob } from 'node:path';

import { generated, hash, inventory, local, read } from './files.mjs';

const kinds = ['feature', 'functionality', 'service', 'infra'];
function registry() {
  const units = JSON.parse(read('docs/units.map.json'));
  if (!Array.isArray(units) || !units.length) throw new Error('units.map.json must be a nonempty array.');
  const ids = new Set();
  for (const unit of units) {
    if (
      !unit ||
      !/^[a-z][a-z0-9-]*$/.test(unit.id) ||
      ids.has(unit.id) ||
      !kinds.includes(unit.kind) ||
      typeof unit.title !== 'string' ||
      !unit.title.trim() ||
      !Array.isArray(unit.globs) ||
      !unit.globs.length ||
      unit.globs.some(
        (glob) =>
          typeof glob !== 'string' ||
          !glob ||
          glob.startsWith('/') ||
          /[\\\0]/.test(glob) ||
          glob.split('/').includes('..') ||
          glob.startsWith('!')
      ) ||
      (unit.status !== undefined && unit.status !== 'wip')
    )
      throw new Error('Invalid or duplicate documentation unit.');
    ids.add(unit.id);
  }
  return units;
}
export function select(id) {
  const units = registry();
  if (!id) return units;
  const selected = units.filter((unit) => unit.id === id);
  if (!selected.length) throw new Error(`Unknown unit: ${id}`);
  return selected;
}
export function members(unit) {
  const files = inventory().filter(
    (file) => !file.startsWith('docs/') && unit.globs.some((glob) => matchesGlob(file, glob))
  );
  if (!files.length) throw new Error(`${unit.id}: globs match no source files.`);
  return files;
}
export function fingerprint(unit) {
  const files = members(unit);
  const inputs = [
    ...files,
    `docs/templates/${unit.kind}.technical.md`,
    `docs/templates/${unit.kind}.business.md`,
    ...inventory('scripts/docs'),
  ];
  return hash(
    JSON.stringify([unit, ...[...new Set(inputs)].sort().map((file) => [file, hash(readFileSync(local(file)))])])
  );
}
export function docPaths(unit) {
  return ['technical', 'business'].map((type) => `docs/units/${unit.id}/${type}.md`);
}
export function docHashes(unit) {
  return Object.fromEntries(docPaths(unit).map((file) => [file, hash(read(file))]));
}
export function snapshots() {
  if (!existsSync(local('docs/units.lock.json'))) return { version: 1, units: {} };
  const lock = JSON.parse(read('docs/units.lock.json'));
  if (lock?.version !== 1 || !lock.units || Array.isArray(lock.units) || typeof lock.units !== 'object') {
    throw new Error('Invalid docs/units.lock.json; do not repair freshness by hand.');
  }
  return lock;
}
export function dossier(unit) {
  const files = members(unit);
  return {
    version: 1,
    unit,
    fingerprint: fingerprint(unit),
    instructions:
      'Read focused handwritten sources; use graph and graphql-extract for generated contracts. ' +
      'Validate technical claims, derive business.md, then validate and stamp. ' +
      'Dossier is an inventory, not authored docs.',
    templates: [`docs/templates/${unit.kind}.technical.md`, `docs/templates/${unit.kind}.business.md`],
    documents: docPaths(unit),
    files: files.map((file) => ({ path: file, sha256: hash(readFileSync(local(file))), generated: generated(file) })),
  };
}
