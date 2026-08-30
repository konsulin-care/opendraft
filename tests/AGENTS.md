# tests/ — Agent Guide

## Purpose

Contains conformance tests that validate protocol compliance. These tests ensure artifacts meet the OpenDraft specification.

## Testing Philosophy

- **Protocol conformance, not unit testing.**
- Test the spec, not the implementation.
- One test per conformance requirement.
- Tests should be runnable independently.

## Test Structure

```text
tests/conformance/
├── protocol/          # opendraft.ttl tests
├── article/           # article.shacl.ttl tests
├── registry/          # registry.shacl.ttl tests
└── fixtures/          # Test data
```

## Common Pitfalls

1. **Testing implementation instead of protocol** — test the spec, not the code.
2. **Brittle assertions** — test semantic equivalence, not exact strings.
3. **Missing edge cases** — test empty, missing, malformed inputs.
4. **Coupling to specific tools** — use abstract validation where possible.
5. **Forgetting fixtures** — test data belongs in fixtures/.

## When to Read convention.md

Read [convention.md](convention.md) when:
- Adding new conformance tests
- Modifying test fixtures
- Changing test assertions

## References

- [docs/agents/TESTING.md](../docs/agents/TESTING.md) — Testing strategy
- [docs/ADR/016-mvp-scope.md](../docs/ADR/016-mvp-scope.md) — What's tested
