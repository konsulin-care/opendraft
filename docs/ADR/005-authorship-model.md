# ADR 005: Authorship & CRediT Model

**Status:** Accepted  
**Date:** 2024-01-01  
**PROPOSAL.md:** §8  
**Amended by:** [ADR-021](021-spar-ocdm-publication-metadata.md)

> **Amendment (2026-10-21):** Authorship facts are **per-document roles**, not global facts about a person. Declared authorship for a manuscript is recorded as `pro:RoleInTime` nodes bound to the publication's document context (`pro:isDocumentContextFor`), each held by an agent (`pro:isHeldBy`): corresponding-author status, equal contribution, affiliation, and CRediT roles live on those roles, so the same person can be corresponding author on one document and not on another. CRediT roles are the 14 NISO CRediT IRIs (`credit:*`), declared `pro:Role` in the ontology. The decision below stands: declared authorship remains primary, CRediT optional-but-encouraged, and Git activity remains supporting evidence only.

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
- [ADR-021](021-spar-ocdm-publication-metadata.md) — per-document role model
