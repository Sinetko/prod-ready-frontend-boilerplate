import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, linkSync, mkdirSync, readFileSync, realpathSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { setTimeout } from 'node:timers/promises';

export function input() {
  const text = readFileSync(0, 'utf8');
  const value = JSON.parse(text || '{}');
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected a hook JSON object');
  return value;
}

export function rootFor(event) {
  // cwd follows an active worktree; CLAUDE_PROJECT_DIR can still name the original checkout.
  let directory = resolve(event.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd());
  let packageRoot;
  for (;;) {
    if (existsSync(join(directory, 'package.json'))) {
      packageRoot ||= directory;
      if (existsSync(join(directory, '.git')) || existsSync(join(directory, '.claude/settings.json'))) return directory;
    }
    const parent = dirname(directory);
    if (parent === directory) {
      if (packageRoot) return packageRoot;
      throw new Error('Cannot locate project package.json from hook cwd');
    }
    directory = parent;
  }
}

export function pathsFor(event) {
  const tool = event.tool_input || {};
  return [...new Set([tool.file_path, tool.path, ...(tool.edits || []).map((edit) => edit.file_path)].filter(Boolean))]
    .filter((value) => typeof value === 'string')
    .map((value) => resolve(event.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd(), value));
}

export function localPath(root, path) {
  const value = relative(root, path);
  return value === '..' || value.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) || isAbsolute(value)
    ? undefined
    : value.replaceAll('\\', '/');
}

export function canonical(path) {
  // Resolve existing ancestors too, so a symlinked directory cannot hide the target's shape.
  if (existsSync(path)) return realpathSync(path);
  const parent = dirname(path);
  return parent === path ? path : join(canonical(parent), relative(parent, path));
}

export function cachePath(root, name) {
  const directory = join(root, '.claude/cache/hooks');
  mkdirSync(directory, { recursive: true });
  return join(directory, name);
}

export function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function notify(messages) {
  if (messages.length) console.log(JSON.stringify({ systemMessage: messages.join('\n') }));
}

export function npm(root, args) {
  const result = spawnSync('npm', args, { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  return { ok: result.status === 0, detail: result.error?.message || result.stderr || result.stdout };
}

export async function locked(root, name, action) {
  const path = cachePath(root, `${name}.lock`);
  const owner = `${path}.${process.pid}`;
  writeFileSync(owner, String(process.pid));
  for (;;) {
    try {
      // Publishing a fully written inode avoids an empty lock if a process dies during creation.
      linkSync(owner, path);
      unlinkSync(owner);
      break;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      try {
        const pid = Number(readFileSync(path, 'utf8'));
        if (Number.isInteger(pid) && pid > 0) {
          try {
            process.kill(pid, 0);
          } catch (probe) {
            if (probe.code === 'ESRCH') unlinkSync(path);
          }
        }
      } catch (probe) {
        if (probe.code !== 'ENOENT') throw probe;
      }
      await setTimeout(100);
    }
  }
  try {
    return await action();
  } finally {
    unlinkSync(path);
  }
}

export async function advisory(job) {
  try {
    await job();
  } catch (error) {
    notify([`Hook warning: ${error.message}`]);
  }
}
