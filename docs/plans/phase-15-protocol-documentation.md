# Phase 15 — Protocol Documentation

**Summary:** Creates the protocol manuscript as a self-hosted OpenDraft project, proving the protocol can document and publish itself consistently.

---

## OD-150 — Create protocol manuscript

### Atomic Instruction

Create `manuscripts/distributed-scientific-publication/` with a complete OpenDraft manuscript.

### Definition of Done

- [ ] It contains `article.qmd`, `_author.yml`, `_abstract.yml`, `_frontmatter.yml`, `references.bib`.
- [ ] It explains the OpenDraft protocol.

---

## OD-151 — Publish protocol manuscript using OpenDraft

### Atomic Instruction

Use OpenDraft's own publication pipeline to compile the protocol manuscript.

### Definition of Done

- [ ] The OpenDraft repository can generate `article.html` and `article.ttl` for its own protocol manuscript.

---

## OD-152 — Ensure protocol documentation is self-consistent

### Atomic Instruction

Ensure the protocol manuscript describes the same protocol represented by `protocol/opendraft.ttl`.

### Definition of Done

- [ ] Terminology is consistent.
- [ ] RDF vocabulary names are consistent.
- [ ] Registry semantics are consistent.
- [ ] Identity model is consistent.
- [ ] Versioning model is consistent.
