# Claude Code hooks

Project wiring lives in [../settings.json](../settings.json), verified with Claude
Code 2.1.216. Each shell entry point delegates JSON/paths to a small Node 24 module
under `lib/`; Bash and the project's pinned Node/npm must be on PATH. No jq,
Python, globally installed TypeScript runner, or extra package is required.

| Entry point | Event and responsibility |
| --- | --- |
| `agent-scope.sh` | Agent-local synchronous PreToolUse; limits architect/tester/doc-writer file targets and blocks unavailable tools. See [agent policies](../agents/README.md). |
| `scaffold-guard.sh` | Synchronous PreToolUse for Write/Edit/MultiEdit/Bash; exits 2 for a new scaffold-shaped target. |
| `context-budget.sh` | Synchronous Stop; advisory WARNING above 250,000 cache-read input tokens, CRITICAL above 400,000. |
| `output-budget.sh` | Synchronous Stop; advisory WARNING above 1,200 output tokens, CRITICAL above 3,000. |
| `feature-docs-drift.sh` | Async PostToolUse file edits; maps overlapping units, throttles each unit to one check per 30 seconds, warns on missing/stale technical docs. |
| `docs-drift.sh` | Async PostToolUse file edits or `--sweep [--strict]`; checks that on-disk hooks, agents, skills, and scaffolders appear in an ancestor README.md/index.md. |
| `auto-codegen.sh` | Synchronous PostToolUse file edits; reruns `npm run generate-code` for GraphQL document changes. Failure exits 2 and reports the error; it cannot undo an edit. |
| `regenerate-context-graphs.sh` | Async PostToolUse file edits and Bash calls; refreshes stale graphs. |
| `regenerate-graphs-core.sh` | Async SessionStart/PostCompact; checks the existing fingerprint/digests before rebuilding a missing/stale baseline. |
| `session-logger.sh` | Async lifecycle telemetry, including PreToolUse/PostToolUse, Stop, SessionStart/SessionEnd, PreCompact/PostCompact, UserPromptSubmit, SubagentStart/SubagentStop. |

Run `npm run test:hooks` for isolated behavioral tests and
`npm run docs:drift -- --sweep --strict` for the CI-runnable index check. Strict
drift exits 1 for omissions; normal hook execution only warns. An index must name
the file (relative to itself or the repo), or a scaffolder's exact `generate-*`
command. A skill's own SKILL.md is not its index. New agents/skills in Phases
11–12 must therefore be added to their README/index when created.

## Scaffold guard

The guard checks `.page.tsx`, `.component.tsx`, `.context.tsx`, `.hook.ts`,
`.util.ts`, `.utils.ts`, `.store.ts`, `queries|mutations/<name>/*.tag.ts`, and
flat `fragments/*.fragment.ts`. Existing files pass. Nonexistent targets require
the matching `npm run generate-* -- --non-interactive` command from the root
README. It checks lexical paths and resolved symlink ancestors.

Bash recognition covers `>`, `>>`, `>|`, `tee`, `touch`, `cp`, `mv`, and
`install -D`, including quoted paths, multiple targets, destination directories,
recursive copies, heredocs, chained `cd`, and `bash|sh|zsh -c`. It never executes
the command to discover paths. Unresolved dynamic destinations in these write
commands are blocked with an explanation. This is a convention guard, not a
shell sandbox: arbitrary programs (Python/Node), shell functions, process
substitution, and every possible shell expansion are not a complete supported
shell language. Use scaffolders for creation regardless of tool spelling.

`CLAUDE_DISABLE_SCAFFOLD_GUARD=1` is a rare escape hatch that needs a real reason,
documented in the session. Set it in the environment of the Claude process or a
direct hook test; an assignment inside a proposed Bash command does not disable
its PreToolUse hook.

## Token usage and logging

Stop hooks stream transcript JSONL, not the entire file into memory. Context
uses the last available assistant request's `cache_read_input_tokens`. Output
adds distinct assistant API messages since the last real user prompt, retaining
the maximum count for repeated streamed entries with the same message ID.
Tool-result messages do not reset the turn. These are API token counters, not a
word count or an estimate of visible final-answer length. Missing or malformed
usage is reported as unavailable/partial, never invented as zero. Budget hooks
always exit 0, including at CRITICAL, so they cannot create a Stop loop.

Opt out using `CLAUDE_DISABLE_OUTPUT_BUDGET=1` or
`CLAUDE_DISABLE_CONTEXT_BUDGET=1`. The thresholds are the reference defaults;
recalibrate from this project's measured usage once enough history exists.

The logger appends metadata to `.claude/cache/hooks/session-<hashed-id>.jsonl`:
timestamp, event, session/agent/tool IDs, and Stop/SubagentStop usage when
available. SubagentStop uses the agent transcript, not the parent transcript.
It never persists prompts, tool arguments, source content, or transcript text.
These local cache files are ignored by Git; remove them when no longer needed.
Async completion at session teardown is best effort, as documented by Claude.

## Documentation and refresh contracts

Feature docs live at `docs/units/<unit-id>/technical.md`. Phase 14 owns the
registry `docs/units.map.json` and `npm run docs:status -- --unit <id> --check`.
Until installed, the hook reports setup pending/freshness unknown instead of
claiming docs are current. Fixtures test the real mapping, missing-doc and
nonzero-status conditions now. `status: "wip"` suppresses the unit entirely.
All matching units are checked; IDs cannot contain path separators or traversal.

Graph refresh hooks query strict freshness first, then run the real generator.
They also run after Bash so scaffolders and shell edits are included. Cache and
generated graph edits are excluded. A PID lock serializes writers and recovers
after dead processes. Codegen publishes a completion receipt keyed by session
and tool-use ID, since Claude runs matching handlers concurrently. The async
graph hook waits for this receipt before indexing file edits, and shares the
codegen lock during generation. A failed codegen defers that refresh with a
warning. Receipt waiting is bounded by Claude's 600-second default synchronous
hook timeout. Direct manual hook calls without a tool-use ID skip that handshake;
run codegen first when testing a GraphQL edit manually.

GraphQL detection follows codegen.yml's fragments/queries/mutations source
tree. `.graphql`, `.tag.ts`, and `.fragment.ts` edits trigger codegen; other
TS/TSX files trigger when new or replaced text contains a gql template. Generated
schema, API types, and extracted documents never retrigger it. Bash scaffolders
already invoke codegen; arbitrary shell document edits need manual
`npm run generate-code`. Hooks use the payload's cwd to locate the active repo
root, including worktrees, even if CLAUDE_PROJECT_DIR still names the original
checkout. Nested package roots do not override the enclosing Git/settings root.
Async regeneration errors are advisory; `npm run graph -- --strict`
remains the authoritative freshness check before relying on a snapshot.

References: [hook contracts](https://code.claude.com/docs/en/hooks) and
[permission matching](https://code.claude.com/docs/en/permissions).

Strict docs drift also checks the shared AGENTS.md import, five scoped guidance pairs/root index,
and four Codex skill ports. Husky invokes the same strict CLI for both clients.
See [Codex setup](../../docs/CODEX_SETUP.md) for enforcement limits.
