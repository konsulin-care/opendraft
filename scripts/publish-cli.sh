#!/usr/bin/env bash
#
# publish-cli.sh — Publish the CLI atomically.
#
# Usage:
#   bash scripts/publish-cli.sh [patch|minor|major]
#
# The version bump, its commit and its tag survive only when the publish
# succeeded: any failure after the bump rolls the tag and the commit back,
# so a rejected release never consumes a version number.
#
# Preconditions:
#   - the session is authenticated: `pnpm login` (this script never handles tokens)
#   - the working tree is clean (the rollback relies on it)

set -euo pipefail

BUMP="${1:-patch}"
case "$BUMP" in
  patch|minor|major) ;;
  *) echo "publish: bump must be patch, minor or major (got '$BUMP')" >&2; exit 2 ;;
esac

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLI_DIR="$ROOT/packages/cli"
# PUBLISH_CMD exists only so the failure path can be drilled with PUBLISH_CMD=false.
PUBLISH_CMD="${PUBLISH_CMD:-pnpm publish --no-git-checks --access public}"
cd "$ROOT"

if [ -n "$(git status --porcelain)" ]; then
  echo "publish: working tree is dirty; commit or stash first" >&2
  exit 1
fi

if ! pnpm whoami >/dev/null 2>&1; then
  echo "publish: not authenticated to the npm registry; run \`pnpm login\` and retry" >&2
  exit 1
fi

BASE="$(git rev-parse HEAD)"

read_version() {
  node -p "JSON.parse(require('node:fs').readFileSync('$CLI_DIR/package.json','utf8')).version"
}

rollback() {
  git tag -d "v$(read_version)" >/dev/null 2>&1 || true
  git reset --hard "$BASE" >/dev/null
  echo "publish: rolled back to $BASE (version and tag restored)" >&2
}
trap rollback ERR

(cd "$CLI_DIR" && pnpm version "$BUMP" >/dev/null)
NEW_VERSION="$(read_version)"
(cd "$CLI_DIR" && $PUBLISH_CMD)

trap - ERR
echo "publish: @konsulin/opendraft@$NEW_VERSION is live (tag v$NEW_VERSION)"
echo "publish: push the release with: git push --follow-tags"
