#!/usr/bin/env bash
#
# Test runner — executes all test suites and reports results.
#
# Suites:
#   1. RDF conformance (tests/conformance/)
#   2. Go unit tests (apps/bff/)
#   3. TypeScript unit tests (apps/, packages/ via vitest)
#
# Usage: bash tests/run-tests.sh
#
set -uo pipefail

PASS=0
FAIL=0
SKIP=0
RESULTS=""

run_suite() {
  local name="$1" cmd="$2" dir="${3:-.}"
  echo ">>> Running: $name"
  if (cd "$dir" && eval "$cmd") >/tmp/test-suite.log 2>&1; then
    echo "    PASS"
    PASS=$((PASS + 1))
    RESULTS="${RESULTS}PASS  ${name}\n"
  else
    echo "    FAIL (see output below)"
    cat /tmp/test-suite.log
    FAIL=$((FAIL + 1))
    RESULTS="${RESULTS}FAIL  ${name}\n"
  fi
  echo ""
}

skip_suite() {
  local name="$1" reason="$2"
  echo ">>> Skipping: $name ($reason)"
  SKIP=$((SKIP + 1))
  RESULTS="${RESULTS}SKIP  ${name}\n"
  echo ""
}

echo "========================================"
echo " OpenDraft Test Runner"
echo "========================================"
echo ""

# --- Suite 1: RDF Conformance ---
if command -v rapper >/dev/null 2>&1; then
  run_suite "RDF Conformance" "bash tests/conformance/protocol/test_ttl_parse.sh"
else
  skip_suite "RDF Conformance" "rapper not installed"
fi

# --- Suite 3: SHACL Conformance ---
if command -v node >/dev/null 2>&1 && [ -d "node_modules/tsx" ]; then
  run_suite "SHACL Conformance" "node --import tsx tests/conformance/shacl/run-conformance.ts"
else
  skip_suite "SHACL Conformance" "tsx not installed"
fi

# --- Suite 4: Go Tests ---
if command -v go >/dev/null 2>&1; then
  if ls apps/bff/*.go >/dev/null 2>&1; then
    run_suite "Go Tests" "go test ./..." "apps/bff"
  else
    skip_suite "Go Tests" "no Go sources in apps/bff"
  fi
else
  skip_suite "Go Tests" "go not installed"
fi

# --- Suite 5: TypeScript Tests ---
if command -v pnpm >/dev/null 2>&1; then
  if [ -f "vitest.config.ts" ] || [ -f "vitest.config.js" ]; then
    run_suite "TypeScript Tests" "pnpm exec vitest run --reporter=verbose"
  else
    skip_suite "TypeScript Tests" "no vitest config found"
  fi
else
  skip_suite "TypeScript Tests" "pnpm not installed"
fi

# --- Summary ---
echo "========================================"
echo " Results"
echo "========================================"
printf "$RESULTS"
echo "----------------------------------------"
echo "Total: $((PASS + FAIL + SKIP)) | Pass: $PASS | Fail: $FAIL | Skip: $SKIP"
echo "========================================"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
