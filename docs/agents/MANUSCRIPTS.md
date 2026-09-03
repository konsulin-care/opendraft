# MANUSCRIPTS.md — Quarto, YAML, BibTeX

## Quarto Markdown (.qmd)

Manuscript source is Quarto Markdown. Two layouts are supported:

### Legacy Layout

```markdown
---
metadata-files:
  - _author.yml
  - _abstract.yml
  - _frontmatter.yml
---

# Introduction

This study examines...
```

### Block-Based Layout

`article.qmd` is the **authored assembly** (front matter + glue + includes):

```markdown
---
metadata-files:
  - _author.yml
  - _abstract.yml
  - _frontmatter.yml
---

{{< include blocks/intro.qmd >}}

Some glue prose between includes.

{{< include blocks/methods.qmd >}}

# References

::: {#refs}
:::
```

Each block file (`blocks/<slug>.qmd`) contains one section with a stable
slug id on its heading:

```markdown
# Introduction {#intro}

This study examines...
```

### Assembly Order

Order is defined by the include shortcodes in `article.qmd` — there is no
JSON manifest. A block present in `blocks/` but not included is a **draft**:
it renders flagged in the editor rail, stays out of the assembly, and is
reported as a warning (never an error) by the assembly validator.

- `id`: first 8 characters of SHA-256 of block content.
- `file`: always `<id>.qmd`.
- Array order = canonical section order.

## Metadata Files

### _author.yml

```yaml
authors:
  - name: Jane Doe
    orcid: 0000-0001-2345-6789
    affiliations:
      - name: University Example
```

### _abstract.yml

```yaml
abstract: |
  This paper presents...
```

### _frontmatter.yml

```yaml
title: "Article Title"
date: 2024-01-15
keywords:
  - resilience
  - disaster recovery
```

## BibTeX (references.bib)

```bibtex
@article{doe2024,
  title = {Example Article},
  author = {Doe, Jane},
  journal = {Journal of Examples},
  year = {2024},
  volume = {1},
  pages = {1--10}
}
```

## Citation Syntax

```markdown
As shown by @doe2024, the results indicate...
Recent work [@doe2024; @smith2023] confirms...
```

## OpenDraft Conventions

- Metadata files are prefixed with `_`.
- OpenDraft UI manages YAML forms.
- Users should not construct complex YAML manually.
- See ADR-004 for legacy layout rationale.
- See ADR-019 for block-based layout rationale.
