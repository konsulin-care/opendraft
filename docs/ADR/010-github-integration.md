# ADR 010: GitHub Integration

**Status:** Accepted  
**Date:** 2024-01-01  
**PROPOSAL.md:** §25

## Context

OpenDraft needs to integrate with GitHub for repository hosting and collaboration.

## Decision

GitHub is an integration layer, not the protocol authority.

### Two Authorization Modes

1. **Installation authorization** — for existing repositories.
   - Read/write repository content.
   - Manage issues and PRs.

2. **User authorization** — for privileged operations.
   - Repository creation.
   - Fork to user account.

### Flow
- After repository creation, switch to installation auth.
- BFF mediates all credential exchange.

## Consequences

- GitHub-specific but not GitHub-dependent.
- Protocol refers to repository resources, not GitHub specifics.
- Secure credential handling via BFF.
- Extensible to other Git hosts in future.

## References

- PROPOSAL.md §25
- ADR-012 (Security Model)
