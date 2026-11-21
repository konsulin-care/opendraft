# apps/ — Agent Guide

## Purpose

Contains the runnable applications:
- **web/**: TypeScript PWA client for manuscript authoring
- **bff/**: Go backend-for-frontend for GitHub authentication and a narrow git transport relay

## Component Boundaries

- **web/** handles all user interaction, manuscript editing, local Git, IndexedDB persistence.
- **bff/** is a narrow sign-in-only git transport relay, no git logic — it also handles auth, session, repo create, permissions, pulls, forks, and static hosting.
- Manuscript logic stays in packages/, not bff/.
- Git logic happens client-side; the BFF relay only forwards smart-HTTP requests for signed-in users.

## BFF Responsibilities

The BFF is limited to:

- Authentication (GitHub App user access tokens only)
- Sealed-cookie session management
- Repository creation
- Permission checks
- Pull requests
- Forks
- Sign-in-only git transport relay (`/@api/git/{owner}/{repo}.git/...`)
- Static hosting of the web app (one image, same-origin, `/@api` and `/@assets` namespace)

## Common Pitfalls

1. **Don't put manuscript logic in bff/** — it only handles auth and the narrow relay.
2. **Don't add git logic to bff/** — it is a narrow sign-in-only git transport relay, not a git implementation.
3. **Don't store manuscripts server-side** — IndexedDB is the persistence layer.
4. **Don't bypass packages/** — shared logic belongs in packages/.
5. **Don't expose secrets to browser** — BFF mediates all credential flows; tokens never leave the server.
6. **Don't hardcode colors** — use the tokens in the `@theme` block of `apps/web/src/index.css` (token utilities or `var(--color-*)`), never raw hex, rgb, or rgba.

## When to Read convention.md

Read [convention.md](convention.md) when:
- Writing TypeScript in web/
- Writing Go in bff/
- Setting up PWA service workers or IndexedDB schemas

## References

- [docs/agents/ARCHITECTURE.md](../docs/agents/ARCHITECTURE.md) — Tech stack
- [docs/agents/SECURITY.md](../docs/agents/SECURITY.md) — Auth flow
