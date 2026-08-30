# ADR 005: Authorship & CRediT Model

**Status:** Accepted  
**Date:** 2024-01-01  
**PROPOSAL.md:** §8

## Context

Scientific authorship involves more than Git commits. Contributors may provide verbal input, review, discussion, or other non-code contributions.

## Decision

- **Declared authorship** is primary (via `_author.yml`).
- **CRediT roles** may be explicitly represented.
- **Git activity** is supporting evidence for auditability, not authorship determination.

Git activity provides provenance:
- Commits
- Pull requests
- Issues
- Discussions
- Reviews

This evidence complements declared authorship rather than replacing it.

## Consequences

- Non-Git contributors receive appropriate credit.
- Authorship remains a human decision.
- Git history provides audit trail, not authority.
- CRediT roles are optional but encouraged.

## References

- PROPOSAL.md §8
