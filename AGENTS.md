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

## Deep Dives

- [ARCHITECTURE.md](docs/agents/ARCHITECTURE.md) — Tech stack, rationale
- [CONVENTIONS.md](docs/agents/CONVENTIONS.md) — Global code conventions
- [WORKFLOW.md](docs/agents/WORKFLOW.md) — Git, PRs, CI/CD
- [PROTOCOL.md](docs/agents/PROTOCOL.md) — Protocol summary
- [SECURITY.md](docs/agents/SECURITY.md) — Auth, secrets, least-privilege
- [MANUSCRIPTS.md](docs/agents/MANUSCRIPTS.md) — Quarto, YAML, BibTeX
- [TESTING.md](docs/agents/TESTING.md) — Conformance tests
