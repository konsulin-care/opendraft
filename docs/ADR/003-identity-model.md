# ADR 003: Identity Model

**Status:** Accepted  
**Date:** 2024-01-01  
**PROPOSAL.md:** §4.1–4.5

## Context

OpenDraft needs to identify drafts, publications, and the protocol itself. Identity must support versioning and immutability.

## Decision

Three identity layers:

### Draft Identity
- Identified by repository + manuscript path.
- Immutable state identified by Git commit SHA.

### Publication Identity
- Each version identified by DOI.
- Retains provenance to source repo, path, commit, protocol revision.

### Protocol Identity
- Identified by full Git commit SHA of OpenDraft repository.
- No mutable refs (tags, branches) as identifiers.

## Consequences

- Full reproducibility: any publication traces to exact source.
- Versioned citation network via DOIs.
- Protocol changes are traceable to specific commits.
- No ambiguity in which version produced a publication.

## References

- PROPOSAL.md §4
