# ADR 019: Block-Based Manuscript Editing

**Status:** Accepted  
**Date:** 2026-09-02  
**Supersedes:** ADR-004 (in part)

## Context

ADR-004 defined a flat manuscript layout where `article.qmd` is the sole prose source. As the editor matures, authors need to work on individual sections independently — shorter files are easier to navigate, diff, and collaborate on. The block-based model splits `article.qmd` into section-per-file under a `blocks/` directory, while keeping metadata files at the manuscript root.

## Decision

### Directory Structure

Each manuscript is a directory under `manuscripts/<id>/`:

```text
manuscripts/<id>/
├── article.qmd              # derived — do not edit directly
├── _author.yml
├── _abstract.yml
├── _frontmatter.yml
├── references.bib
└── blocks/
    ├── manifest.json         # ordered block list
    └── <slug>.qmd            # one file per block
```

The legacy flat layout (ADR-004) remains valid. Migrate via `migrateToBlockLayout`.

### Block Definition

A **block** is defined by the highest-level heading (H1 first, then H2–H6) that appears at least twice in `article.qmd`. Each occurrence of that heading, and all content until the next same-level heading, is one block. Fallbacks:

1. If no heading appears ≥2 times, the entire content is a single block.
2. Text before the first block heading is preserved as preamble in `article.qmd`.

### Manifest Shape

`blocks/manifest.json`:

```json
{
  "version": "1.0.0",
  "blocks": [
    { "id": "a1b2c3d4", "file": "a1b2c3d4.qmd", "title": "Introduction" }
  ]
}
```

- `version`: semver (`"1.0.0"` for MVP).
- `blocks`: ordered array; array order is canonical section order.
- `id`: first 8 characters of SHA-256 of block content (deterministic, collision-resistant).
- `file`: always `<id>.qmd`.
- `title`: the heading text of the block.

### Slug Derivation

`id` = `sha256(blockContent).slice(0, 8)` — deterministic, no collision handling needed.

### Compile Behavior

`compileArticle(dir)` assembles `article.qmd` from the manifest:

1. Reads `blocks/manifest.json`, validates via `validateManifest`.
2. Emits `metadata-files:` front matter unchanged.
3. One `{{< include blocks/<slug>.qmd >}}` per block in manifest order.
4. Appends `# References` + `::: {#refs}`.

### Integrity Check

`validateBlockStructure(dir, manifest)` checks:

- Every manifest entry has a matching file in `blocks/`.
- No orphan `.qmd` files in `blocks/` (files not in manifest).
- No empty block files.
- All ids are valid slugs (first 8 chars of SHA-256).
- Manifest version is supported.

### Migration

`migrateToBlockLayout(dir)` converts a legacy flat layout:

1. Reads existing `article.qmd`.
2. Splits by highest-level heading with ≥2 occurrences (H1→H6 fallback).
3. Derives slugs via SHA-256.
4. Writes `blocks/<slug>.qmd` files.
5. Writes `blocks/manifest.json`.
6. Rewrites `article.qmd` with preamble + include shortcodes.
7. Runs `validateBlockStructure` before returning.

## Consequences

- Quarto CI is unchanged — `article.qmd` with `{{< include >}}` shortcodes renders identically.
- Legacy flat layout remains valid; migration is explicit via `migrateToBlockLayout`.
- The editor ships in ADR-019-driven phases (see phase-05 plan).
- Block splitting is deterministic — same content always produces the same slugs.
- `article.qmd` becomes a derived file; users edit block files, not the assembly.

> **Note (ADR-020):** The `article.qmd`-is-derived rule and the
> `blocks/manifest.json` order source are superseded for new manuscripts —
> `article.qmd` is now the authored assembly and identity is a stable slug
> (see ADR-020). `migrateToBlockLayout` remains for legacy workspaces.

## References

- ADR-004: Manuscript Structure & Metadata (superseded in part)
- PROPOSAL.md §4.2, §5, §6, §7
