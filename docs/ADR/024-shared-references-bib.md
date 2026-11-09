# ADR 024: Shared references.bib

**Status:** Accepted  
**Date:** 2026-09-10  
**Supersedes:** ADR-004 (in part — the per-manuscript `references.bib`)

## Context

ADR-004 placed a `references.bib` inside every manuscript directory. Manuscripts in one repository often cite the same sources, so per-manuscript bibliographies duplicate entries and drift apart.

## Decision

- One bibliography lives at `manuscripts/references.bib`, shared by all manuscripts.
- Each `article.qmd` declares it in front matter:

```yaml
---
bibliography: ../references.bib
---
```

- The app derives the path as `dirname(manuscriptDir)/references.bib`.
- `references.bib` is no longer a required per-manuscript file.

```text
manuscripts/
├── references.bib
└── <id>/
    ├── article.qmd
    ├── _author.yml
    ├── _abstract.yml
    └── _frontmatter.yml
```

## Migration

None. The project is pre-release, so no existing workspaces need conversion.

## Consequences

- Cross-referenced sources are stored once.
- Citation keys are shared across manuscripts and must be unique repo-wide.
- Validators stop requiring `references.bib` per manuscript.

## References

- ADR-004: Manuscript Structure & Metadata (superseded in part)
- ADR-019: Block-Based Manuscript Editing
