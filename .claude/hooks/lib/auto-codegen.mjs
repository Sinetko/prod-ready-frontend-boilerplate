import { readFileSync, renameSync, writeFileSync } from 'node:fs';

import { cachePath, hash, input, localPath, locked, npm, pathsFor, rootFor } from './runtime.mjs';

let event;
let root;
try {
  event = input();
  root = rootFor(event);
  const changed = pathsFor(event).some((path) => {
    const file = localPath(root, path);
    if (!file || !/^src\/graphql\/(fragments|queries|mutations)\/.*\.(graphql|tsx?)$/.test(file)) return false;
    // A .tag/.fragment edit must regenerate even if it removed the last gql literal.
    if (/\.(graphql|tag\.ts|fragment\.ts)$/.test(file)) return true;
    const tool = event.tool_input || {};
    const previous = [tool.old_string, ...(tool.edits || []).map((edit) => edit.old_string)].join('\n');
    return /\bgql\s*`/.test(previous + '\n' + readFileSync(path, 'utf8'));
  });
  if (changed) {
    await locked(root, 'codegen', () => {
      const result = npm(root, ['run', 'generate-code']);
      if (!result.ok) throw new Error(result.detail || 'generate-code failed');
    });
  }
} catch (error) {
  console.error(`auto-codegen: ${error.message}`);
  process.exitCode = 2;
} finally {
  // PostToolUse handlers run in parallel. Publish completion for the async graph consumer.
  if (root && event?.tool_use_id) {
    const name = `codegen-${hash(`${event.session_id}:${event.tool_use_id}`)}.done`;
    const target = cachePath(root, name);
    const temporary = `${target}.${process.pid}.tmp`;
    writeFileSync(temporary, JSON.stringify({ ok: process.exitCode !== 2 }));
    renameSync(temporary, target);
  }
}
