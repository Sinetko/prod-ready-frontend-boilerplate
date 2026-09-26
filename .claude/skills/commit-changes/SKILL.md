---
name: commit-changes
description: Prepare and create a requested Git commit with the configured identity and full verification in the current checkout or worktree.
---

A commit request, including explicit invocation of this skill, authorizes the
requested local commit. Automatic skill discovery alone does not authorize one.
Complete preparation first; if the task did not authorize committing, present
the concrete staged-change proposal and request authorization before staging or
committing. Do not ask again when the user already authorized that same scope.
This skill never authorizes a push, merge, reset, or amendment.

Detect context from the current directory rather than assuming .git is a folder:

```sh
git rev-parse --show-toplevel
git rev-parse --absolute-git-dir
git rev-parse --path-format=absolute --git-common-dir
git worktree list --porcelain
git symbolic-ref --quiet --short HEAD
git status --short
```

Compare normalized absolute Git directory/common-directory paths: different
paths indicate a linked worktree. Run all checks and mutations in the current
checkout root; never switch to or stage files in its sibling/main checkout.
If HEAD is detached or Git reports a merge/rebase/cherry-pick in progress,
resolve the intended target with the caller before an ordinary commit.

Use `git var GIT_AUTHOR_IDENT` and `git var GIT_COMMITTER_IDENT` to inspect the
effective identity in this context. Honor existing author, signing, and hook
configuration in both main and linked worktrees. Do not replace identity,
introduce bot/co-author attribution, disable signing, pass --no-verify, set
HUSKY=0, or override hooksPath. Missing identity/signing support is a real
blocker to resolve, not a reason to forge configuration or bypass checks.

Inspect git diff, git diff --cached, and relevant untracked files. Scope the
commit to the caller's requested changes. Do not stage everything by default,
include unrelated pre-staged changes, or discard another person's work. Use
explicit file paths; mixed changes within one file require selective staging or
a clarified scope. Never reset the index simply to make it match your plan.

Before committing, run npm run lint and tests relevant to the change. Run
npm run docs:drift -- --sweep --strict, refresh graphs after the final edits with
npm run graph-generate, and run npm run graph -- --strict. For partial staging,
these checks validate the working tree, not an isolated index: verify the staged
patch remains coherent and validate the exact staged content separately if
unstaged differences affect it. Do not claim working-tree tests prove an
untested staged snapshot. Fix failures within scope; never silently skip them.

Stage only the authorized paths/hunks, inspect git diff --cached and
git diff --cached --check, and write a clear message describing the actual
change, following an established message convention if present. Do not invent
a required prefix convention. Use git commit with the approved scope and normal
hooks/signing. For multiline messages use a message file and --file rather than
shell-interpolating prose. On failure, inspect it and retry only after resolving
the cause without bypasses. Confirm the new commit with git log -1 and remaining
work with git status --short. Report the commit hash, included scope, and checks.
