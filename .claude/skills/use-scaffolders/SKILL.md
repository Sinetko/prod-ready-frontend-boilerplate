---
name: use-scaffolders
description: Look up the existing artefact generator and its required flags without executing a workflow.
---

| Entity | Command from repository root | Required flags after -- | Optional flags |
| --- | --- | --- | --- |
| Component | npm run generate-component -- | --non-interactive --name <kebab-name> --path <src-parent> | — |
| Hook | npm run generate-hook -- | --non-interactive --name use-<kebab-name> --path <src-parent> | — |
| Util | npm run generate-util -- | --non-interactive --name <kebab-name> --path <src-parent> | — |
| Store | npm run generate-store -- | --non-interactive --name <kebab-name> --path <src-parent> | — |
| Context | npm run generate-context -- | --non-interactive --name <kebab-name> --path <src-parent> | — |
| Page | npm run generate-page -- | --non-interactive --name <kebab-name> --group <feature> --route <url-path> --namespace <namespace> | — |
| Query | npm run generate-query -- | --non-interactive --name <kebab-name> --field <schema-field> | --schema <schema-path> |
| Lazy query | npm run generate-query -- | --non-interactive --name <kebab-name> --field <schema-field> --lazy | --schema <schema-path> |
| Mutation | npm run generate-query -- | --non-interactive --name <kebab-name> --field <schema-field> --mutation | --schema <schema-path> |
| Fragment | npm run generate-fragment -- | --non-interactive --name <kebab-name> --type <GraphQLType> | --schema <schema-path> |
| Translations | No standalone generator; generate-page includes them | Existing owner uses colocated <owner>.translations.ts and namespaceMap | See new-translations |
| Form | npm run generate-component -- | --non-interactive --name <form-name> --path <src-parent> | No dedicated generator; new-form resolves the form contract |
| Table | npm run generate-component -- | --non-interactive --name <table-name> --path <src-parent> | No dedicated generator; new-table resolves the table contract |
| Stateful columns | npm run generate-hook -- | --non-interactive --name use-<name>-columns --path <src-parent> | Only when the chosen table API benefits; see use-table-columns |
