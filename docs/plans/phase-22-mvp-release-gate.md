# Phase 22 — MVP Release Gate

**Summary:** Freezes the first protocol and application release candidates, verifying self-hosting and decentralization before the MVP is declared complete.

---

## OD-220 — Protocol release candidate

### Atomic Instruction

Freeze the first protocol version.

### Definition of Done

- [ ] All protocol tests pass.
- [ ] Protocol artifacts are immutable at a known commit.

---

## OD-221 — OpenDraft release candidate

### Atomic Instruction

Freeze the first OpenDraft MVP.

### Definition of Done

- [ ] All critical end-to-end workflows pass.

---

## OD-222 — Self-hosting verification

### Atomic Instruction

Verify that OpenDraft's own protocol manuscript is itself processed by OpenDraft.

### Definition of Done

- [ ] The OpenDraft repository successfully publishes its own protocol documentation as HTML and TTL.

---

## OD-223 — Decentralization verification

### Atomic Instruction

Test publication consumption without the OpenDraft application or BFF.

### Definition of Done

- [ ] A user can retrieve and understand a publication using browser, HTTP, RDF parser, and SHACL validator.
- [ ] No OpenDraft server is required.
