# Phase 12 — Semantic Compiler

**Summary:** Builds the RDF compilation pipeline that transforms manuscript source into deterministic, protocol-conforming `article.ttl` with embedded provenance.

---

## OD-120 — Implement article RDF compiler

### Atomic Instruction

Compile manuscript source into `article.ttl`.

### Definition of Done

- [ ] Compiler represents at minimum: publication, DOI (when available), title, authors, abstract, subjects, keywords, references, repository, manuscript path, source commit, protocol revision.

---

## OD-121 — Ensure deterministic RDF

### Atomic Instruction

Make RDF generation deterministic.

### Definition of Done

- [ ] Identical source and build inputs produce equivalent deterministic output.

---

## OD-122 — Record source commit

### Atomic Instruction

Inject the exact source Git commit into `article.ttl`.

### Definition of Done

- [ ] Published TTL identifies the exact source revision.
- [ ] No mutable branch name is used as the immutable source identity.

---

## OD-123 — Record protocol commit

### Atomic Instruction

Inject the pinned OpenDraft protocol commit into `article.ttl`.

### Definition of Done

- [ ] Published TTL identifies the exact OpenDraft protocol revision used during compilation.

---

## OD-124 — Validate generated article RDF

### Atomic Instruction

Run article SHACL validation after RDF compilation.

### Definition of Done

- [ ] Publication fails if generated RDF violates the protocol.
