# Feature documentation

`units.map.json` is the unit registry; `units.lock.json` is the machine-written freshness snapshot.
The initial units are `example` (feature), `graphql` (service), and `tooling` (infra). A functionality
unit can use the supplied functionality templates when a separately owned behavior needs documenting.
Globs use Node's `path.matchesGlob`, with repository-relative forward slashes; overlaps are intentional.
IDs use lowercase kebab case. Negative globs, absolute paths, traversal, and duplicate IDs are rejected.
A unit must match at least one source file. Documentation under `docs/` is excluded from source membership
to avoid self-referential fingerprints. Generated GraphQL outputs are hashed but never put into dossiers
as source content or accepted as claim evidence. Ignored caches, dependencies, build outputs and symlinks
are excluded. Handwritten source files outside Git tracking are included, so partial bootstrap work counts.

## Commands

Run from the repository root; every command accepts `--help`. Unknown/duplicate flags fail immediately.

| Command | Behavior |
| --- | --- |
| `npm run docs:status -- --unit example --check` | Exit 1 for missing, invalid or stale docs; omit unit to check all. |
| `npm run docs:context -- --unit example` | JSON dossier with unit, source paths/digests, generated-file markers, templates and fingerprint. |
| `npm run docs:validate -- --unit example` | Check headings, placeholders, claim evidence, outcome references and technical digest. |
| `npm run docs:status -- --unit example --stamp --fingerprint <dossier-fingerprint>` | Validate and save current source/doc hashes; reject a dossier made before a source change. |
| `npm run docs:backfill` | Prepare missing technical/business templates and cache dossiers for all units. |
| `npm run docs:backfill-one -- --unit example` | Same for one unit; never overwrite authored files or stamp templates. |
| `npm run docs:drift -- --sweep --strict` | Check hook/agent/skill/scaffolder indexes and all non-wip unit docs, including orphan lock entries. |
| `npm run docs:drift:strict` | CI alias for the same strict sweep. |
| `npm run docs:sync -- --unit example --export` | Export current documents into an ignored, content-addressed local bundle. |
| `npm run docs:sync-guides -- --export` | Export navigation/guides/templates into a separate local bundle. |
| `npm run test:docs` | Run isolated pipeline behavior tests. |

Without `--strict`, drift prints actual failures but exits 0 for advisory use; invalid setup still fails.
Without `--check`, status is a report. `status: "wip"` suppresses freshness enforcement and hooks only:
explicit validation still checks the document, stamping is refused, and export requires current docs.
Remove wip only after implementation is ready, then build a new dossier and review the documents.

## Author and review

1. Select a unit and obtain its dossier. Use graph/GraphQL lookup for relationships and generated contracts;
   read focused handwritten files yourself. The dossier does not pretend to summarize behavior.
2. Author `units/<id>/technical.md` using the corresponding kind template. Document scope, workflow/contract,
   verified claims, verification and limitations. The technical writer performs semantic review against code.
3. Each line in **Verified claims** is one claim: `- [C1] Prose <!-- evidence: {"path":"src/file.ts","contains":"exact quote"} -->`.
   IDs are unique positive C-numbers. The JSON quote must exist verbatim in a handwritten member source.
   Keep substantive behavior assertions in this section; scope/workflow prose should explain these claims.
4. Derive `business.md` only from the reviewed technical document. Each **Supported outcomes** bullet
   references technical claim IDs such as `[C1]`. Preserve limitations; do not invent promises.
   Record the SHA-256 of the exact technical document in `<!-- technical-sha256: <digest> -->`.
   Obtain it with `shasum -a 256 docs/units/<id>/technical.md`. Re-read/re-derive business docs when it changes;
   changing the digest alone is not a review.
5. Run validation, resolve every error, then stamp with the fingerprint from the reviewed dossier.
   Run status and strict drift. A changed source, registry entry, kind template, pipeline implementation,
   or authored document invalidates freshness. Source additions/removals also count. Stamps are deterministic
   and have no timestamp churn. Never hand-edit a snapshot to suppress a failure.

Mechanical validation proves references/quotes exist and document ancestry matches, not that a prose claim
logically follows from its quote or covers every behavior. Semantic review remains the writer/reviewer's job.
Backfill deliberately produces invalid placeholders requiring authoring; it never invokes an AI service or
marks template-only work complete. Repeating backfill preserves all existing documents and refreshes dossiers.

## Synchronization and recovery

No external documentation host has been selected. Both sync commands require an explicit mode:
`--export` writes a Markdown bundle and manifest under `.claude/cache/docs-export/`; `--publish` fails
with “destination not configured”. Local export is complete; external publication remains unconfigured,
with no network call, credentials, or claimed successful push. Choose a host and implement its adapter
before publication; running local docs tooling does not grant permission to publish.

Bundle paths retain repository paths. Unit bundles contain selected documents; guide bundles contain root
README/CLAUDE/AGENTS navigation, scoped CLAUDE/AGENTS files, Codex setup and workflow ports, this guide, on-demand `.claude/docs` guides, and templates.
They are raw Markdown exports, not a rendered site: repository-relative source links may need host-side
rewriting. Manifests enumerate exact hashes and `published: false`. Repeated exports reuse identical content;
modified files in an existing bundle are rejected. No cleanup deletes old bundles implicitly.

Writers serialize through `.claude/cache/feature-docs.lock`; an interrupted process can leave a stale lock.
Verify no docs writer is running before removing that directory and retrying. Writes use temporary files
and atomic rename, and reject symlink path components. These are safeguards for a trusted local repository,
not a sandbox against concurrent hostile filesystem mutation.

After removing a unit, strict drift reports its orphaned snapshot. Review the removal and remove that
orphan entry explicitly; do not alter live-unit hashes by hand. Keep partial or unavailable source evidence
visible in documents instead of stamping unsupported claims.
