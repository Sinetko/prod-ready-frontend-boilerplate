import { existsSync, readFileSync } from 'node:fs';
import { setTimeout } from 'node:timers/promises';

import { advisory, cachePath, hash, input, localPath, locked, notify, npm, pathsFor, rootFor } from './runtime.mjs';

await advisory(async () => {
  const event = input();
  const root = rootFor(event);
  if (event.hook_event_name === 'PostToolUse' && event.tool_name !== 'Bash') {
    const relevant = pathsFor(event).some((path) => {
      const file = localPath(root, path);
      return file && !/^(\.claude\/(cache|context-graphs)|node_modules|dist|\.git)\//.test(file);
    });
    if (!relevant) return;
    if (event.tool_use_id) {
      const name = `codegen-${hash(`${event.session_id}:${event.tool_use_id}`)}.done`;
      const done = cachePath(root, name);
      // Match Claude's default synchronous hook timeout; never leave an orphan waiter forever.
      const deadline = Date.now() + 600000;
      while (!existsSync(done)) {
        if (Date.now() >= deadline) throw new Error('Codegen completion unavailable; rerun graph-generate manually');
        await setTimeout(100);
      }
      if (!JSON.parse(readFileSync(done, 'utf8')).ok) {
        notify(['Context graph refresh deferred: fix the auto-codegen failure, then run npm run graph-generate.']);
        return;
      }
    }
  }
  await locked(root, 'graphs', () =>
    locked(root, 'codegen', () => {
      // Digest/fingerprint verification avoids rebuilding the AST for an unchanged baseline.
      if (npm(root, ['run', 'graph', '--', '--strict']).ok) return;
      const result = npm(root, ['run', 'graph-generate']);
      if (!result.ok) notify([`Context graph refresh failed: ${result.detail}`]);
    })
  );
});
