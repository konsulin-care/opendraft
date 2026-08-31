# OpenDraft — AI Agent Instructions

## Quick Reference

- **Languages:** TypeScript (apps, packages), Go (BFF), Turtle (protocol)
- **Conventional commits:** feat:, fix:, refactor:, docs:, chore:
- **Max file length:** 300 lines
- **Imports:** Use `import type` for type-only imports
- **Naming:** kebab-case files, camelCase functions, PascalCase types

## Directory Guide

| Directory | Purpose | Agent Docs |
|-----------|---------|------------|
| `apps/` | Applications (web, bff) | [apps/AGENTS.md](apps/AGENTS.md) |
| `packages/` | Shared packages | [packages/AGENTS.md](packages/AGENTS.md) |
| `protocol/` | RDF ontology, SHACL | [protocol/AGENTS.md](protocol/AGENTS.md) |
| `tests/` | Conformance tests | [tests/AGENTS.md](tests/AGENTS.md) |
| `docs/` | Documentation, ADRs | [docs/agents/](docs/agents/) |

## Documentation Flow

```
AGENTS.md (this file)
    └──> {subdir}/AGENTS.md
            └──> {subdir}/convention.md
```

## Testing (TDD)

All implementation follows test-driven development. Write a failing test first, write the minimal code to make it pass, then refactor. Never commit code without a corresponding test unless explicitly exempted by ADR.

### TDD Cycle

1. **Red** — Write a test that fails because the feature does not exist.
2. **Green** — Write the smallest amount of code that makes the test pass.
3. **Refactor** — Clean up without changing behavior. Tests must still pass.

### Test Locations

Tests are co-located with the code they exercise.

| Component | Language | Location | Pattern |
|-----------|----------|----------|----------|
| BFF | Go | `apps/bff/` | `*_test.go` next to source |
| Webapp | TypeScript | `apps/web/` | `*.test.ts` next to source |
| Packages | TypeScript | `packages/{name}/` | `tests/{module}.test.ts` |
| Protocol | RDF/Turtle | `tests/conformance/` | `*.sh` shell scripts |

### Running Tests

```bash
mise run test        # Run all suites (RDF, Go, TypeScript)
mise run test-go     # Run Go tests only
```

`mise run test` delegates to `tests/run-tests.sh` which runs all three suites and reports per-suite pass/fail.

### Per-Suite Guidelines

**Go (BFF):** Use the standard `testing` package. Tests must be in the same package as the code under test. File pattern: `handler_test.go` next to `handler.go`.

**TypeScript (webapp, packages):** Use Vitest. Test file mirrors the source file name: `parser.ts` becomes `parser.test.ts`. Place package tests in `packages/{name}/tests/`.

**RDF (protocol):** Validate TTL syntax with `rapper`. Validate shapes with SHACL. Test fixtures go in `tests/conformance/fixtures/`. One script per conformance category.

### Rules

- One test per conformance requirement or behavioral assertion.
- Test behavior, not implementation details.
- Tests must be deterministic — no flaky tests.
- Prefer real dependencies over mocks where practical.

## Deep Dives

- [ARCHITECTURE.md](docs/agents/ARCHITECTURE.md) — Tech stack, rationale
- [CONVENTIONS.md](docs/agents/CONVENTIONS.md) — Global code conventions
- [WORKFLOW.md](docs/agents/WORKFLOW.md) — Git, PRs, CI/CD
- [PROTOCOL.md](docs/agents/PROTOCOL.md) — Protocol summary
- [SECURITY.md](docs/agents/SECURITY.md) — Auth, secrets, least-privilege
- [MANUSCRIPTS.md](docs/agents/MANUSCRIPTS.md) — Quarto, YAML, BibTeX
- [TESTING.md](docs/agents/TESTING.md) — Conformance tests
