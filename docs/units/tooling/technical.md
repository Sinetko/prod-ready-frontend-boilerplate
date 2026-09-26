# Development tooling

## Scope

Repository scripts, guards, shared AGENTS guidance, Codex workflow ports, Claude hooks/roles/skills, lint/build configuration, dependency metadata, the feature-document pipeline, Docker images, CI pipelines and the separate Playwright harness. Includes tooling source and behavior tests.

## Operator workflow

Operators generate artefacts with arrow-function implementations in src/, run local checks, query context graphs and maintain evidence-backed unit docs. The claims below describe specific enforcement and documentation behavior; agent prompts alone are not a shell sandbox.

## Verified claims

- [C1] The pre-commit hook runs unused-dependency and repository guard checks. <!-- evidence: {"path": ".husky/pre-commit", "contains": "npm run lint:guards"} -->
- [C2] The docs writer refuses a fingerprint that differs from the reviewed dossier. <!-- evidence: {"path": "scripts/docs/actions.mjs", "contains": "if (fingerprint(unit) !== expected) throw new Error('Sources changed since dossier creation; rebuild and review.');"} -->
- [C3] Backfill preserves existing documents when preparing missing templates. <!-- evidence: {"path": "scripts/docs/actions.mjs", "contains": "if (write(file, text, true)) created.push(file);"} -->
- [C4] Claim evidence must match handwritten source text. <!-- evidence: {"path": "scripts/docs/validation.mjs", "contains": "if (!read(evidence.path).includes(evidence.contains))"} -->
- [C5] Business documents record the technical document digest. <!-- evidence: {"path": "scripts/docs/validation.mjs", "contains": "if (sourceHash !== docHashes(unit)[technicalPath])"} -->
- [C6] External publication fails until a destination is configured. <!-- evidence: {"path": "scripts/docs/actions.mjs", "contains": "External documentation destination is not configured."} -->
- [C7] Strict drift checks include orphaned freshness snapshots. <!-- evidence: {"path": "scripts/docs/actions.mjs", "contains": "orphanedSnapshots: orphaned"} -->
- [C8] Playwright owns a separate lint and TypeScript command pipeline. <!-- evidence: {"path": "autotests/playwright/package.json", "contains": "\"lint\": \"npm run lint:code && npm run lint:types\""} -->
- [C9] The automatic per-test mock fixture verifies unexpected requests during teardown and disposes its router in a finally block. <!-- evidence: {"path": "autotests/playwright/fixtures/fixtures.globalMocker.ts", "contains": "mocker.verify();\n        } finally {\n          await mocker.dispose();"} -->
- [C10] Four dedicated autotest graphs index TestRail tags, static import reachability, facades and mock factories. <!-- evidence: {"path": "scripts/graphs/model.ts", "contains": "'autotests.testrail',\n  'autotests.coverage',\n  'autotests.facade',\n  'autotests.mock',"} -->

- [C11] Pre-commit also runs strict documentation drift checks. <!-- evidence: {"path": ".husky/pre-commit", "contains": "npm run docs:drift -- --sweep --strict"} -->
- [C12] Scoped guidance must appear in the root AGENTS index. <!-- evidence: {"path": ".claude/hooks/lib/guidance-drift.mjs", "contains": "if (!main.includes(`](${file})`)) report(`${file} is missing from root AGENTS.md's scoped index.`);"} -->
- [C13] The Codex codegen skill loads the maintained shared workflow. <!-- evidence: {"path": ".agents/skills/codegen/SKILL.md", "contains": "Read and follow the [shared workflow](../../../.claude/skills/codegen/SKILL.md)."} -->

- [C14] Page registration rejects reuse of a translation import binding for another source module. <!-- evidence: {"path": "scripts/lib/registry.ts", "contains": "throw new Error(`Registry import binding already used: ${desired.name.text}`);"} -->
- [C15] Every planned scaffolder output, including editable registries, passes source-path validation before writes. <!-- evidence: {"path": "scripts/lib/files.ts", "contains": "for (const [file, content] of files) {\n    sourcePath(file);"} -->
- [C16] Dangling output symlinks are rejected instead of followed during generation. <!-- evidence: {"path": "scripts/lib/files.ts", "contains": "throw new Error('Output path contains a dangling symlink.');"} -->
- [C17] Shared-code test-presence checks skip type-only barrel declarations and type-only export lists. <!-- evidence: {"path": "scripts/guards/repository.ts", "contains": "declaration.isTypeOnly ||\n            (declaration.exportClause &&\n              ts.isNamedExports(declaration.exportClause) &&\n              declaration.exportClause.elements.every((item) => item.isTypeOnly))"} -->

- [C18] The production image serves built static output as an unprivileged Nginx user. <!-- evidence: {"path":"Dockerfile","contains":"USER nginx"} -->
- [C19] The browser image installs Chromium using the locked Playwright dependency. <!-- evidence: {"path":"autotests/Dockerfile","contains":"npx --no-install playwright install --with-deps chromium"} -->
- [C20] The main GitLab pipeline includes autotest jobs from the autotests tree. <!-- evidence: {"path":".gitlab-ci.yml","contains":"local: /autotests/.gitlab-ci.yml"} -->
- [C21] The main GitHub workflow invokes the reusable autotest workflow as a job. <!-- evidence: {"path":".github/workflows/ci.yml","contains":"uses: ./.github/workflows/autotests.yml"} -->

## Verification

Docker and CI setup is documented in `docker/README.md`. Build both images from the repository root;
smoke-test the frontend on port 8080 and run browser lint, tests and mock guards in the autotest image.
GitLab includes the browser jobs in the main pipeline; GitHub calls a reusable browser workflow.
Remote runner execution and hosting-service branch-protection settings require the repository host.

Run `npm run test:parity`, `npm run test:docs`, `npm run test:hooks`, `npm run test:agents`, `npm run lint`, and `npm run docs:drift:strict`. Graph verification requires generation after the last edit followed by `npm run graph -- --strict`. Other tooling suites are listed in package.json.

For Playwright, run `npm --prefix autotests/playwright run lint`, `npm --prefix autotests/playwright test`, and `npm --prefix autotests/playwright run test:guard`. The six browser cases and five intentional failure scenarios pass on this host using `PLAYWRIGHT_CHANNEL=chrome`. Autotest graph behavior is included in `npm run test:graphs`.

## Limitations

Quote/reference checks do not prove prose semantics; writers must review claims. Backfill prepares unfinished templates, not authored documentation. External publication is unconfigured. Hook guards are convention enforcement and are not a complete shell sandbox. Context-graph size warnings and the known Vite module-layout advisory remain separate from docs correctness.

Root lint does not validate the Playwright package. Its bundled Chromium installer rejects native installation on this macOS 13 host; native tests use the documented installed-Chrome override. The Docker image runs bundled Chromium on Linux. Autotest coverage graphs describe static module imports, not executed coverage. Mock examples are synthetic harness contracts; the sample app has no API integration. Browser routing does not intercept server-side requests, separate API clients or WebSockets. No real TestRail IDs or publishing integration have been supplied.

Codex parity uses shared instructions, four repository skills and portable checks. Scaffold origin cannot
be proven from a finished file; Codex pre-write blocking and token telemetry are not configured.
Installed Codex 0.156.1 discovers all four ports; its hook/multi-agent capabilities are not disabled
or configured by these docs. Root and scoped rule files are indexed by strict drift.

GitLab rootless image builds require compatible Linux runner user-namespace/mount settings. Remote CI execution has not been performed locally, and merge-status requirements are hosting settings. Images are built for verification without registry publication or deployment.
