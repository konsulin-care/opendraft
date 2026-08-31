#!/usr/bin/env bash
#
# check-complexity.sh — Check TypeScript complexity rules.
#
# Usage:
#   bash scripts/check-complexity.sh [files...]

set -euo pipefail

if [ $# -eq 0 ]; then
  exit 0
fi

npx eslint --rule '{"complexity": ["error", 15], "max-lines-per-function": ["error", 50]}' "$@"
