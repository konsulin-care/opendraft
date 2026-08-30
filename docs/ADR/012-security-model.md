# ADR 012: Security Model

**Status:** Accepted  
**Date:** 2024-01-01  
**PROPOSAL.md:** §27

## Context

OpenDraft handles GitHub credentials and user authentication. Security must follow best practices.

## Decision

### Least-Privilege Principles
- GitHub App requests only required permissions.
- Browser receives only credentials necessary for operation.

### BFF Constraints
Must never expose:
- GitHub App private keys.
- OAuth client secrets.
- Refresh tokens unnecessarily.
- Installation private credentials.

Must not:
- Provide arbitrary GitHub API proxying.

## Consequences

- Reduced attack surface.
- Explicit permission model.
- Clear trust boundaries.
- Credentials never reach browser unnecessarily.

## References

- PROPOSAL.md §27
- ADR-010 (GitHub Integration)
