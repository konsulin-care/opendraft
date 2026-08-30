# ADR 007: Protocol Artifacts & Versioning

**Status:** Accepted  
**Date:** 2024-01-01  
**PROPOSAL.md:** §15, §16

## Context

The protocol needs to be distributed, versioned, and independently verifiable.

## Decision

### Format
Protocol represented as RDF/Turtle:
- `opendraft.ttl` — core vocabulary
- `article.shacl.ttl` — article validation
- `registry.shacl.ttl` — registry validation
- `registry.ttl` — registry vocabulary

### Versioning
- Protocol version = full Git commit SHA.
- No mutable refs (tags, branches) as identifiers.
- Artifact path is stable: `protocol/opendraft.ttl`.

### Self-Documentation
- Protocol rationale in `manuscripts/distributed-scientific-publication/`.
- Machine-readable definitions in TTL.
- Human-readable explanations in manuscript.

## Consequences

- Independently verifiable via raw GitHub URL.
- Immutable references across time.
- Protocol and documentation evolve together.
- No dependency on OpenDraft application.

## References

- PROPOSAL.md §15, §16
