# TESTING.md — Test Suites and Conformance

## Source of Truth

All TDD workflow, test locations, and per-suite guidelines are defined in the [root AGENTS.md](../../AGENTS.md) under **Testing (TDD)**. This document provides supplementary detail on conformance test categories.

## Conformance Test Categories

These apply to RDF/Turtle protocol files validated via `tests/conformance/`.

### Protocol Tests

Validate `opendraft.ttl`:
- Classes and properties exist
- Namespace is correct
- No conflicting definitions

### Article Tests

Validate `article.shacl.ttl`:
- Required fields (title, authors, abstract)
- Data types and cardinalities
- Reference integrity

### Registry Tests

Validate `registry.shacl.ttl`:
- Registry type (collection or publication)
- Required fields per type
- No mixing of collection and publication

## Adding Conformance Tests

1. Identify the conformance requirement.
2. Create fixture file (valid or invalid example) in `tests/conformance/fixtures/`.
3. Write test script asserting expected behavior.
4. Run `mise run test` to verify.

## Test Structure

```text
tests/conformance/
├── protocol/          # opendraft.ttl tests
├── article/           # article.shacl.ttl tests
├── registry/          # registry.shacl.ttl tests
└── fixtures/          # Test data
```

## References

- [AGENTS.md](../../AGENTS.md) — TDD workflow and test locations (source of truth)
- [tests/AGENTS.md](../../tests/AGENTS.md) — Test directory conventions
- [docs/ADR/016-mvp-scope.md](../ADR/016-mvp-scope.md) — What's tested
