# Codex workflow ports

These thin skills load the maintained shared workflow rather than copying it.

| Skill | Shared purpose |
| --- | --- |
| [use-scaffolders](use-scaffolders/SKILL.md) | Look up generators and flags; no execution workflow. |
| [lint](lint/SKILL.md) | Run real checks and identify accepted advisories. |
| [codegen](codegen/SKILL.md) | Regenerate GraphQL after source changes. |
| [commit-changes](commit-changes/SKILL.md) | Prepare an authorized commit in the current checkout/worktree. |

See [Codex setup](../../docs/CODEX_SETUP.md) for discovery and verification. Other project workflows
remain available through the root AGENTS.md skill table; read their source instructions when relevant.
Discovery alone never authorizes a commit or publication.
