# Scaffolder details

The root CLAUDE.md table is the command entry point. The [lookup skill](../skills/use-scaffolders/SKILL.md)
and [README scaffolder section](../../README.md#scaffolders) document exact flags and output behavior.

- Run from the repository root using npm; automation must supply `--non-interactive` and all required flags.
- Names and feature groups are kebab-case; hook names start with `use-`. Parent paths are repository-relative inside `src/`.
- Inspect existing output first. Generators preserve identical files, restore missing files, and reject differing files.
  Do not delete edited output to defeat that protection. Resolve the conflict explicitly.
- Pages register `routePaths` in `src/core/routing/routing.model.ts` and namespaces in
  `src/bootstrap/namespace-map.ts`. These registries do not install a router or choose product locales.
- Query generation supports `--lazy` or `--mutation`; refine schema-derived selections for the actual screen.
  A sole required input object is flattened into operation variables. Generation then runs codegen and extraction.
- Forms and tables compose component/hook generators. There is no separate form/table/translation generator
  or mandated library. Resolve the concrete interaction/API contract before choosing one.
- Translations stay beside their owner; models/constants stay beside the owning module.
- The scaffold guard escape hatch `CLAUDE_DISABLE_SCAFFOLD_GUARD=1` is rare and needs a real reason
  recorded in the session. It is not a normal creation workflow.

Canonical examples live in `src/shared/hooks/use-example/`, `src/shared/utils/example/`,
`src/core/stores/example/`, `src/core/contexts/example/`, `src/features/example/pages/example/`,
and `src/graphql/fragments/example.fragment.ts`. Read only the shape needed for the task.
