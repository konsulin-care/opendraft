# Phase 4 — Quarto Integration

**Summary:** Connects manuscript content to Quarto rendering, defines the author metadata model, and builds the compiler pipeline that normalizes YAML metadata and ingests BibTeX references.

---

## OD-040 — Build minimal Quarto manuscript

### Atomic Instruction

Create a manuscript using `metadata-files` to include `_author.yml`, `_abstract.yml`, and `_frontmatter.yml`.

### Definition of Done

- [ ] Quarto successfully renders the manuscript.

---

## OD-041 — Implement author metadata model

### Atomic Instruction

Define the OpenDraft author structure.

### Definition of Done

- [ ] Model supports name.
- [ ] Model supports affiliation.
- [ ] Model supports ORCID.
- [ ] Model supports corresponding-author designation.
- [ ] Model supports optional CRediT roles.

---

## OD-042 — Implement metadata compiler

### Atomic Instruction

Convert YAML metadata into normalized publication metadata.

### Definition of Done

- [ ] Compiler produces deterministic output from identical source files.

---

## OD-043 — Implement BibTeX ingestion

### Atomic Instruction

Read `references.bib` and expose its references to the semantic compiler.

### Definition of Done

- [ ] Valid BibTeX parses.
- [ ] DOI is retained where present.
- [ ] Citation keys are retained.
- [ ] Invalid BibTeX produces a useful error.
