import { existsSync, statSync } from 'node:fs';

import { canonical, input, pathsFor } from './runtime.mjs';
import { writeTargets } from './shell-targets.mjs';

function shaped(path) {
  const name = path.replaceAll('\\', '/');
  return (
    /\.(page|component|context)\.tsx$/.test(name) ||
    /\.(hook|utils?|store)\.ts$/.test(name) ||
    /\/(queries|mutations)\/[^/]+\/[^/]+\.tag\.ts$/.test(name) ||
    /\/fragments\/[^/]+\.fragment\.ts$/.test(name)
  );
}

if (process.env.CLAUDE_DISABLE_SCAFFOLD_GUARD !== '1') {
  try {
    const event = input();
    let targets = [];
    if (['Write', 'Edit', 'MultiEdit'].includes(event.tool_name)) targets = pathsFor(event);
    else if (event.tool_name === 'Bash') {
      targets = writeTargets(event.tool_input?.command || '', event.cwd || process.cwd());
    }
    const blocked = targets.filter((path) => {
      return (shaped(path) || shaped(canonical(path))) && !(existsSync(path) && statSync(path).isFile());
    });
    if (blocked.length) {
      throw new Error(
        `New scaffold-shaped files require npm run generate-* -- --non-interactive: ${blocked.join(', ')}`
      );
    }
  } catch (error) {
    console.error(`scaffold-guard: ${error.message}`);
    process.exitCode = 2;
  }
}
