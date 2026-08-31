#!/usr/bin/env bash
#
# check-large-files.sh — Check staged files for line count violations.
#
# Usage:
#   bash scripts/check-large-files.sh
#
# Checks only *.go, *.ts, *.tsx files against a 300-line threshold.
# Exits non-zero if any file exceeds the limit.

set -euo pipefail

MAX_LINES=300
PATTERN='\.(go|ts|tsx)$'
EXCLUDED='pnpm-lock\.yaml|package-lock\.json|.*\.min\.js'

failed=0

files=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null || true)

if [ -z "$files" ]; then
  exit 0
fi

for file in $files; do
  # Skip files not matching our pattern
  if ! echo "$file" | grep -qE "$PATTERN"; then
    continue
  fi

  # Skip excluded files
  if echo "$file" | grep -qE "$EXCLUDED"; then
    continue
  fi

  # Skip non-existent files (deleted)
  if [ ! -f "$file" ]; then
    continue
  fi

  lines=$(wc -l < "$file")
  if [ "$lines" -gt "$MAX_LINES" ]; then
    echo "✗ $file ($lines lines, max $MAX_LINES)"
    failed=1
  fi
done

if [ "$failed" -eq 1 ]; then
  echo ""
  echo "Files exceed 300-line limit. Please refactor."
  exit 1
fi

exit 0
