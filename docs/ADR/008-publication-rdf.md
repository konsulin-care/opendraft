# ADR 008: Publication RDF

**Status:** Accepted  
**Date:** 2024-01-01  
**PROPOSAL.md:** §14  
**Superseded in part by:** [ADR-018](018-flat-provenance-model.md)  

> **Supersedure note (2026-08-31):** ADR-018 replaces the reified-node provenance model with flat scalars on `od:Publication`. The clauses below describing reified `sourceRepository`/source-revision/protocol-revision nodes, the `od:SourceRepository`, `od:SourceRevision`, `od:ProtocolRevision` classes, and `od:revisionSha` are superseded. The required/optional field lists and provenance intent remain in effect.

## Context

Published articles need semantic representation with full provenance.

## Decision

Every published article produces `article.ttl` containing:

### Required Fields
- Publication identifier
- DOI
- Manuscript reference
- Source repository
- Manuscript path
- Source Git commit
- Protocol revision
- Title
- Authors
- Abstract

### Optional Fields
- Subjects/keywords
- References

### Provenance
RDF must provide sufficient provenance to reconstruct which source and protocol produced the publication.

## Consequences

- Publications are queryable via RDF.
- Full traceability to source.
- Independently verifiable without OpenDraft.
- Supports citation network traversal.

## References

- PROPOSAL.md §14
