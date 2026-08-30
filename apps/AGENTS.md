# apps/ — Agent Guide

## Purpose

Contains the runnable applications:
- **web/**: TypeScript PWA client for manuscript authoring
- **bff/**: Go backend-for-frontend for GitHub authentication

## Component Boundaries

- **web/** handles all user interaction, manuscript editing, local Git, IndexedDB persistence.
- **bff/** handles only GitHub OAuth and App installation token exchange.
- Manuscript logic stays in packages/, not bff/.
- The BFF is not a Git proxy — Git operations happen client-side.

## Common Pitfalls

1. **Don't put manuscript logic in bff/** — it only handles auth.
2. **Don't use bff as a Git proxy** — browser-side Git is the design.
3. **Don't store manuscripts server-side** — IndexedDB is the persistence layer.
4. **Don't bypass packages/** — shared logic belongs in packages/.
5. **Don't expose secrets to browser** — BFF mediates all credential flows.

## When to Read convention.md

Read [convention.md](convention.md) when:
- Writing TypeScript in web/
- Writing Go in bff/
- Setting up PWA service workers or IndexedDB schemas

## References

- [docs/agents/ARCHITECTURE.md](../docs/agents/ARCHITECTURE.md) — Tech stack
- [docs/agents/SECURITY.md](../docs/agents/SECURITY.md) — Auth flow
