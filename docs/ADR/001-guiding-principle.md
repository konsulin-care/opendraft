# ADR 001: Guiding Architectural Principle

**Status:** Accepted  
**Date:** 2024-01-01  
**PROPOSAL.md:** §1, §37

## Context

OpenDraft aims to improve decentralized scholarly publishing. There is a risk of creating another walled garden where publications depend on a central service.

## Decision

OpenDraft should make decentralized scholarly publishing easier without making OpenDraft itself a dependency for reading, storing, validating, or discovering publications.

A compliant publication remains useful with:
- Git
- RDF tooling
- SHACL tooling
- A web browser
- Standard HTTP
- Ordinary static hosting

OpenDraft is a convenience layer and reference implementation, not the authority upon which the publication system depends.

## Consequences

- Publications are independently verifiable.
- No central server required for reading or validation.
- Protocol artifacts must be self-contained.
- OpenDraft can be replaced without losing publications.

## References

- PROPOSAL.md §1, §37
