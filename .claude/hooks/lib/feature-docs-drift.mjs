import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, matchesGlob } from 'node:path';

import { advisory, cachePath, hash, input, localPath, locked, notify, npm, pathsFor, rootFor } from './runtime.mjs';

await advisory(async () => {
  const event = input();
  const root = rootFor(event);
  const paths = pathsFor(event)
    .map((path) => localPath(root, path))
    .filter(Boolean);
  if (!paths.length) return;
  const map = join(root, 'docs/units.map.json');
  if (!existsSync(map)) {
    notify(['feature-docs-drift: Phase 14 setup pending (docs/units.map.json is absent).']);
    return;
  }
  const units = JSON.parse(readFileSync(map, 'utf8'));
  if (!Array.isArray(units)) throw new Error('docs/units.map.json must contain an array');
  const ids = new Set();
  const messages = [];
  for (const unit of units) {
    if (
      !unit ||
      typeof unit.id !== 'string' ||
      !unit.id ||
      unit.id === '.' ||
      unit.id === '..' ||
      /[/\\\0]/.test(unit.id) ||
      ids.has(unit.id) ||
      !Array.isArray(unit.globs) ||
      !unit.globs.every((glob) => typeof glob === 'string')
    ) {
      throw new Error('Invalid or duplicate documentation unit');
    }
    ids.add(unit.id);
    if (unit.status === 'wip' || !paths.some((path) => unit.globs.some((glob) => matchesGlob(path, glob)))) continue;
    await locked(root, `feature-${hash(unit.id)}`, () => {
      const stamp = cachePath(root, `feature-${hash(unit.id)}.stamp`);
      const previous = existsSync(stamp) ? Number(readFileSync(stamp, 'utf8')) : 0;
      const now = Date.now();
      if (previous <= now && now - previous < 30000) return;
      writeFileSync(stamp, String(now));
      const technical = `docs/units/${unit.id}/technical.md`;
      if (!existsSync(join(root, technical))) {
        messages.push(`feature-docs-drift: ${unit.id} is missing ${technical}.`);
        return;
      }
      const scripts = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts || {};
      if (!scripts['docs:status']) {
        messages.push(`feature-docs-drift: ${unit.id} freshness unknown; Phase 14 docs:status is not installed.`);
        return;
      }
      const result = npm(root, ['run', 'docs:status', '--', '--unit', unit.id, '--check']);
      if (!result.ok) messages.push(`feature-docs-drift: ${unit.id} is stale or docs:status failed. ${result.detail}`);
    });
  }
  notify(messages);
});
