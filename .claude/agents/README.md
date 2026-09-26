# Project agents

Phase 11 defines eight Claude Code agents. Invoke one by name in your request
or start a session with `claude --agent <name>`. If this directory was created
after your Claude session started, restart that session to discover it.

| Definition | Model | maxTurns | Responsibility |
| --- | --- | --- | --- |
| [architect.md](architect.md) | sonnet | 30 | Return an implementation plan; optional writes only under `.claude/plans/`. |
| [developer.md](developer.md) | sonnet | 60 | Implement and verify; invoke mandatory scaffolders itself with `--non-interactive`. |
| [explore.md](explore.md) | sonnet | 25 | Find code and trace dependencies; read-only investigation. |
| [debugger.md](debugger.md) | opus | 40 | Reproduction evidence → root cause → patch proposal; read-only. |
| [reviewer.md](reviewer.md) | opus | 40 | Review the requested diff; report concrete findings without applying fixes. |
| [tester.md](tester.md) | sonnet | 50 | Author tests only in `autotests/`; caller executes test commands. |
| [bizdoc-writer.md](bizdoc-writer.md) | opus | 50 | Analyze code and author technical unit documentation. |
| [bizdoc-business-writer.md](bizdoc-business-writer.md) | haiku | 20 | Derive business documentation only from a current technical document. |

These model families and turn limits were chosen with user authorization.
Aliases select a tier, not an immutable model version. Claude/provider model
configuration can override the effective model; inspect the session's actual
model if cost or reproducibility matters. The limits bound a delegated task;
they do not establish a context-token or output-token threshold.

## Tool and write boundaries

`tools` explicitly lists each role's capabilities. Architect has Read/Grep/Glob/
Write; developer has Bash/Read/Grep/Glob/Edit/Write/Skill/Agent; explore, debugger,
and reviewer have Read/Grep/Glob/Bash. The tester and business writer have only
Read/Grep/Glob/Edit/Write. The technical writer additionally has Bash.

Architect, tester, and both doc writers attach a synchronous, agent-local
PreToolUse hook to all tool calls. The shared
[agent-scope.sh](../hooks/agent-scope.sh) handler permits file writes only in
`.claude/plans/`, `autotests/`, or Markdown under `docs/units/`, respectively.
Architect can only use Write; tester/doc writers can use Write/Edit/MultiEdit
where the runtime provides them. Read/Grep/Glob remain available for relevant
context. Unexpected tools, missing/malformed targets, parent traversal,
symlinked files/directories (including dangling links), and hard-linked files
are blocked with exit 2. Scope directories are created only when real work
needs them. The hook uses the active worktree from the event's cwd.

The architect/tester/business writer have no Bash, Skill, or Agent tool, so
those tools cannot be used to escape their file-write scope. The tester asks
the caller to execute the existing test project's commands and reports unrun
tests honestly. Read access to app source is allowed to understand contracts;
only test edits belong to autotests. The business writer's prohibition on
rewriting technical docs is a prompt rule within its Markdown write boundary.

Bash in explore/debugger/reviewer/technical writer is **read-only by convention,
not sandboxed**. Each prompt explicitly forbids mutation verbs and bypasses.
Focused graph queries may compile their ignored tool cache. Other generated
outputs, docs pipeline execution, test/build runs, and freshness stamps are the
caller's responsibility for these roles. The technical writer's file-tool scope
does not constrain arbitrary Bash programs; do not mistake it for a shell sandbox.

The path hook protects normal tool calls, not concurrent filesystem attacks or
an OS security boundary. It complements the existing project scaffold guard;
it does not disable it or grant permission. Both must pass. Claude must load
and run the agent's hooks for the write boundary to apply; do not disable hooks
or start in safe/bare mode expecting these protections. On Claude Code 2.1.218+
project agent hooks require explicit trust of the folder containing the agent
files; automatic non-interactive trust is insufficient. The installed version
at verification was 2.1.216. See the
[official agent hook documentation](https://code.claude.com/docs/en/sub-agents#hooks-in-subagent-frontmatter).

## Prerequisites and verification

All agents respect BOOTSTRAP_PROGRESS.md and the current task scope. They use
npm, the existing root README conventions, and focused graph/GraphQL extraction
instead of reading huge generated files. Roles without Bash request extraction
results from their caller. They never hand-edit generated outputs.

Phase 12 skills and Phase 13 root/scoped guidance are indexed in the root CLAUDE.md.
Feature-doc commands and templates are documented in [the unit pipeline](../../docs/README.md).
Playwright conventions and separate verification commands are in [autotest setup](../../autotests/playwright/README.md).
No absent skills are preloaded and no persistent agent memory is enabled. Business output uses
`docs/units/<unit-id>/business.md` from the established templates. No external documentation sync is authorized.

```sh
npm run test:agents
npm run test:hooks
npm run docs:drift -- --sweep --strict
npm run lint
```

Agent scope tests execute the actual hook with isolated payloads and filesystem
fixtures, including negative cases. Frontmatter is also checked with a YAML
parser; a no-prompt CLI initialize request confirmed discovery of all eight
agents and their model aliases on Claude Code 2.1.216. These checks do not make model API
calls or prove that a model follows every prompt instruction. In particular,
read-only Bash discipline and review quality remain behavioral requirements.
The CLI reported this workspace as untrusted and ignored its permission
allowlist. Open Claude Code interactively in this repo and accept its workspace
trust prompt to enable that configuration; verification did not modify user trust.
Nested Agent availability depends on runtime/context; developer must complete
its work itself when nested delegation is unavailable.
