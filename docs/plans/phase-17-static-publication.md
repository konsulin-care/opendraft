# Phase 17 — Static Publication

**Summary:** Publishes HTML and TTL as static resources with full provenance metadata, making publications readable and verifiable without OpenDraft infrastructure.

---

## OD-170 — Publish HTML

### Atomic Instruction

Deploy Quarto-generated HTML as a static site.

### Definition of Done

- [ ] Publication is readable without OpenDraft.

---

## OD-171 — Publish TTL

### Atomic Instruction

Expose `article.ttl` as a static resource.

### Definition of Done

- [ ] The TTL can be retrieved directly over HTTP.

---

## OD-172 — Publish provenance

### Atomic Instruction

Ensure the static publication exposes provenance metadata.

### Definition of Done

- [ ] The article TTL identifies: DOI, repository, manuscript, source commit, protocol version, protocol commit.
