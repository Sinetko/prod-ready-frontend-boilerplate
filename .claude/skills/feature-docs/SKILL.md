---
name: feature-docs
description: Coordinate technical and business unit documentation using the Phase 14 dossier and validation workflow when installed.
---

Read the current bootstrap progress and package scripts first. Phase 14 owns
units.map.json, templates, docs:context/status/validate, lock snapshots, and
sync/backfill commands. If they are absent, report setup pending and the missing
prerequisites; do not fake successful freshness checks or create a doc system.

When installed, work on the caller's unit ID and existing kind-specific template.
Read only its registry entry and relevant guidance; globs may overlap. A wip
unit suppresses drift checks, not the obligation to describe actual behavior.
Use the implemented docs:status and docs:context interfaces to obtain freshness
and a scoped dossier. Inspect their real usage/help before supplying flags;
only docs:status --unit <id> --check is already established by the hook contract.

Supply the dossier to bizdoc-writer for code-backed technical.md under
docs/units/<unit-id>/. Validate claims with docs:validate and resolve unsupported
claims before deriving the business document. Give bizdoc-business-writer the
current technical document, business template, and exact output path; it must
not re-derive behavior from source. Delegate when available, or follow the
corresponding agent instructions in the current session without claiming an
agent ran. The doc writers leave pipeline execution to this orchestration flow.

Use the actual status/stamp command only after content validation; never edit
units.lock.json by hand to hide drift. Finish with the implemented freshness
check and npm run docs:drift -- --sweep --strict. Batch/backfill uses the existing
scripts when explicitly requested. External docs:sync/docs:sync-guides execution
requires the user's authorization for the destination; local doc generation does
not authorize publishing. Report changed docs, evidence, validation, and gaps.
