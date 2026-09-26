import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { backfill, drift, exportDocs, stamp } from './actions.mjs';
import { dossier, select } from './model.mjs';
import { status, validate } from './validation.mjs';

const usage = `Feature documentation (run npm run docs:<command> -- <flags>):
  status [--unit <id>] [--check]
  status --unit <id> --stamp --fingerprint <dossier-sha256>
  context --unit <id>              JSON inventory/digests; no source dumps
  validate [--unit <id>]           Structural/evidence checks, not semantic proof
  backfill [--unit <id>]           Prepare missing templates and cached dossiers
  backfill-one --unit <id>         Preserve existing authored documents
  drift [--sweep] [--strict]       Artefact indexes plus unit freshness; wip skipped
  sync [--unit <id>] --export      Local content-addressed bundle of current docs
  sync-guides --export             Local guide bundle
  sync/sync-guides --publish       Fails until an external destination is configured
`;
const allowed = {
  status: ['unit', 'check', 'stamp', 'fingerprint'],
  context: ['unit'],
  validate: ['unit'],
  backfill: ['unit'],
  'backfill-one': ['unit'],
  drift: ['sweep', 'strict'],
  sync: ['unit', 'export', 'publish'],
  'sync-guides': ['export', 'publish'],
};
try {
  const [command, ...args] = process.argv.slice(2);
  if (command === '--help' || args.includes('--help')) {
    console.log(usage);
  } else {
    if (!Object.hasOwn(allowed, command)) throw new Error(usage);
    const flags = {};
    for (let i = 0; i < args.length; i += 1) {
      const key = args[i].replace(/^--/, '');
      if (!args[i].startsWith('--') || !allowed[command].includes(key) || Object.hasOwn(flags, key)) {
        throw new Error(`Unknown/duplicate flag: ${args[i]}`);
      }
      if (['unit', 'fingerprint'].includes(key)) {
        if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`Missing value: --${key}`);
        flags[key] = args[++i];
      } else flags[key] = true;
    }
    if (['context', 'backfill-one'].includes(command) && !flags.unit) throw new Error('Required flag: --unit');
    if (flags.stamp && !flags.unit) throw new Error('Stamp requires --unit.');
    if ((flags.check && flags.stamp) || (flags.fingerprint && !flags.stamp)) {
      throw new Error('Use --check or --stamp --fingerprint, not both.');
    }
    let result;
    if (command === 'drift') {
      const hook = fileURLToPath(new URL('../../.claude/hooks/lib/docs-drift.mjs', import.meta.url));
      const check = spawnSync(process.execPath, [hook, '--sweep', '--strict'], { encoding: 'utf8' });
      if (check.error) throw check.error;
      result = { ...drift(), indexes: { ok: check.status === 0, detail: `${check.stdout}${check.stderr}`.trim() } };
      result.ok = result.ok && result.indexes.ok;
      if (flags.strict && !result.ok) process.exitCode = 1;
    } else {
      const units = select(flags.unit);
      if (command === 'context') result = dossier(units[0]);
      if (command === 'validate') result = units.map(validate);
      if (command === 'status') {
        result = flags.stamp ? stamp(units, flags.fingerprint) : units.map(status);
        if (flags.check && result.some((row) => !['current', 'wip'].includes(row.status))) process.exitCode = 1;
      }
      if (command.startsWith('backfill')) result = backfill(units);
      if (command.startsWith('sync')) {
        if (Boolean(flags.export) === Boolean(flags.publish)) throw new Error('Choose --export or --publish.');
        result = exportDocs(units, command === 'sync-guides', flags.publish);
      }
    }
    console.log(JSON.stringify(result, null, 2));
  }
} catch (error) {
  console.error(`feature-docs: ${error.message}`);
  process.exitCode = 1;
}
