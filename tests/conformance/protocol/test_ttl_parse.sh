#!/usr/bin/env bash
#
# Conformance test: TTL syntax validation
#
# Validates that all protocol TTL files parse correctly with rapper,
# and that invalid TTL is rejected.
#
# Requires: rapper (raptor2)
#   Ubuntu/Debian: sudo apt-get install -y rapper
#   macOS: brew install raptor2
#
# Usage: bash tests/conformance/protocol/test_ttl_parse.sh
#
set -euo pipefail

PASS=0
FAIL=0

run_test() {
  local desc="$1" expect="$2" cmd="$3"
  if eval "$cmd" >/dev/null 2>&1; then
    result="pass"
  else
    result="fail"
  fi
  if [ "$result" = "$expect" ]; then
    echo "PASS: $desc"
    PASS=$((PASS + 1))
  else
    echo "FAIL: $desc (expected $expect, got $result)"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== TTL Syntax Validation ==="
echo ""

# Valid TTL files should parse
for f in protocol/opendraft.ttl protocol/article.shacl.ttl protocol/registry.shacl.ttl protocol/registry.ttl; do
  run_test "$f parses" pass "rapper -i turtle -c $f"
done

# Invalid TTL should fail
echo "not valid turtle" > /tmp/bad.ttl
run_test "invalid TTL rejected" fail "rapper -i turtle -c /tmp/bad.ttl"
rm /tmp/bad.ttl

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
