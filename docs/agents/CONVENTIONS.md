# CONVENTIONS.md — Global Code Conventions

## Overview

This document provides a global overview of conventions. For subdirectory-specific rules, see:
- [apps/convention.md](../../apps/convention.md)
- [packages/convention.md](../../packages/convention.md)
- [protocol/convention.md](../../protocol/convention.md)
- [tests/convention.md](../../tests/convention.md)

## File Naming

- **TypeScript:** `kebab-case.ts`
- **Go:** `camelCase.go` (standard)
- **Turtle:** `lowercase.ttl` or `lowercase.shacl.ttl`
- **Test files:** `*.test.ts`, `*_test.go`
- **Documentation:** `UPPERCASE.md` or `lowercase.md`

## Code Style

- Max 300 lines per file.
- Use `import type` for type-only imports (TypeScript).
- Prefer `interface` over `type` for object shapes.
- No `any` — use `unknown` and narrow.
- `const` over `let` where possible.

## Commit Messages

Conventional commits:

```text
feat: add manuscript editor component
fix: handle empty metadata gracefully
refactor: extract RDF generation to package
docs: update protocol documentation
chore: update dependencies
```

Subject line under 75 characters. Describe what and why, not how.

## Documentation

- JSDoc for all exported functions.
- README.md in each package (future).
- ADRs for architectural decisions.

## Branch Strategy

- `main` — stable, always deployable.
- Feature branches: `feat/*`, `fix/*`, `docs/*`.
- Squash merge into main.
