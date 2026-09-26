---
name: new-page
description: Generate a feature page and register its route and translation namespace.
---

Require the caller's kebab-case page name and feature group, route path, and
namespace. Inspect existing entries before creating anything. Run from the repo
root, substituting the requested values:

```sh
npm run generate-page -- --non-interactive --name details --group example --route /details --namespace details
```

The generator creates src/features/<group>/pages/<name>/{index.ts,<name>.page.tsx,
<name>.translations.ts}, registers the camelCase page-name key in
src/core/routing/routing.model.ts, and registers the explicitly supplied namespace
in src/bootstrap/namespace-map.ts. It rejects conflicting registrations.
Do not bypass the generator or invent a namespace/route. Existing customized
pages should be edited in place; do not overwrite them with the example template.

Replace cloned example dependencies and copy with the actual page behavior.
Keep translations beside the page and use the project Apollo wrappers for data.
Run relevant tests and npm run lint, checking both route and namespace entries.
