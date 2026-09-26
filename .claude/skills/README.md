# Project skills

Phase 12 provides thin instruction wrappers over the existing npm commands.
Invoke `/name` in Claude Code or let it select a relevant skill normally.
Each entry has its own SKILL.md; no scripts execute merely from loading it.
These skills neither grant extra tool permissions nor override an agent's scope.
In particular, automatic discovery of commit-changes does not authorize a commit.

| Skill | Purpose |
| --- | --- |
| [new-component](new-component/SKILL.md) | Generate the canonical component, props type, and barrel. |
| [new-hook](new-hook/SKILL.md) | Generate the canonical hook, types, test, and barrel. |
| [new-util](new-util/SKILL.md) | Generate a utility, test, and barrel. |
| [new-store](new-store/SKILL.md) | Generate the Zustand state/actions and middleware shape. |
| [new-context](new-context/SKILL.md) | Generate a provider, consumer hook, types, and barrel. |
| [new-page](new-page/SKILL.md) | Generate a feature page and register its route/namespace. |
| [new-query](new-query/SKILL.md) | Generate normal/lazy queries or mutations with project Apollo wrappers. |
| [new-fragment](new-fragment/SKILL.md) | Generate a flat schema-driven fragment and run codegen. |
| [new-form](new-form/SKILL.md) | Use component/hook generators with the agreed form contract. |
| [new-table](new-table/SKILL.md) | Use the component generator with the agreed row and interaction contract. |
| [new-translations](new-translations/SKILL.md) | Colocate typed i18next resources and register namespaceMap entries. |
| [use-table-columns](use-table-columns/SKILL.md) | Generate a column hook only when the chosen table approach needs it. |
| [use-scaffolders](use-scaffolders/SKILL.md) | Pure artefact-to-command/flags lookup table. |
| [graph-lookup](graph-lookup/SKILL.md) | Query a relevant graph through its CLI, including freshness checks. |
| [graphql-lookup](graphql-lookup/SKILL.md) | Extract a focused schema/document/type block. |
| [lint](lint/SKILL.md) | Run actual checks and distinguish known advisories from failures. |
| [feature-docs](feature-docs/SKILL.md) | Coordinate dossiers, technical/business docs, validation, and freshness once Phase 14 exists. |
| [codegen](codegen/SKILL.md) | Manually regenerate GraphQL outputs after batch/shell edits. |
| [commit-changes](commit-changes/SKILL.md) | Detect checkout/worktree context and commit authorized changes with normal identity/hooks/signing. |

Forms and tables reuse existing generators. No form/table library, universal
column API, or fictitious generate-form/table/translations command was added.
Missing product/API conventions are resolved when a concrete request needs them.
Translations follow the existing colocated i18next and namespaceMap implementation.
The user authorized these choices and the same configured-identity/verification
policy in main checkouts and worktrees. The commit skill distinguishes their Git
layout and keeps all work in the active checkout; it does not weaken checks for
worktrees or invent an author identity.

The feature-docs skill reports setup pending until Phase 14 supplies the actual
registry, templates, and commands. It documents orchestration without inventing
future flags or marking absent documentation current. External publication still
requires authorization for the target. Root CLAUDE.md indexes these skills and the
scoped guidance. Codex discovers the four [workflow ports](../../.agents/skills/README.md); see [setup](../../docs/CODEX_SETUP.md).

Validation includes the skill-creator validator, checking documented commands
against package.json, resolving local index links, actual CLI skill discovery
without a model request, and strict docs drift. Prompt text is not a sandbox:
model adherence and output quality are not proven by discovery/schema checks.
No application scaffolds or actual repository commits are needed to install skills.

The [official skill documentation](https://code.claude.com/docs/en/skills)
describes project discovery and invocation. The files use only name/description
frontmatter, with no tool pre-approvals, dynamic command injection, or forced
subagent/model configuration.
