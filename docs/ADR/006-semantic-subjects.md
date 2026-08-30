# ADR 006: Semantic Subjects

**Status:** Accepted  
**Date:** 2024-01-01  
**PROPOSAL.md:** §10

## Context

Publications need discoverable subjects. Both authors and human indexers may assign subjects, with different provenance.

## Decision

- Subjects represented using **SKOS concepts**.
- Two provenance categories:
  - `author-declared subject` — assigned by author
  - `indexer-assigned subject` — assigned by human indexer
- Source of each assignment must be distinguishable.
- MVP does not require machine-generated annotation.

## Consequences

- Machine-readable discovery via RDF.
- Human flexibility in subject assignment.
- Provenance tracking for trust and verification.
- Extensible to future machine annotation.

## References

- PROPOSAL.md §10
