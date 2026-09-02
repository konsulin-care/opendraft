# CONVENTION.md — Manuscript & Metadata Conventions

**Audience:** Human developers and AI agents.

This document defines the manuscript directory structure, identifier rules, and metadata file responsibilities. The machine-readable validators live in `packages/schema`.

---

## Manuscript Directory Structure

Each manuscript is a directory under `manuscripts/<id>/`:

```text
manuscripts/<id>/
├── article.qmd
├── _author.yml
├── _abstract.yml
├── _frontmatter.yml
└── references.bib
```

### Required Files

| File | Purpose |
|------|---------|
| `article.qmd` | Quarto Markdown source |
| `_author.yml` | Author information |
| `_abstract.yml` | Abstract text |
| `_frontmatter.yml` | Title, date, keywords |
| `references.bib` | BibTeX references |

### Optional Files

Any additional files (datasets, figures, supplementary materials) are allowed. The validator only checks for the required files.

---

## Manuscript Identifiers

Identifiers must match the pattern `^[a-z0-9]+(-[a-z0-9]+)*$`:

- Lowercase letters (`a-z`) and digits (`0-9`) only.
- Hyphens allowed between segments.
- No uppercase, underscores, spaces, or special characters.
- No leading or trailing hyphens.
- Must be non-empty.

**Valid:** `my-article`, `resilience-study-2024`, `article1`

**Invalid:** `My-Article`, `my_article`, `-article`, `article-`, `Article 1`

---

## Relationship to `opendraft.yml`

The root `opendraft.yml` file lists manuscripts by `id` and `path`:

```yaml
manuscripts:
  - id: my-article
    path: manuscripts/my-article
```

- `id` must match the directory name.
- `path` is the relative path from the repository root.

See [SCHEMA.md](./SCHEMA.md) for the full `opendraft.yml` specification.

---

## Metadata File Responsibilities

Each metadata file has a single responsibility. No field is duplicated across files.

### `_author.yml`

Owns: author information.

```yaml
authors:
  - name: Jane Doe
    orcid: "0000-0001-2345-6789"
    affiliations:
      - name: University Example
```

Fields:
- `authors` (required): Array of author objects.
- Each author must have `name` (required).
- Optional: `orcid` (pattern: `^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$`), `affiliations` (array of `{name}`).

### `_abstract.yml`

Owns: abstract text.

```yaml
abstract: |
  This paper presents...
```

Fields:
- `abstract` (required): String containing the abstract.

### `_frontmatter.yml`

Owns: title, date, keywords.

```yaml
title: "Article Title"
date: 2024-01-15
keywords:
  - resilience
  - disaster recovery
```

Fields:
- `title` (required): String containing the article title.
- Optional: `date` (string), `keywords` (array of strings).

---

## Quarto Integration

The `article.qmd` file references metadata via the `metadata-files` directive:

```markdown
---
metadata-files:
  - _author.yml
  - _abstract.yml
  - _frontmatter.yml
---
```

This tells Quarto to merge the YAML files into the document metadata at render time.

---

## Validation

The conventions are enforced by `@opendraft/schema` (`packages/schema`):

- `validateManuscript(id, files)` validates directory structure and identifier.
- `validateMetadata(data, type)` validates parsed YAML against the corresponding schema.
- The pre-push hook (`mise run validate-project`) runs these validators.
- The client app imports the same validators to check manuscript compliance.
