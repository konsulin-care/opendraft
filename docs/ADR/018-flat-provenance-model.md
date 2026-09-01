# ADR 018: Flat Provenance Model

**Status:** Accepted  
**Date:** 2026-08-31  
**Supersedes (in part):** [ADR-008](008-publication-rdf.md) — the reified `sourceRepository`/`SourceRevision`/`ProtocolRevision` node model

## Context

ADR-008 required publications to record full provenance: source repository, source Git commit, and protocol revision. Phase 00 modeled these as reified blank nodes (`od:sourceRevision` / `od:protocolRevision` linked to `od:SourceRevision` / `od:ProtocolRevision` classes carrying an `od:revisionSha` literal), with `od:repositoryUrl` defined on a separate `od:SourceRepository` class.

Experience with the Phase 00 fixtures exposed two problems:

1. **Wrapper-class smell.** `od:SourceRepository`, `od:SourceRevision`, and `od:ProtocolRevision` existed only to carry a single scalar (`repositoryUrl` or `revisionSha`). Consumers had to traverse an extra node hop for zero added information.
2. **Fixture drift.** The example placed `od:repositoryUrl` directly on `od:Publication` even though the ontology declared its domain as `od:SourceRepository` — a model violation that had to be worked around at validation time.

The MVP scope (ADR-016) defers the centralized search, advanced citation graphs, and SPARQL joins that would justify node-based repository identity. Fork lineage and shared repository identity can be added later as new terms; the vocabulary is append-only.

## Decision

Model all provenance as flat scalars directly on `od:Publication`:

| Property | Type | Range | Cardinality | Purpose |
|----------|------|-------|-------------|---------|
| `od:repositoryUrl` | DatatypeProperty | `xsd:anyURI` | exactly 1 | URL of the Git source repository that produced this publication |
| `od:sourceRevision` | DatatypeProperty | `xsd:string` | exactly 1 | Full 40-character Git commit SHA of the source revision |
| `od:protocolRevision` | DatatypeProperty | `xsd:string` | exactly 1 | Full 40-character Git commit SHA of the OpenDraft protocol revision |

The reified classes and property are **deleted, not deprecated**:

- `od:SourceRepository`
- `od:SourceRevision`
- `od:ProtocolRevision`
- `od:revisionSha`

No `owl:deprecated` annotations are used. Nothing references these terms prior to first release, so removal is safe and keeps the vocabulary honest. The protocol is versioned by Git commit SHA (ADR-007), so this snapshot of `opendraft.ttl` remains retrievable for any publication that pinned it.

SHACL shapes validate the SHA strings with `sh:pattern ^[0-9a-f]{40}$` and the repository URL with `sh:datatype xsd:anyURI`.

## Consequences

- Publications are simpler to author and validate: one node, three scalar provenance properties.
- Consumers reconstruct provenance without traversing blank nodes.
- The vocabulary no longer promises a repository entity that carries no data.
- If shared repository identity or fork lineage is needed later, `od:SourceRepository` can be re-introduced as a real, content-bearing node.

## References

- [ADR-008](008-publication-rdf.md) — superseded in part
- [ADR-007](007-protocol-artifacts.md) — protocol versioning by commit SHA
- [ADR-015](015-protocol-reproducibility.md) — reproducibility chain
- [ADR-016](016-mvp-scope.md) — deferred search/citation-graph features