# ADR 011: BFF Scope

**Status:** Accepted  
**Date:** 2024-01-01  
**PROPOSAL.md:** §26

## Context

A backend server is needed for GitHub authentication, but should remain minimal.

## Decision

The BFF exists primarily for secure GitHub auth operations requiring server-side credentials.

### Constraints
- Stateless or minimally stateful.
- Lightweight and horizontally replaceable.
- No manuscript storage.
- No publication storage.
- No search databases.
- No background processing (unless later required).

### Resource Targets
- CPU: < 0.25 vCPU under normal workload.
- RAM: < 30 MB.

### Technology
- Go with standard library preferred.

## Consequences

- Easy to deploy and scale.
- No data liability.
- Clear separation: BFF handles auth, client handles everything else.
- Git operations stay client-side.

## References

- PROPOSAL.md §26
