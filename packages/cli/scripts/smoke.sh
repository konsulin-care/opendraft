#!/usr/bin/env bash
# Smoke-test the packaged CLI: build, pack, install into a temp dir, then
# run `opendraft init` and `opendraft validate` against the installed bin.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
CLI_DIR="$ROOT/packages/cli"

# Fresh bundle so the tarball ships the current sources.
(cd "$CLI_DIR" && pnpm run build)

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

TARBALL="$WORK/opendraft.tgz"
(cd "$CLI_DIR" && pnpm pack --out "$TARBALL" >/dev/null 2>&1 || pnpm pack --pack-destination "$WORK" >/dev/null 2>&1)
if [ ! -f "$TARBALL" ]; then
  TARBALL="$(printf '%s\n' "$WORK"/*.tgz | head -n 1)"
fi

# Install the tarball in isolation: only the packed files are available.
mkdir -p "$WORK/app"
(cd "$WORK/app" && npm init -y >/dev/null && npm install --no-audit --no-fund "$TARBALL" >/dev/null)

export PATH="$WORK/app/node_modules/.bin:$PATH"
cd "$WORK/app"

opendraft init demo --manuscript paper
test -f demo/opendraft.yml || { echo "smoke: opendraft.yml was not scaffolded" >&2; exit 1; }
opendraft validate demo

echo "smoke: OK"
