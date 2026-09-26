# Development tooling

<!-- technical-sha256: deb8782ff5d6b5f6ad1f438544605a2e17dcbc26fae9a792bd5243db58187b16 -->

## Purpose

Help maintainers keep implementation conventions and documentation reviewable as the repository changes.

## Supported outcomes

- Commits run dependency, repository guard and strict documentation checks. [C1] [C11]
- Documentation freshness cannot be stamped using a dossier from before a source change. [C2]
- Preparing missing docs preserves existing authored documents. [C3]
- Document checks detect changed quoted evidence and changed technical sources. [C4] [C5]
- Publication remains unavailable until a destination is configured. [C6]
- Strict documentation checks expose removed units with leftover snapshots. [C7]
- Browser-test tooling is checked separately from application tooling. [C8]
- Browser tests automatically check for unexpected API requests at teardown. [C9]
- Maintainers can look up test tags, imported modules, page facades and reusable mock factories. [C10]

- Both coding clients share indexed project guidance and maintained workflow instructions. [C12] [C13]

- Page generation rejects conflicting translation bindings and unsafe symbolic-link destinations before writing artefacts. [C14] [C15] [C16]
- Type-only barrel exports do not count as executable imports for shared-code test checks. [C17]

- Maintainers can build a static application container and a browser-test container with matching browser dependencies. [C18] [C19]
- Both hosting-provider pipelines include autotests in the main repository checks. [C20] [C21]

## Limitations

Quote/reference checks do not prove prose semantics; writers must review claims. Backfill prepares unfinished templates, not authored documentation. External publication is unconfigured. Hook guards are convention enforcement and are not a complete shell sandbox. Context-graph size warnings and the known Vite module-layout advisory remain separate from docs correctness.

Browser tests require their separate checks. Native macOS 13 runs use installed Chrome; bundled Chromium runs in the Linux Docker image. Test graphs do not measure executed coverage, and sample mocks
do not prove backend integration. Mock routing covers browser HTTP requests only. TestRail IDs and external
reporting are not configured.

Codex receives shared guidance and portable checks; automatic scaffold blocking and token telemetry
are not configured for it. These checks cannot prove which tool created a finished file.

CI image publication and deployment are unconfigured. Runner execution and required merge statuses must be enabled on the hosting service.
