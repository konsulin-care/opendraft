# PROTOCOL.md — OpenDraft Protocol Summary

## Overview

The OpenDraft protocol defines how scientific publications are represented, validated, and discovered using Git and RDF. It is independent of OpenDraft's implementation.

## Core Concepts

- **Identity:** Drafts identified by repo + path; publications by DOI; protocol by commit SHA.
- **Registry:** Static RDF files for discovery. Two types: collection (references registries) and publication (references articles).
- **Publication:** Articles produce HTML and RDF/Turtle. RDF contains full provenance as flat scalars on `od:Publication` (ADR-018): `od:repositoryUrl`, `od:sourceRevision`, `od:protocolRevision`.
- **SPAR/OCDM alignment (ADR-021):** the vocabulary reuses standard IRIs instead of custom terms — reference-only prefixes (no `owl:imports`) for FaBiO, FRBR, PRO, SCoRO, OCO, PRISM, FRAPO, CiTO, DataCite, Literal, and NISO CRediT. `od:Publication` is an `rdfs:subClassOf fabio:Expression`: one published version with a version DOI.
- **Authorship:** OCDM direction — `<pub> pro:isDocumentContextFor` role nodes, `role pro:isHeldBy` agent, `pro:withRole` restricted to PRO/SCoRO authorship roles plus the 14 CRediT IRIs, author order as an `oco:hasNext` chain following `_author.yml` order. Affiliations are `scoro:affiliate` roles pointing at named organizations; shortcut `dcterms:creator` triples are always emitted. Authorship facts are per-document roles (ADR-005, amended).
- **Work vs Expression (ADR-021):** the manuscript is one `fabio:Work` with a concept DOI; each publish is one `od:Publication` with a version DOI, exactly one `frbr:realizationOf` the Work, and at most one `frbr:revisionOf` the previous version. Work and Expression never share a DOI. Citations (`cito:cites`) target version DOIs.
- **Publish identity (ADR-021):** `opendraft.yml` registers a top-level `repository` plus per-manuscript `concept-doi` and `concept-doi-repository`, written once at first publish. Publishing from a different normalized repository URL is blocked (`repository-mismatch`) unless the Work is forked per the rule in ADR-021.

## Artifacts

| File | Purpose |
|------|---------|
| opendraft.ttl | Core RDF vocabulary |
| article.shacl.ttl | Article validation shapes (SHACL Core, one publication per graph) |
| registry.shacl.ttl | Registry validation shapes |
| registry.ttl | Example collection registry (see protocol/README.md) |
| protocol.manifest.json | Pinned revision + artifact SHA-256 digests |
| examples/article.ttl | Example publication (Work, versions, OCDM authorship) |
| examples/publication-registry.ttl | Example publication registry |

## Versioning

- Protocol version = full Git commit SHA.
- No mutable refs (tags, branches) as identifiers.
- Publications record protocol commit for reproducibility.
- The manifest pins the last TTL-touching commit and per-artifact SHA-256 digests; regenerate it with `mise run update-protocol-manifest` (requires a clean protocol TTL tree) after TTL commits, verify with `mise run verify-protocol`.
- Revision model, commit-derivation rule, and artifact URI conventions: [protocol/versioning.md](../../protocol/versioning.md).
- Canonical repository: `https://github.com/konsulin-care/opendraft`.

## Validation

- SHACL shapes validate article and registry structure (SHACL Core only).
- Conformance tests ensure compliance (`tests/conformance/`).
- Publications must validate before DOI assignment.

## References

- [docs/ADR/003-identity-model.md](../ADR/003-identity-model.md)
- [docs/ADR/005-authorship-model.md](../ADR/005-authorship-model.md)
- [docs/ADR/007-protocol-artifacts.md](../ADR/007-protocol-artifacts.md)
- [docs/ADR/008-publication-rdf.md](../ADR/008-publication-rdf.md)
- [docs/ADR/009-registry-and-discovery.md](../ADR/009-registry-and-discovery.md)
- [docs/ADR/018-flat-provenance-model.md](../ADR/018-flat-provenance-model.md)
- [docs/ADR/021-spar-ocdm-publication-metadata.md](../ADR/021-spar-ocdm-publication-metadata.md)
