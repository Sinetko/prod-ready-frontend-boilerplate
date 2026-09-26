# Codex CLI setup and parity

Verified against local `codex-cli 0.156.1` on 2026-09-25. No user configuration, trust settings,
credentials, model selection or approval policy is changed by this repository.

## Guidance and workflows

Start Codex in this checkout. Root `AGENTS.md` is the self-contained shared rule source;
root `CLAUDE.md` imports it and adds Claude runtime details. Five scoped `AGENTS.md` files point
to the existing scoped Claude guides. Read the indexed guide before editing a subtree even when
launching at root. Codex builds its startup instruction chain from root to the launch directory,
with nearer guidance taking precedence; `AGENTS.override.md` and user configuration can affect it.
The default combined limit is 32 KiB; the repository guidance fits without raising it.
[Official instruction discovery](https://learn.chatgpt.com/docs/agent-configuration/agents-md).

Repository skills live in `.agents/skills/<name>/SKILL.md`, scanned between the current directory
and repository root. The four ports are `use-scaffolders`, `lint`, `codegen`, and `commit-changes`.
Use `/skills` or `$<name>` in Codex; restart if discovery does not refresh. Each port references its
shared source under `.claude/skills/`, so instructions do not diverge.
[Official skill discovery](https://learn.chatgpt.com/docs/build-skills).

Custom prompts are deprecated. Their documented location is `$CODEX_HOME/prompts` (normally
`~/.codex/prompts`), not a repository-local `.codex/prompts` folder. This project uses discoverable
repository skills instead and does not install personal prompts.
[Official custom-prompt guidance](https://learn.chatgpt.com/docs/custom-prompts).

## What maps and what does not

| Capability | This project's Codex behavior |
| --- | --- |
| Project/scoped instructions | Native AGENTS.md discovery plus explicit scoped-guide navigation. |
| Reusable workflows | Four native skills referencing shared maintained instructions. |
| Graph and GraphQL lookup | Identical npm CLIs; never read entire generated outputs. |
| Role judgment | Root task/role disciplines followed in the current session. |
| Claude agent tool/model scopes | Not imported into Codex; prose does not restrict tools. |
| Claude lifecycle hooks/settings | Not registered in Codex; run codegen/graphs/docs checks explicitly. |
| Persistent checks | Husky runs Knip, repository guards and strict docs drift for either client. |
| Pre-write scaffolder blocking | Claude hook only; Codex follows the mandatory scaffolder instruction. |
| Token budgets/session telemetry | Claude transcript hooks only; Codex uses the response/session discipline manually. |

The original bootstrap spec predates current capabilities: `codex features list` reports stable,
enabled `hooks` and `multi_agent` in 0.156.1. Current Codex documentation describes lifecycle hooks,
including PreToolUse/PostToolUse/Stop, and subagent configuration. It would be incorrect to claim
these features do not exist. This phase retains the requested portable-check approach; it does not
port Claude JSON settings, tool scopes, model aliases or transcript parsing without behavioral validation.
[Codex hooks](https://learn.chatgpt.com/docs/hooks) and
[subagent configuration](https://developers.openai.com/codex/subagents).

Scaffold origin cannot be proven from a finished file by lint or pre-commit. Existing guards check
code properties, not which command created a file. Likewise, Git hooks cannot observe a Codex turn's
token counters or physically block an earlier edit. These are explicit parity limits, not successful
emulations. Hooks validate the working tree; partially staged commits require checking the staged
snapshot separately. No CI provider is assumed or added; the same commands are CI-runnable.

## Verification

Run `npm run test:parity`, `npm run lint`, and `npm run docs:drift -- --sweep --strict`.
After the final edit, run `npm run graph-generate` and `npm run graph -- --strict`.
For discovery, the installed CLI's app-server `initialize` followed by `skills/list` with this checkout
in `cwds` can inspect repo skills without starting a model turn. It must show all four project paths
enabled with no project-skill errors. No API/model request is required for that check.

Cold-read root AGENTS.md: generator commands/flags, code standards, role limits, finishing commands,
and generated-file prohibitions must be understandable without prior conversation. Confirm all five
scoped pointers resolve and fit the instruction budget. Recheck this setup note when upgrading Codex;
do not infer future support from this version's feature flags alone.
