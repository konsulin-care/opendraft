# PROTOCOL.md — OpenDraft Protocol Summary

## Overview

The OpenDraft protocol defines how scientific publications are represented, validated, and discovered using Git and RDF. It is independent of OpenDraft's implementation.

## Core Concepts

- **Identity:** Drafts identified by repo + path; publications by DOI; protocol by commit SHA.
- **Registry:** Static RDF files for discovery. Two types: collection (references registries) and publication (references articles).
- **Publication:** Articles produce HTML and RDF/Turtle. RDF contains full provenance.

## Artifacts

| File | Purpose |
|------|---------|
| opendraft.ttl | Core RDF vocabulary |
| article.shacl.ttl | Article validation shapes |
| registry.shacl.ttl | Registry validation shapes |
| registry.ttl | Registry vocabulary |

## Versioning

- Protocol version = full Git commit SHA.
- No mutable refs (tags, branches) as identifiers.
- Publications record protocol commit for reproducibility.

## Validation

- SHACL shapes validate article and registry structure.
- Conformance tests ensure compliance.
- Publications must validate before DOI assignment.

## References

- [docs/ADR/003-identity-model.md](../ADR/003-identity-model.md)
- [docs/ADR/007-protocol-artifacts.md](../ADR/007-protocol-artifacts.md)
- [docs/ADR/008-publication-rdf.md](../ADR/008-publication-rdf.md)
- [docs/ADR/009-registry-and-discovery.md](../ADR/009-registry-and-discovery.md)
