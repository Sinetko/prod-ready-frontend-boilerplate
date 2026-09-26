#!/usr/bin/env bash
set -euo pipefail
hook_dir="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
exec node "$hook_dir/lib/budget.mjs" output "$@"
