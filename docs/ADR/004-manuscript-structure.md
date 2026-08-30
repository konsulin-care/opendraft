# ADR 004: Manuscript Structure & Metadata

**Status:** Accepted  
**Date:** 2024-01-01  
**PROPOSAL.md:** §4.2, §5, §6, §7

## Context

Manuscripts need structured metadata while remaining interoperable with Quarto and other tooling.

## Decision

### Directory Structure
Each manuscript is a directory under `manuscripts/<id>/`:

```text
manuscripts/<id>/
├── article.qmd
├── _author.yml
├── _abstract.yml
├── _frontmatter.yml
└── references.bib
```

### Metadata Separation
Metadata is split into focused YAML files:
- `_author.yml` — author information
- `_abstract.yml` — abstract text
- `_frontmatter.yml` — title, keywords, dates
- `_other.yml` — funding, acknowledgments, etc.

### Repository Integration
`opendraft.yml` at repo root declares protocol version and manuscript paths.

## Consequences

- Metadata is maintainable and diffable.
- Quarto-compatible via `metadata-files` directive.
- OpenDraft UI manages YAML forms.
- One repo can contain multiple manuscripts.

## References

- PROPOSAL.md §4.2, §5, §6, §7
