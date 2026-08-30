# Phase 3 — Repository Specification

**Summary:** Formalizes the `opendraft.yml` schema, manuscript directory convention, template structure, and metadata file responsibilities that govern how projects are organized.

---

## OD-030 — Define `opendraft.yml`

### Atomic Instruction

Create the first formal `opendraft.yml` schema.

### Definition of Done

- [ ] Schema defines: `protocol` block (name, version, repository, commit) and `manuscripts` list (id, path).
- [ ] Unknown fields do not cause failure unless explicitly prohibited by the protocol.

---

## OD-031 — Define manuscript directory convention

### Atomic Instruction

Define the `/manuscripts/<id>/` directory convention.

### Definition of Done

- [ ] Specification documents allowed manuscript identifier rules.
- [ ] Specification documents directory requirements.
- [ ] Specification documents required files.
- [ ] Specification documents optional files.
- [ ] Specification documents relationship to `opendraft.yml`.

---

## OD-032 — Create manuscript template

### Atomic Instruction

Create a bootstrap manuscript template.

### Definition of Done

- [ ] Template contains: `article.qmd`, `_author.yml`, `_abstract.yml`, `_frontmatter.yml`, `references.bib`.
- [ ] Template contains a minimal valid Quarto document.

---

## OD-033 — Define metadata file conventions

### Atomic Instruction

Define responsibilities of `_author.yml`, `_abstract.yml`, `_frontmatter.yml`, and `_other.yml`.

### Definition of Done

- [ ] Documentation states what belongs in each file.
- [ ] No field is duplicated unnecessarily across files.
