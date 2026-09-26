# Claude Code runtime guidance

@AGENTS.md

Follow [AGENTS.md](AGENTS.md) for all shared principles, scaffolders, coding standards, task disciplines,
skills and scoped guidance. That file is authoritative; keep shared rules there rather than duplicating them.

## Runtime enforcement

`.claude/settings.json` registers the real hooks and read-only command allowlist. These settings apply
only when Claude Code loads/trusts them; they are not Codex configuration. See the
[hook index](.claude/hooks/README.md) for synchronous blockers, async checks and telemetry limitations.
`CLAUDE_DISABLE_SCAFFOLD_GUARD=1` is rare and needs a real reason recorded in the session.

The advisory Stop hooks warn above 250,000/400,000 cache-read input tokens and 1,200/3,000 output
tokens. Preserve the reference thresholds until measured project usage supports recalibration.
`CLAUDE_DISABLE_CONTEXT_BUDGET=1` / `CLAUDE_DISABLE_OUTPUT_BUDGET=1` disable their respective
warnings. Async hooks do not prove checks passed; run the shared finishing commands explicitly.

## Role agents

| Definition | Model | maxTurns | Responsibility |
| --- | --- | --- | --- |
| [architect.md](.claude/agents/architect.md) | sonnet | 30 | Return an implementation plan; optional writes only under `.claude/plans/`. |
| [developer.md](.claude/agents/developer.md) | sonnet | 60 | Implement and verify; invoke mandatory scaffolders itself with `--non-interactive`. |
| [explore.md](.claude/agents/explore.md) | sonnet | 25 | Find code and trace dependencies; read-only investigation. |
| [debugger.md](.claude/agents/debugger.md) | opus | 40 | Reproduction evidence → root cause → patch proposal; read-only. |
| [reviewer.md](.claude/agents/reviewer.md) | opus | 40 | Review the requested diff; report concrete findings without applying fixes. |
| [tester.md](.claude/agents/tester.md) | sonnet | 50 | Author tests only in `autotests/`; caller executes test commands. |
| [bizdoc-writer.md](.claude/agents/bizdoc-writer.md) | opus | 50 | Analyze code and author technical unit documentation. |
| [bizdoc-business-writer.md](.claude/agents/bizdoc-business-writer.md) | haiku | 20 | Derive business documentation only from a current technical document. |

See the [agent index](.claude/agents/README.md) for enforced write scopes, caller responsibilities,
model aliases, and runtime/trust limitations. Each role remains within the current task's authority.

