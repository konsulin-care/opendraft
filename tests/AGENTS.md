# tests/ — Agent Guide

## Purpose

Contains the test runner and conformance tests. Unit tests for Go and TypeScript are co-located with their source code (see [root AGENTS.md](../AGENTS.md) under **Testing (TDD)**).

## Test Categories

| Category | Location | Runner |
|----------|----------|--------|
| Go (BFF) | `apps/bff/*_test.go` | `go test ./...` |
| TypeScript (webapp) | `apps/web/*.test.ts` | `vitest` |
| TypeScript (packages) | `packages/{name}/tests/` | `vitest` |
| RDF conformance | `tests/conformance/` | `test_ttl_parse.sh` |

## Test Runner

`tests/run-tests.sh` orchestrates all suites. Invoked by `mise run test`.

## Conformance Tests

Protocol conformance tests validate that RDF/Turtle artifacts meet the OpenDraft specification. These live under `tests/conformance/`.

### Structure

```text
tests/conformance/
├── protocol/          # opendraft.ttl tests
├── article/           # article.shacl.ttl tests
├── registry/          # registry.shacl.ttl tests
└── fixtures/          # Test data
```

### Common Pitfalls

1. **Testing implementation instead of protocol** — test the spec, not the code.
2. **Brittle assertions** — test semantic equivalence, not exact strings.
3. **Missing edge cases** — test empty, missing, malformed inputs.
4. **Coupling to specific tools** — use abstract validation where possible.
5. **Forgetting fixtures** — test data belongs in fixtures/.

## References

- [AGENTS.md](../AGENTS.md) — TDD workflow and test locations (source of truth)
- [docs/agents/TESTING.md](../docs/agents/TESTING.md) — Conformance test categories
- [docs/ADR/016-mvp-scope.md](../docs/ADR/016-mvp-scope.md) — What's tested
