# TESTING.md — Conformance Tests

## Philosophy

OpenDraft uses conformance testing to validate protocol compliance. Tests check that artifacts meet the specification, not that implementation code works correctly.

## Test Categories

### Protocol Tests

Validate opendraft.ttl:
- Classes and properties exist
- Namespace is correct
- No conflicting definitions

### Article Tests

Validate article.shacl.ttl:
- Required fields (title, authors, abstract)
- Data types and cardinalities
- Reference integrity

### Registry Tests

Validate registry.shacl.ttl:
- Registry type (collection or publication)
- Required fields per type
- No mixing of collection and publication

## Adding New Tests

1. Identify the conformance requirement.
2. Create fixture file (valid or invalid example).
3. Write test asserting expected behavior.
4. Run tests to verify.

## Test Structure

```text
tests/conformance/
├── protocol/
├── article/
├── registry/
└── fixtures/
```

See [tests/AGENTS.md](../../tests/AGENTS.md) for conventions.

## References

- [tests/convention.md](../../tests/convention.md)
- [docs/ADR/016-mvp-scope.md](../ADR/016-mvp-scope.md)
