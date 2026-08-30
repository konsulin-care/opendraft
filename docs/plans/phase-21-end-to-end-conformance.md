# Phase 21 — End-to-End Conformance

**Summary:** Validates complete workflows from manuscript creation through publication, including new projects, existing repos, forks, registry discovery, and independent protocol verification.

---

## OD-210 — New-project end-to-end test

### Atomic Instruction

Test: new local manuscript -> Git -> GitHub repository -> GitHub Action -> article.html -> article.ttl.

### Definition of Done

- [ ] The complete workflow succeeds without manually editing generated artifacts.

---

## OD-211 — Existing-repository end-to-end test

### Atomic Instruction

Test: existing repository -> authorize -> select -> clone -> initialize -> edit -> push.

### Definition of Done

- [ ] Workflow succeeds without server-side manuscript storage.

---

## OD-212 — Fork end-to-end test

### Atomic Instruction

Test: source repository -> fork -> clone -> edit -> commit -> push -> PR.

### Definition of Done

- [ ] Workflow succeeds.
- [ ] Protocol provenance remains pinned to the original protocol revision.

---

## OD-213 — Registry discovery end-to-end test

### Atomic Instruction

Test: collection registry -> publication registry -> article.ttl traversal.

### Definition of Done

- [ ] Client can traverse the hierarchy and retrieve the publication.

---

## OD-214 — Independent protocol verification test

### Atomic Instruction

Verify a publication without using OpenDraft. Use ordinary HTTP, an RDF parser, and a SHACL validator.

### Definition of Done

- [ ] A third-party tool can retrieve `article.ttl`.
- [ ] A third-party tool can identify its protocol revision.
- [ ] A third-party tool can retrieve the protocol artifact.
- [ ] A third-party tool can verify its integrity.
- [ ] A third-party tool can validate the article.
