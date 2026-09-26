import { existsSync, globSync, readdirSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

// This is a static recognizer for the specified write commands, never a shell evaluator.
// Preserve operator vs quoted-word identity and skip heredoc bodies (which are data).
function tokenize(command, variables) {
  const tokens = [];
  let value = '';
  let active = false;
  let quote = '';
  let dynamic = false;
  let delimiter = false;
  const heredocs = [];
  const flush = () => {
    if (active) {
      tokens.push({ value, dynamic });
      if (delimiter) {
        heredocs.push(value);
        delimiter = false;
      }
    }
    value = '';
    active = false;
    dynamic = false;
  };
  for (let index = 0; index < command.length; index++) {
    const char = command[index];
    if (char === '\\' && quote !== "'") {
      const next = command[++index];
      if (next !== '\n' && next !== undefined) {
        value += next;
        active = true;
      }
    } else if (quote) {
      if (char === quote) quote = '';
      else {
        value += char;
        if (quote === '"' && /[$`]/.test(char)) dynamic = true;
      }
    } else if (char === "'" || char === '"') {
      quote = char;
      active = true;
    } else if (char === '#' && !active) {
      while (index < command.length && command[index] !== '\n') index++;
      index--;
    } else if (/\s/.test(char)) {
      flush();
      if (char === '\n') {
        tokens.push({ value: ';', operator: true });
        for (const end of heredocs.splice(0)) {
          let found = false;
          while (++index < command.length) {
            const start = index;
            while (index < command.length && command[index] !== '\n') index++;
            if (command.slice(start, index).replace(/^\t+/, '') === end) {
              found = true;
              break;
            }
          }
          if (!found) throw new Error('Unterminated heredoc; cannot determine write targets');
        }
      }
    } else if (/[<>;&|()]/.test(char)) {
      flush();
      let operator = char;
      if (command[index + 1] === char || (char === '>' && /[|&]/.test(command[index + 1] || ''))) {
        operator += command[++index];
      }
      if (operator === '<<' && command[index + 1] === '-') operator += command[++index];
      tokens.push({ value: operator, operator: true });
      if (operator === '<<' || operator === '<<-') delimiter = true;
    } else {
      value += char;
      active = true;
      if (/[$`]/.test(char)) dynamic = true;
    }
  }
  if (quote) throw new Error('Unterminated shell quote; cannot determine write targets');
  flush();
  return tokens.map((token) => {
    if (!token.dynamic) return token;
    const expanded = token.value.replace(/\$\{(\w+)\}|\$(\w+)/g, (match, braced, plain) => {
      return variables[braced || plain] ?? match;
    });
    return { ...token, value: expanded, dynamic: /[$`]/.test(expanded) };
  });
}

function directoryFiles(path) {
  if (!existsSync(path)) return [];
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isSymbolicLink()) return [];
    const child = join(path, entry.name);
    return entry.isDirectory() ? directoryFiles(child) : [child];
  });
}

export function writeTargets(command, cwd, depth = 0) {
  if (depth > 8) throw new Error('Shell nesting is too deep to inspect; use the scaffolder directly');
  const tokens = tokenize(command, { ...process.env, PWD: cwd });
  const targets = [];
  let directory = cwd;
  let unknownDirectory = false;
  let words = [];
  const target = (token) => {
    if (!token) throw new Error('Missing write target');
    if (unknownDirectory) throw new Error('Write after a dynamic cd cannot be verified; use the scaffolder directly');
    if (token.dynamic) throw new Error('Dynamic write target cannot be verified; use the scaffolder directly');
    const path = resolve(directory, token.value);
    targets.push(path);
    return path;
  };
  const inspect = () => {
    let values = words;
    words = [];
    while (values[0]) {
      if (/^\w+=/.test(values[0].value)) values = values.slice(1);
      else if (['command', 'builtin', 'env'].includes(values[0].value)) {
        values = values.slice(1);
        while (values[0] && ['-p', '-i', '--ignore-environment', '--'].includes(values[0].value)) {
          values = values.slice(1);
        }
      } else break;
    }
    const verb = basename(values[0]?.value || '');
    const args = values.slice(1);
    if (verb === 'cd' && args[0]) {
      unknownDirectory ||= args[0].dynamic;
      if (!unknownDirectory) directory = resolve(directory, args[0].value);
    }
    if (['sh', 'bash', 'zsh'].includes(verb)) {
      const flag = args.findIndex((arg) => /^-[a-z]*c[a-z]*$/.test(arg.value));
      if (flag !== -1 && args[flag + 1]) {
        targets.push(...writeTargets(args[flag + 1].value, directory, depth + 1));
      }
    }
    if (!['tee', 'touch', 'cp', 'mv', 'install'].includes(verb)) return;
    const operands = [];
    let targetDirectory;
    let options = true;
    let noTargetDirectory = false;
    for (let index = 0; index < args.length; index++) {
      const arg = args[index];
      if (options && arg.value === '--') options = false;
      else if (options && ['-t', '--target-directory'].includes(arg.value) && verb !== 'touch') {
        targetDirectory = args[++index];
      } else if (options && arg.value.startsWith('--target-directory=')) {
        targetDirectory = { ...arg, value: arg.value.split('=').slice(1).join('=') };
      } else if (options && ['-T', '--no-target-directory'].includes(arg.value)) noTargetDirectory = true;
      else if (
        options &&
        (verb === 'touch'
          ? ['-t', '-d', '-r', '--date', '--reference']
          : ['-m', '-o', '-g', '-S', '--mode', '--owner', '--group', '--suffix']
        ).includes(arg.value)
      ) {
        index++;
      } else if (!options || !arg.value.startsWith('-')) operands.push(arg);
    }
    if (verb === 'tee' || verb === 'touch') {
      operands.forEach(target);
      return;
    }
    const destination = targetDirectory || operands.pop();
    if (!destination) return;
    const path = target(destination);
    const isDirectory = targetDirectory || (!noTargetDirectory && existsSync(path) && statSync(path).isDirectory());
    for (const source of operands) {
      if (source.dynamic) throw new Error('Dynamic copy/move source cannot be inspected; use the scaffolder');
      const sources = globSync(source.value, { cwd: directory }).map((item) => resolve(directory, item));
      if (!sources.length) sources.push(resolve(directory, source.value));
      for (const from of sources) {
        const to = isDirectory ? join(path, basename(from)) : path;
        targets.push(to);
        for (const file of directoryFiles(from)) targets.push(to + file.slice(from.length));
      }
    }
  };
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (!token.operator) words.push(token);
    else if (['>', '>>', '>|', '>&'].includes(token.value)) {
      const next = tokens[++index];
      if (!(token.value === '>&' && /^\d+$|^-$/.test(next?.value || ''))) target(next);
    } else if (['<', '<<', '<<-', '<&'].includes(token.value)) index++;
    else inspect();
  }
  inspect();
  return targets;
}
