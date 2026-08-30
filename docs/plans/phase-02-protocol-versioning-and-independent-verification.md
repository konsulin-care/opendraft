# Phase 2 — Protocol Versioning and Independent Verification

**Summary:** Defines how protocol revisions are recorded, introduces immutable artifact URIs, and creates automated verification so protocol integrity can be checked independently.

---

## OD-020 — Define protocol revision model

### Atomic Instruction

Define how a publication records the OpenDraft protocol revision.

### Definition of Done

- [ ] The model contains: protocol name, protocol version, protocol repository, protocol commit.
- [ ] The full commit SHA is mandatory for immutable provenance.

---

## OD-021 — Define protocol artifact URI convention

### Atomic Instruction

Define canonical URI forms for protocol artifacts.

### Definition of Done

- [ ] The specification distinguishes: repository at commit, directory at commit, file at commit.
- [ ] Example forms are documented.
- [ ] Mutable branch URLs are explicitly identified as non-immutable references.

---

## OD-022 — Create protocol verification manifest

### Atomic Instruction

Define a machine-readable mechanism for independently verifying protocol artifacts.

### Definition of Done

- [ ] A client can determine which OpenDraft commit defines the protocol.
- [ ] A client can determine which artifact is being used.
- [ ] A client can determine the expected artifact hash.
- [ ] A client can determine whether the retrieved artifact matches.

---

## OD-023 — Automate protocol artifact verification

### Atomic Instruction

Create a GitHub Action that verifies protocol artifacts against their declared commit/hash.

### Definition of Done

- [ ] CI fails if artifact content changes unexpectedly.
- [ ] CI fails if declared commit is inconsistent.
- [ ] CI fails if declared checksum is inconsistent.
- [ ] CI passes for the canonical protocol revision.

---

## OD-024 — Pin protocol revision in project template

### Atomic Instruction

Make generated OpenDraft projects contain a pinned protocol revision.

### Definition of Done

- [ ] Generated `opendraft.yml` contains: `protocol.name`, `protocol.version`, `protocol.repository`, `protocol.commit`.
- [ ] The commit is a full SHA.
