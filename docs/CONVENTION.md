# CONVENTION.md — Manuscript & Metadata Conventions

**Audience:** Human developers and AI agents.

This document defines the manuscript directory structure, identifier rules, and metadata file responsibilities. The machine-readable validators live in `packages/schema`.

---

## Manuscript Directory Structure

Each manuscript is a directory under `manuscripts/<id>/`. Two layouts are supported:

### Legacy Layout

```text
manuscripts/
├── references.bib            # shared by all manuscripts (ADR-024)
└── <id>/
    ├── article.qmd
    ├── _author.yml
    ├── _abstract.yml
    └── _frontmatter.yml
```

### Block-Based Layout

```text
manuscripts/
├── references.bib            # shared by all manuscripts (ADR-024)
└── <id>/
    ├── article.qmd
    ├── _author.yml
    ├── _abstract.yml
    ├── _frontmatter.yml
    └── blocks/
        └── _<short>.qmd      # one file per block (ADR-025)
```

**Bibliography:** `manuscripts/references.bib` is shared. Each `article.qmd` sets `bibliography: ../references.bib`.

**Detection:** Presence of `blocks/` with `_<short>.qmd` files signals block-based layout. Order comes from include lines in `article.qmd`; there is no `manifest.json`.

**Migration:** Use `migrateToBlockLayout()` to convert legacy layout to block-based.

### Required Files

| File | Legacy | Block-Based | Purpose |
|------|--------|-------------|---------|
| `article.qmd` | Required | Derived | Quarto Markdown source |
| `_author.yml` | Required | Required | Author information |
| `_abstract.yml` | Required | Required | Abstract text |
| `_frontmatter.yml` | Required | Required | Title, date, keywords |
| `blocks/_<short>.qmd` | — | Required | Section-per-block files |

### Optional Files

Any additional files (datasets, figures, supplementary materials) are allowed. The validator only checks for the required files.

---

## Project Initialization and Discovery

Project initialization discovers existing manuscripts in `manuscripts/` instead
of assuming a fresh project. Discovery is read-only; it never edits user files.
The shared implementation lives in `@opendraft/manuscript` and is used by both
`opendraft init` and the web conversion flow.

### Configuration State

- **missing:** no `opendraft.yml`. Scan the immediate subfolders of `manuscripts/`
  (files directly under `manuscripts/`, such as `references.bib`, are not
  candidates) and classify each folder.
- **valid:** `opendraft.yml` parses and passes `validateOpendraft`. Report folders
  under `manuscripts/*/` that the config does not list as **unlisted** and add
  them only on confirmation.
- **invalid:** `opendraft.yml` fails to parse or validate. Stop and report the
  errors; never rewrite the file.

### Candidate Classification

Each candidate folder is classified as `valid`, `repairable` or `rejected`.

**Rejected** when any of the following holds:

- `missing-article` — the folder has no `article.qmd`.
- `invalid-id` — the folder name fails `MANUSCRIPT_ID_PATTERN`
  (`^[a-z0-9]+(-[a-z0-9]+)*$`). A `suggestedId` from `normalizeManuscriptId(name)`
  is reported, but the folder is never renamed.
- `missing-include` — an `{{< include X >}}` shortcode in `article.qmd` targets a
  file that does not exist relative to the folder.

**Repairable** when any of `_author.yml`, `_abstract.yml`, `_frontmatter.yml` is
missing. Those files are created from the shared starter templates and listed in
`missingFiles`.

**Valid** otherwise. Layout is `block` when `blocks/_*.qmd` exists, otherwise
`legacy`. Extra files and folders (for example `supplementaries/`, `data`) are
ignored.

### Warnings

Warnings are reported but the candidate is still registered; user files are
never edited. Two warnings exist:

- `bibliography-mismatch` — `article.qmd` front matter `bibliography` is not
  `../references.bib`.
- `metadata-files-mismatch` — `article.qmd` front matter `metadata-files` does
  not list all three metadata files.

### Plans

Plans only create files. The single permitted update is `opendraft.yml` when it
already exists and is valid: entries are appended while the protocol block and
all existing entries are preserved. `manuscripts/references.bib` is created only
when absent. When no registrable candidate exists, the supplied project name is
normalized to a manuscript id and `manuscripts/<id>/` is scaffolded.

### CLI Flags

`opendraft init` accepts:

- `--manuscript <id>` — register only the named candidate (repeatable).
- `--yes` — accept defaults non-interactively (register all registrable
  candidates, create `manuscripts/references.bib`, add no unlisted folders).
- `--dry-run` — print the plan without writing anything.

In non-interactive mode without `--yes`, the command exits with code `2` when a
confirmation would be required, so scripts can detect that input is needed.

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
- Legacy un-prefixed block files are errors (normalize with `opendraft block normalize`).
- The pre-push hook (`mise run validate-project`) runs these validators.
- The client app imports the same validators to check manuscript compliance.
