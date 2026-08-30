# ADR 002: Client-First Architecture

**Status:** Accepted  
**Date:** 2024-01-01  
**PROPOSAL.md:** §22, §23, §24

## Context

OpenDraft needs to handle manuscript editing, Git operations, and GitHub integration. A server-centric approach would create storage requirements and single points of failure.

## Decision

OpenDraft is primarily a PWA with client-side persistence:

- **IndexedDB** for all local storage (manuscripts, Git objects, state).
- **Browser-side Git** via isomorphic-git for local operations.
- **No server-side manuscript storage** — the BFF handles auth only.
- **Offline support** — drafting works without network.

## Consequences

- No server storage costs.
- No single point of failure for manuscript access.
- Offline-first capability.
- BFF remains minimal (< 0.25 vCPU, < 30 MB RAM).
- Git operations may be slower in browser than native.

## References

- PROPOSAL.md §22, §23, §24
- ADR-011 (BFF Scope)
