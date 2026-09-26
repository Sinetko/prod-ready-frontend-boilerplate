import { existsSync } from 'node:fs';

import { generated, local, read } from './files.mjs';
import { docHashes, docPaths, fingerprint, members, snapshots } from './model.mjs';

function headings(text) {
  return [...text.matchAll(/^## (.+)$/gm)].map((match) => match[1]);
}
function section(text, title) {
  return text.split(`## ${title}\n`)[1]?.split(/^## /m)[0]?.trim() || '';
}
export function validate(unit) {
  const sources = new Set(members(unit));
  const [technicalPath, businessPath] = docPaths(unit);
  const [technical, business] = [technicalPath, businessPath].map((file, index) => {
    const text = read(file);
    const type = index ? 'business' : 'technical';
    const required = headings(read(`docs/templates/${unit.kind}.${type}.md`));
    if (!text.startsWith(`# ${unit.title}\n`) || /\{\{|\bTODO\b|\bTBD\b/.test(text)) {
      throw new Error(`${file}: wrong title or unfinished placeholder.`);
    }
    for (const heading of required) {
      if (headings(text).filter((value) => value === heading).length !== 1 || !section(text, heading)) {
        throw new Error(`${file}: missing, duplicate, or empty section ${heading}.`);
      }
    }
    return text;
  });
  const claims = section(technical, 'Verified claims')
    .split('\n')
    .filter((line) => line.trim());
  if (!claims.length) throw new Error(`${technicalPath}: no claims.`);
  const ids = new Set();
  for (const claim of claims) {
    const match = /^- \[(C[1-9]\d*)\] .+ <!-- evidence: (.+) -->$/.exec(claim);
    if (!match || ids.has(match[1])) throw new Error(`${technicalPath}: malformed or duplicate claim.`);
    ids.add(match[1]);
    const evidence = JSON.parse(match[2]);
    if (
      !evidence ||
      !sources.has(evidence.path) ||
      generated(evidence.path) ||
      typeof evidence.contains !== 'string' ||
      !evidence.contains.trim()
    ) {
      throw new Error(`${technicalPath}: evidence must quote a handwritten member source.`);
    }
    if (!read(evidence.path).includes(evidence.contains)) {
      throw new Error(`${technicalPath}: evidence no longer matches ${evidence.path}.`);
    }
  }
  const businessClaims = section(business, 'Supported outcomes')
    .split('\n')
    .filter((line) => line.trim());
  if (!businessClaims.length) throw new Error(`${businessPath}: no outcomes.`);
  for (const claim of businessClaims) {
    const refs = [...claim.matchAll(/\[(C[1-9]\d*)\]/g)].map((match) => match[1]);
    if (!claim.startsWith('- ') || !refs.length || refs.some((id) => !ids.has(id))) {
      throw new Error(`${businessPath}: each outcome must reference an existing technical claim.`);
    }
  }
  const sourceHash = /<!-- technical-sha256: ([a-f0-9]{64}) -->/.exec(business)?.[1];
  if (sourceHash !== docHashes(unit)[technicalPath]) {
    throw new Error(`${businessPath}: technical source digest missing or changed; re-derive and update digest.`);
  }
  return { unit: unit.id, claims: ids.size, semanticReview: 'Human/agent review required; quotes do not prove prose.' };
}
export function status(unit) {
  if (unit.status === 'wip') return { unit: unit.id, status: 'wip', reason: 'Excluded from drift enforcement.' };
  try {
    if (docPaths(unit).some((file) => !existsSync(local(file)))) return { unit: unit.id, status: 'missing' };
    validate(unit);
    const stamp = snapshots().units[unit.id];
    const current =
      stamp?.fingerprint === fingerprint(unit) && JSON.stringify(stamp?.documents) === JSON.stringify(docHashes(unit));
    return { unit: unit.id, status: current ? 'current' : 'stale' };
  } catch (error) {
    return { unit: unit.id, status: 'invalid', reason: error.message };
  }
}
