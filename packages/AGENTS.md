# packages/ — Agent Guide

## Purpose

Contains shared libraries used by apps/. Each package is independently importable.

## Package Inventory

| Package | Purpose |
|---------|---------|
| editor | Manuscript editing interface components |
| git | Browser-side Git operations (via isomorphic-git) |
| github | GitHub API client, auth helpers |
| metadata | YAML metadata parsing and validation |
| references | BibTeX parsing and citation management |
| rdf | RDF/Turtle generation for publications |
| quarto | Quarto Markdown processing |

## Design Rules

- Packages do not depend on apps/ — dependency flows one way.
- Packages may depend on other packages.
- Each package exports a public API via index.ts.
- Keep packages focused — one responsibility each.

## Common Pitfalls

1. **Circular dependencies** — check with `madge` before committing.
2. **Tight coupling to apps/** — packages must be app-agnostic.
3. **Leaking implementation details** — export types, not internals.
4. **Skipping tests** — each package needs unit tests.
5. **Inconsistent exports** — use named exports, avoid default exports.

## When to Read convention.md

Read [convention.md](convention.md) when:
- Creating a new package
- Modifying package exports or API surface
- Setting up package.json or tsconfig.json

## References

- [docs/agents/ARCHITECTURE.md](../docs/agents/ARCHITECTURE.md) — Tech stack
