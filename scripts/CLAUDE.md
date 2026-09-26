# Tool-script guidance

Follow the [root scaffolder table](../AGENTS.md#mandatory-scaffolders) and
[verification guide](../.claude/docs/verification.md). Scripts run under `tsconfig.node.json`;
graph tooling has its existing cached .mjs compilation path.

- Keep human prompts and fully specified `--non-interactive` automation; missing/unknown flags must fail
  immediately. Do not silently wait on stdin or invent defaults for required project decisions.
- Inspect partial outputs. Preserve identical files, fill missing files, reject differing customized files,
  and retain path/traversal/symlink protections. Use existing AST registry editing helpers.
- Guard scripts must report real violations with nonzero exit codes; do not replace them with no-ops.
- Graph queries parse one selected graph in-process. Preserve deterministic atomic generation, freshness
  validation, size advisories, explicit static-analysis limits, and extraction instead of huge agent Reads.
- Update package commands and the root README index when adding/removing a scaffolder. Skills and root
  guidance must use actual flags. Do not add future doc/autotest commands before their phases implement them.
- Verify behavior with the relevant existing isolated scaffolder/guard/graph/hook/agent suite and root lint.
  Fixtures may generate files in temporary repos; never test destructive behavior against the user's tree.
