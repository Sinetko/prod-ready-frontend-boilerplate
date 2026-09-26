---
name: new-translations
description: Add colocated i18next resources and register their namespace using the existing project pattern.
---

Take the owning module, namespace, and user-facing copy from the request.
Inspect its existing translations and src/bootstrap/namespace-map.ts before
adding anything. Page creation already generates/registers translations through
new-page; do not duplicate that work. There is no generate-translations command.

For an existing component/module, colocate <owner>.translations.ts beside it,
following src/features/example/pages/example/example.translations.ts: a named
camelCase <owner>Translations object exported with as const. Preserve existing
keys and interpolation contracts. Do not put translations in a nested folder.
Register the resource under the caller's namespace in namespaceMap, preserving
other entries. The i18next type augmentation derives resources from this map;
do not hand-maintain a second resource map. Do not change defaultNS incidentally.

If a namespace or copy is missing, ask rather than inventing product language.
Keep existing locale policy; do not introduce a new locale layout. Use typed
useTranslation with the namespace at the consumer. Check literal keys with
npm run check-problem-translation-keys and run npm run lint. Report limitations
when dynamic keys cannot be statically verified.
