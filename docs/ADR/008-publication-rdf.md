# ADR 008: Publication RDF

**Status:** Accepted  
**Date:** 2024-01-01  
**PROPOSAL.md:** §14

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
