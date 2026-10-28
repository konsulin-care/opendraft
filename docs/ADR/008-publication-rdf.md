# ADR 008: Publication RDF

**Status:** Accepted  
**Date:** 2024-01-01  
**PROPOSAL.md:** §14  
**Superseded in part by:** [ADR-018](018-flat-provenance-model.md)  
**Superseded in part by:** [ADR-021](021-spar-ocdm-publication-metadata.md)  

> **Supersedure note (2026-08-31):** ADR-018 replaces the reified-node provenance model with flat scalars on `od:Publication`. The clauses below describing reified `sourceRepository`/source-revision/protocol-revision nodes, the `od:SourceRepository`, `od:SourceRevision`, `od:ProtocolRevision` classes, and `od:revisionSha` are superseded. The required/optional field lists and provenance intent remain in effect.
>
> **Supersedure note (2026-10-21):** ADR-021 replaces the custom-term representation of the field lists below with SPAR/OCDM vocabulary: subjects as `fabio:hasSubjectTerm`, corresponding authorship as a `scoro:corresponding-author` role, CRediT roles as `pro:withRole` on authorship roles using the NISO `credit:*` IRIs, and one `od:Publication` (a `fabio:Expression`) per published version instead of a separate publication-version class. The field lists and provenance intent remain in effect; see ADR-021 for the full mapping.

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
- [ADR-018](018-flat-provenance-model.md) — superseded in part (provenance model)
- [ADR-021](021-spar-ocdm-publication-metadata.md) — superseded in part (subject, authorship, and CRediT representation)
