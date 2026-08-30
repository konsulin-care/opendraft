# Phase 1 — Protocol Validation

**Summary:** Creates SHACL shapes and example fixtures that define and validate correct protocol usage, culminating in an automated conformance test runner.

---

## OD-010 — Create article SHACL

### Atomic Instruction

Create `protocol/article.shacl.ttl` with SHACL shapes that validate a valid article representation.

### Definition of Done

- [ ] The shape validates the minimum valid article representation.
- [ ] It checks at minimum: publication type, title, author, source repository, source revision, protocol revision.
- [ ] A valid fixture passes.
- [ ] An invalid fixture fails.

---

## OD-011 — Create registry SHACL

### Atomic Instruction

Create `protocol/registry.shacl.ttl` with SHACL shapes that distinguish collection registries from publication registries.

### Definition of Done

- [ ] The shape distinguishes collection registry from publication registry.
- [ ] It rejects a registry that simultaneously contains registries and publications.

---

## OD-012 — Create minimal article fixture

### Atomic Instruction

Create a minimal valid article fixture at `protocol/examples/article.ttl`.

### Definition of Done

- [ ] TTL parses.
- [ ] SHACL validation passes.
- [ ] Every required property has a clear purpose.
- [ ] The example uses the OpenDraft namespace.

---

## OD-013 — Create collection registry fixture

### Atomic Instruction

Create `protocol/registry.ttl` as a working collection registry.

### Definition of Done

- [ ] It validates.
- [ ] It identifies itself.
- [ ] It contains at least one registry.
- [ ] It does not directly contain publications.
- [ ] Its referenced resources are understandable from the example.

---

## OD-014 — Create publication registry fixture

### Atomic Instruction

Create an example publication registry.

### Definition of Done

- [ ] It validates.
- [ ] It contains publications.
- [ ] It does not contain registries.
- [ ] It demonstrates the expected publication-reference structure.

---

## OD-015 — Create protocol conformance test runner

### Atomic Instruction

Implement a test command that validates all protocol fixtures.

### Definition of Done

- [ ] The command passes when all valid examples pass and invalid examples fail as expected.
- [ ] The command fails when a conformance requirement is violated.
