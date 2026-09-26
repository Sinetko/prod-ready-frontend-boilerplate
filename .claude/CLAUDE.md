# Claude-tooling guidance

Follow [root guidance](../CLAUDE.md). Read only the needed [hook](hooks/README.md),
[agent](agents/README.md), or [skill](skills/README.md) index; do not preload all definitions.

- Update each index with its artefact in the same change. Keep root role/skill tables aligned and list
  every scoped CLAUDE.md in the root scoped-guidance table.
- Preserve real synchronous enforcement versus async advisory/logging behavior. Budget hooks never block.
  Read-only Bash role prompts are conventions, not shell restrictions. Agent file-write scopes use their
  actual path hook; do not broaden tools or permissions through prose alone.
- Do not broaden settings to wildcard write permissions. Skills do not grant authority to commit/publish.
- Never Read or hand-edit `context-graphs/*.json`; use `npm run graph`. Cache/graph outputs are generated
  and ignored. Token telemetry is metadata only; persistent memory is not configured.
- On-demand details live in `docs/`; link each from the root navigator. Feature-doc tooling uses
  [the unit pipeline](../docs/README.md) and [Playwright setup](../autotests/playwright/README.md).
  Codex setup and runtime differences are documented in [Codex setup](../docs/CODEX_SETUP.md).
- Run strict docs drift and applicable hook/agent tests for enforcement changes. Validate guidance links
  and the root scoped-file index for navigation changes; strict docs drift checks pointers and that table in root AGENTS.md.
