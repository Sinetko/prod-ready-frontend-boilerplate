import { lstatSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';

import { input, rootFor } from './runtime.mjs';

const policies = {
  architect: { directory: '.claude/plans', writes: ['Write'] },
  tester: { directory: 'autotests', writes: ['Write', 'Edit', 'MultiEdit'] },
  'bizdoc-writer': { directory: 'docs/units', writes: ['Write', 'Edit', 'MultiEdit'], markdown: true, bash: true },
  'bizdoc-business-writer': { directory: 'docs/units', writes: ['Write', 'Edit', 'MultiEdit'], markdown: true },
};

function inside(directory, path) {
  const suffix = relative(directory, path);
  return suffix !== '' && suffix !== '..' && !suffix.startsWith(`..${sep}`) && !isAbsolute(suffix);
}

function checkPath(root, cwd, value, policy) {
  if (typeof value !== 'string' || !value.trim() || value.includes('\0') || value.split(/[\\/]/).includes('..')) {
    throw new Error('Missing or invalid target path (parent traversal is not allowed)');
  }
  const path = resolve(cwd, value);
  if (!inside(resolve(root, policy.directory), path)) throw new Error(`Writes are limited to ${policy.directory}/`);
  if (policy.markdown && !path.endsWith('.md')) throw new Error('Documentation writers may only write Markdown');

  // Reject links instead of following them, including dangling links and links inside the allowed tree.
  // Check every existing ancestor so new files cannot escape through a linked directory.
  let current = root;
  for (const part of relative(root, path).split(sep)) {
    current = resolve(current, part);
    let stat;
    try {
      stat = lstatSync(current);
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    if (stat.isSymbolicLink()) throw new Error('Symlink targets/ancestors are not allowed for scoped writes');
    if (stat.isFile() && stat.nlink > 1) throw new Error('Hard-linked files are not allowed for scoped writes');
    if (current !== path && !stat.isDirectory()) throw new Error('A target ancestor is not a directory');
    if (current === path && !stat.isFile()) throw new Error('An existing write target must be a regular file');
  }
}

try {
  const policy = policies[process.argv[2]];
  if (!policy || process.argv.length !== 3) throw new Error('Expected a known scoped agent role');
  const event = input();
  if (event.hook_event_name !== 'PreToolUse') throw new Error('Expected a PreToolUse event');
  const tool = event.tool_name;
  if (['Read', 'Grep', 'Glob'].includes(tool) || (tool === 'Bash' && policy.bash)) {
    // Bash for the technical writer remains read-only by prompt convention, not a shell sandbox.
    process.exit(0);
  }
  if (!policy.writes.includes(tool)) throw new Error(`${tool || 'Unknown tool'} is unavailable to this role`);
  const root = realpathSync(rootFor(event));
  const cwd = realpathSync(event.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd());
  const data = event.tool_input;
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Missing tool_input');
  const paths = [data.file_path];
  if (data.path !== undefined) paths.push(data.path);
  if (tool === 'MultiEdit') {
    if (!Array.isArray(data.edits) || data.edits.length === 0) throw new Error('Missing MultiEdit edits');
    for (const edit of data.edits) {
      if (!edit || typeof edit !== 'object' || Array.isArray(edit)) throw new Error('Invalid MultiEdit edit');
      if (edit.file_path !== undefined) paths.push(edit.file_path);
      if (edit.path !== undefined) paths.push(edit.path);
    }
  }
  for (const path of paths) checkPath(root, cwd, path, policy);
} catch (error) {
  console.error(`agent-scope: blocked: ${error.message}`);
  process.exitCode = 2;
}
