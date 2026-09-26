---
name: new-form
description: Create a form through the component/hook scaffolders while preserving the owning feature’s established form conventions.
---

Locate existing forms and their owning layer with graph-lookup before selecting
an implementation. This repo currently has no form library or generate-form
script. Use a caller-provided form contract or an established project example;
if neither exists, obtain fields, validation, submission behavior, and the form
approach before writing behavior. Do not silently install a library or invent
validation conventions. A native React form is appropriate only when it fits
the agreed requirements; no library is required by this skill.

Create the component yourself using requested names/paths:

```sh
npm run generate-component -- --non-interactive --name account-form --path src/features/example/components
```

Extract substantial form behavior through generate-hook with --non-interactive,
--name use-<name>, and --path <owning-hooks-directory>. Inspect existing targets
first; edit customized files instead of overwriting them. Keep nontrivial props
in .types.ts, helper components in their own directories, constants in .model.ts,
and event handlers over 10 lines in hooks/utils. Use new-translations for copy.
Preserve project Apollo wrappers if submitting GraphQL data. Implement and test
the agreed validation, pending, success, and error behavior; run npm run lint.
