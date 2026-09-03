# ADR 020: Milkdown Editor Adoption

**Status:** Accepted  
**Date:** 2026-09-04  
**Supersedes:** ADR-019 (editor model and assembly authorship in part)

## Context

The TipTap-based block editor (ADR-019) stored block content as HTML strings
written directly into `.qmd` files, with a JSON `blocks/manifest.json` as the
canonical order source and `article.qmd` as a derived artifact. Three problems
motivate a change:

1. **Format drift** — the web app saved raw HTML into `.qmd` files while the
   persistence layer wrote Markdown; the content round-trip was never canonical.
2. **Assembly displacement** — authors' native idiom is a file listing
   `{{< include >}}` shortcodes, but the app replaced that with JSON plus a
   computed file, so hand-editing git-tracked manuscripts clashed with the app.
3. **Preservation risk** — a WYSIWYG editor over an HTML-native model threatens
   byte fidelity of Quarto syntax (callouts, shortcodes, divs, math).

## Decision

Adopt **Milkdown/Crepe** as the editor foundation and make the **assembly
authored**:

### Editor Foundation

- `@milkdown/crepe@7.22.1` + `@milkdown/kit@7.22.1` replace `@tiptap/*`.
- The editor hosts a **continuous whole-manuscript surface**: all sections in
  one page, edit in place, no tab-per-block.
- Crepe is markdown-native: the editor reads and emits Markdown through the
  unified/remark pipeline, so block files and the assembly stay canonical.
- Custom Quarto constructs (callouts, fenced divs, block/inline shortcodes)
  are **verbatim nodes** (`quartoBlock`, `quartoInline`) captured before
  parsing and emitted byte-for-byte.
- Feature set: TopBar, BlockEdit, CodeMirror code, LaTeX, Placeholder enabled;
  AI disabled. CodeMirror/LaTeX and float-dependent features are gated off
  under the vitest test environment (jsdom).

### Document Model

- The prosemirror document (sync layer in `@opendraft/editor`) is a
  `section`-wrapped tree: top level restricts to `section | include | glue |
  quartoBlock`; sections carry `attrs.id` (slug) and `attrs.draft`.
- `article.qmd` is the **authored assembly**: front matter + glue + include
  shortcodes + references trailer. It supersedes ADR-019's "derived — do not
  edit" rule. The git/CI pipeline validates it directly.
- Files: one `blocks/<slug>.qmd` per section. `blocks/manifest.json` is
  retired; `validateManifest` is kept only for legacy layouts.

### Identity and Drafts

- Identity = section `attrs.id`, seeded from the `{#slug}` heading attribute,
  defaulting to a generated uid. Renames are explicit and uniqueness-enforced.
- A **draft** is a block file present on disk but not referenced by an include.
  Drafts render continuously (flagged in the block rail), are written to
  `blocks/`, and are excluded from the assembly. The assembly validator
  reports orphans as warnings so drafts never block a commit.

### Sync and Compile Pipeline

- `serializeManuscript`/`parseManuscript` split documents into per-slug block
  files plus the include assembly; `loadManuscript`/`saveManuscript` bridge
  the workspace adapter (IndexedDB).
- `validateAssembly` (packages/schema) checks file↔include consistency;
  `compileAssembly` (packages/metadata) is the pass-through formatter;
  `preCommitAssembly` (packages/git) stages and validates `article.qmd` +
  `blocks/`.
- Legacy flat manuscripts still migrate via `migrateToBlockLayout`.

## Consequences

- Block files are canonical Markdown everywhere; HTML lives only inside the
  editor.
- Hand-edited `article.qmd` and block files round-trip through the app via
  the import path; remark may normalize formatting on save (canonical diffs
  accepted).
- Drafts are first-class; orphan files no longer fail validation.
- Crepe bundles Vue for its floating UI; acceptable, editing stays
  config-driven.
- ADR-019's manifest/derived-assembly model is superseded for new manuscripts.

## References

- ADR-019: Block-Based Manuscript Editing (superseded in part)
- Milkdown/Crepe docs and source (verified for CLI classes, parser/serializer
  pipeline, extension pattern)