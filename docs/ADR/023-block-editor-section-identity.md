# ADR 023: Block Editor Section Identity

**Status:** Accepted  
**Date:** 2026-09-16  
**Amends:** ADR-020 (editor model, in part)

## Context

ADR-020 made `article.qmd` the authored assembly with one `blocks/<slug>.qmd`
file per section, but left section identity implicit: ULID filenames carried no
semantic meaning, and nothing tied a block's file name to its Quarto
cross-reference anchor. The block editor (one collapsible Milkdown container
per section) needs a stable, human-readable identity that works as a filename,
a cross-reference target, and (later) an RDF section node.

## Decision

### Short Name

Every section has a **short name**: the normalized section title — Unicode
NFKD, accents stripped, lowercased, runs of non-alphanumerics collapsed to a
single hyphen, trimmed, **capped at 40 characters**. An empty result falls
back to `section`. When the candidate is already taken, a `-` plus the last
6 characters of a lowercase ULID is appended (the title part is truncated so
the total stays within 40); a collision on the suffixed name regenerates the
suffix.

The short name is:

- the block filename: `blocks/<short>.qmd`
- the Quarto cross-reference anchor seed: `# Title {#sec-<short>}` — referenced
  as `@sec-<short>` (Quarto's `sec-` prefix requirement)
- the DEO class carrier: `{#sec-<short> .deo-<type>}`, or `.doco-section` for
  generic sections

### Identity Stability

Identity is created once and does not drift:

- Changing the **title never changes the short name** — cross-references and
  git history stay stable.
- Changing the **short name is an explicit action**: it renames the file,
  updates the include line in `article.qmd`, and rewrites every `@sec-old`
  reference across the block files, after a confirmation listing the affected
  references.

### Header Owns the Heading

Each block file's first line is the canonical heading
`# Title {#sec-<short> .deo-<type>}`. The block editor strips it from the
editor body, renders it as the container header (H1), and re-emits it on save.
Users cannot delete the heading or add a second H1 inside a block; H2 and
deeper headings remain free in the body.

### Section Type

The DEO rhetorical type (Introduction, Methods, Results, Discussion,
Conclusion) is selected in the add-block form and stored as the heading class
`.deo-<type>`; generic sections use `.doco-section`. The type is changeable
later from the block menu.

### Assembly Validation

`validateAssembly` (packages/schema) rejects an included block whose heading
anchor does not equal `sec-<file stem>`, keeping filename, anchor, and
cross-reference in lockstep. Blocks with no heading line (legacy files) are
accepted without an anchor error.

## Consequences

- Cross-references (`@sec-introduction`) survive title edits and block moves.
- Renames are loud (confirmation + reference rewrite) rather than silent.
- The 40-character cap keeps refs readable; the 6-char ULID suffix keeps
  duplicates unique without bloat.
- Short names are user-visible API — treat them like route slugs: stable once
  published.
- RDF export can map `deo-<type>` classes to DEO rhetorical roles directly.

## References

- ADR-019: Block-Based Manuscript Editing (block-per-section model)
- ADR-020: Milkdown Editor Adoption (superseded in part by this ADR)
- Quarto cross-references: `sec-` prefix requirement
- DEO (Document EntityType Ontology) rhetorical types; DoCO `doco:Section`
